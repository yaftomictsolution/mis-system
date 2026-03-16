"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { warmRouteForOffline } from "@/pwa/cacheWarm";

export default function CacheOnVisit() {
  const pathname = usePathname();
  const token = useSelector((s: RootState) => s.auth.token);

  useEffect(() => {
    if (!token) return; // only cache after login
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const url = window.location.href;
    const path = window.location.pathname;

    const tryCache = async () => {
      try {
        await warmRouteForOffline(path);
        await fetch(url).catch(() => {});
      } catch (err) {
        console.error("cache-on-visit failed", err);
      }
    };

    tryCache();
  }, [pathname, token]);

  return null;
}
