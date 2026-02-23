"use client";

import { useEffect } from "react";
import { useSelector } from "react-redux";
import type { RootState } from "@/store/store";
import { CACHE_ROUTE_PATHS } from "@/config/cacheRoutes";

export function usePrecacheRoutes() {
  const token = useSelector((s: RootState) => s.auth.token);

  useEffect(() => {
    if (!token) return;
    // warm page caches (works with next-pwa pages caching rule)
    CACHE_ROUTE_PATHS.forEach((r) => {
      fetch(r).catch(() => {});
    });
  }, [token]);
}
