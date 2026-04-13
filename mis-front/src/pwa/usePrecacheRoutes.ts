"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { getCacheRoutesForPermissions } from "@/config/cacheRoutes";
import { listDynamicCacheRoutes, warmRouteForOffline } from "@/pwa/cacheWarm";

const MAX_DYNAMIC_ROUTES_PER_WARM = 40;
const MIN_WARM_INTERVAL_MS = 60_000;

export function usePrecacheRoutes() {
  const token = useSelector((s: RootState) => s.auth.token);
  const permissions = useSelector((s: RootState) => s.auth.user?.permissions ?? []);
  const roles = useSelector((s: RootState) => s.auth.user?.roles ?? []);
  const router = useRouter();
  const warmingRef = useRef(false);
  const lastWarmAtRef = useRef(0);

  useEffect(() => {
    if (!token) return;

    const warm = async (reason: "initial" | "sync" | "online") => {
      if (warmingRef.current) return;
      const now = Date.now();
      if (reason !== "initial" && now - lastWarmAtRef.current < MIN_WARM_INTERVAL_MS) return;

      warmingRef.current = true;
      try {
      const staticRoutes = getCacheRoutesForPermissions(permissions, roles);
      const dynamicRoutes = await listDynamicCacheRoutes(permissions).catch(() => []);
      const allPaths = [
        ...new Set([
          ...staticRoutes.map((route) => route.path),
          ...dynamicRoutes.slice(0, MAX_DYNAMIC_ROUTES_PER_WARM).map((route) => route.path),
        ]),
      ];

      for (const path of allPaths) {
        await warmRouteForOffline(path, router.prefetch.bind(router));
      }
      lastWarmAtRef.current = Date.now();
      } finally {
        warmingRef.current = false;
      }
    };

    void warm("initial");

    const onSyncComplete = (event: Event) => {
      const changed = Boolean((event as CustomEvent<{ changed?: boolean }>).detail?.changed);
      if (!changed) return;
      void warm("sync");
    };

    const onOnline = () => {
      void warm("online");
    };

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    window.addEventListener("online", onOnline);

    return () => {
      window.removeEventListener("sync:complete", onSyncComplete as EventListener);
      window.removeEventListener("online", onOnline);
    };
  }, [permissions, roles, router, token]);
}
