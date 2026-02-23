"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";

export default function CacheOnVisit() {
  const pathname = usePathname();
  const token = useSelector((s: RootState) => s.auth.token);

  useEffect(() => {
    if (!token) return; // only cache after login
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const url = window.location.href;

    const tryCache = async () => {
      try {
        // prefer messaging the SW to cache via Workbox CACHE_URLS
        const reg = await navigator.serviceWorker.getRegistration();
        const target = navigator.serviceWorker.controller || reg?.active;
        if (target) {
          const mc = new MessageChannel();
          mc.port1.onmessage = (e) => {
            // no-op; could show a toast
            console.debug("SW cache response:", e.data);
          };
          target.postMessage({ type: "CACHE_URLS", payload: { urlsToCache: [url] } }, [mc.port2]);
        }

        // fallback: warm by fetching the page so SW's NetworkFirst can cache it
        await fetch(url).catch(() => {});
      } catch (err) {
        console.error("cache-on-visit failed", err);
      }
    };

    tryCache();
  }, [pathname, token]);

  return null;
}
