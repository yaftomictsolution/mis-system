"use client";

import { useEffect } from "react";

const SW_ENABLED =
  process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_ENABLE_SW === "true";
const SW_CONTROLLED_RELOAD_KEY = "mis_sw_controlled_reload_v1";

type WorkboxLike = {
  register: () => Promise<ServiceWorkerRegistration>;
};

async function hasReachableWorkboxScript(): Promise<boolean> {
  try {
    const swRes = await fetch("/sw.js", { cache: "no-store" });
    if (!swRes.ok) return false;

    const swText = await swRes.text();
    const match = swText.match(/workbox-[a-z0-9]+\.js/i);
    if (!match) return true;

    const workboxRes = await fetch(`/${match[0]}`, { cache: "no-store" });
    return workboxRes.ok;
  } catch {
    return false;
  }
}

async function unregisterAllServiceWorkers(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(regs.map((reg) => reg.unregister()));
}

async function clearAllCaches(): Promise<void> {
  if (!("caches" in window)) return;
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
}

export default function DebugRegister() {
  useEffect(() => {
    if (!SW_ENABLED) return;

    if (!('serviceWorker' in navigator)) {
      console.warn('DebugRegister: serviceWorker not available in navigator');
      return;
    }

    void (async () => {
      try {
        const isOnline = typeof navigator === "undefined" ? true : navigator.onLine;
        if (!isOnline) {
          const existing = await navigator.serviceWorker.getRegistration();
          if (existing) {
            console.info("DebugRegister: offline mode detected, using existing service worker registration");
            return;
          }
        }

        if (isOnline) {
          const healthy = await hasReachableWorkboxScript();
          if (!healthy) {
            console.warn("DebugRegister: broken SW bundle detected, resetting SW + caches");
            await unregisterAllServiceWorkers();
            await clearAllCaches();
          }
        }

        const workbox = (window as Window & { workbox?: WorkboxLike }).workbox;
        const reg = workbox
          ? await workbox.register()
          : await navigator.serviceWorker.register("/sw.js", {
              scope: "/",
              updateViaCache: "none",
            });
        await reg.update().catch(() => undefined);

        // A new worker is not guaranteed to control the current page until the next load.
        // Reload once on first control so offline navigation/refresh runs under the active SW.
        if (!navigator.serviceWorker.controller && sessionStorage.getItem(SW_CONTROLLED_RELOAD_KEY) !== "1") {
          const onControllerChange = () => {
            sessionStorage.setItem(SW_CONTROLLED_RELOAD_KEY, "1");
            navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
            window.location.reload();
          };

          navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
        } else if (navigator.serviceWorker.controller) {
          sessionStorage.setItem(SW_CONTROLLED_RELOAD_KEY, "1");
        }

        console.info("DebugRegister: service worker ready", reg);
      } catch (err) {
        console.error("DebugRegister: registration failed", err);
      }
    })();
  }, []);

  return null;
}
