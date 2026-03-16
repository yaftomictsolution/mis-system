"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { CACHE_ROUTE_PATHS } from "@/config/cacheRoutes";
import { listDynamicCacheRoutes, warmRouteForOffline } from "@/pwa/cacheWarm";

export function usePrecacheRoutes() {
  const token = useSelector((s: RootState) => s.auth.token);
  const router = useRouter();

  useEffect(() => {
    if (!token) return;

    const warm = async () => {
      const dynamicRoutes = await listDynamicCacheRoutes().catch(() => []);
      const allPaths = [...new Set([...CACHE_ROUTE_PATHS, ...dynamicRoutes.map((route) => route.path)])];

      for (const path of allPaths) {
        await warmRouteForOffline(path, router.prefetch.bind(router));
      }
    };

    void warm();

    const onSyncComplete = () => {
      void warm();
    };

    const onOnline = () => {
      void warm();
    };

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
      window.removeEventListener("online", onOnline);
    };
  }, [router, token]);
}
