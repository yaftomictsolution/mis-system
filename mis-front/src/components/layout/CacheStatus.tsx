"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { notifyInfo } from "@/lib/notify";
import { CACHE_ROUTES, CACHE_ROUTE_PATHS } from "@/config/cacheRoutes";
import { listDynamicCacheRoutes, warmRouteForOffline } from "@/pwa/cacheWarm";
import { getOfflineDataStatuses, type OfflineDataStatus } from "@/pwa/offlineReadiness";

const EXTRA_ALLOWED_PAGES = ["/offline", "/login"];
const CORE_ROUTE_SET = new Set(CACHE_ROUTE_PATHS.map((path) => normalizePath(path)));

type CacheSnapshot = {
  routeStatus: Record<string, boolean>;
  currentPathCached: boolean;
  dataStatuses: OfflineDataStatus[];
};

function normalizePath(path: string): string {
  if (!path) return "/";
  if (path !== "/" && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

function isPageLikePath(path: string): boolean {
  if (path.startsWith("/_next/")) return false;
  if (path.startsWith("/api/")) return false;
  return !/\.[^/]+$/.test(path);
}

async function hasActiveServiceWorkerController(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (navigator.serviceWorker.controller) return true;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    return Boolean(registration?.active);
  } catch {
    return false;
  }
}

export default function CacheStatus() {
  const pathname = usePathname();
  const router = useRouter();
  const [routes, setRoutes] = useState(CACHE_ROUTES);
  const [status, setStatus] = useState<Record<string, boolean>>({});
  const [dataStatuses, setDataStatuses] = useState<OfflineDataStatus[]>([]);
  const [progress, setProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [currentCached, setCurrentCached] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const getRouteCandidates = useCallback((route: string) => {
    const path = normalizePath(route);
    const candidates = [path];
    if (typeof window !== "undefined") {
      candidates.push(new URL(path, window.location.origin).href);
    }
    if (path !== "/" && !path.endsWith("/")) {
      candidates.push(`${path}/`);
      if (typeof window !== "undefined") {
        candidates.push(new URL(`${path}/`, window.location.origin).href);
      }
    }
    return [...new Set(candidates)];
  }, []);

  const isRouteCached = useCallback(
    async (route: string) => {
      for (const candidate of getRouteCandidates(route)) {
        const match = await caches.match(candidate, { ignoreSearch: true });
        if (match) return true;
      }

      // Core routes are shipped in the SW precache manifest. CacheStorage lookup can
      // under-report them after hydration/offline transitions, so treat them as ready
      // once the service worker is actually active.
      if (CORE_ROUTE_SET.has(normalizePath(route))) {
        return hasActiveServiceWorkerController();
      }

      return false;
    },
    [getRouteCandidates],
  );

  const loadRoutes = useCallback(async () => {
    try {
      const dynamicRoutes = await listDynamicCacheRoutes();
      const merged = [...CACHE_ROUTES, ...dynamicRoutes];
      const routeMap = new Map<string, (typeof merged)[number]>();
      for (const route of merged) {
        routeMap.set(normalizePath(route.path), { path: normalizePath(route.path), label: route.label });
      }
      const nextRoutes = Array.from(routeMap.values());
      setRoutes(nextRoutes);
      return nextRoutes;
    } catch {
      setRoutes(CACHE_ROUTES);
      return CACHE_ROUTES;
    }
  }, []);

  const collectStatus = useCallback(
    async (routeList = routes): Promise<CacheSnapshot> => {
      const routeStatus: Record<string, boolean> = {};
      for (const route of routeList) {
        try {
          routeStatus[route.path] = await isRouteCached(route.path);
        } catch {
          routeStatus[route.path] = false;
        }
      }

      const currentPath = normalizePath(pathname || "/");
      let currentPathCached = false;
      try {
        currentPathCached = await isRouteCached(currentPath);
      } catch {
        currentPathCached = false;
      }

      const nextDataStatuses = await getOfflineDataStatuses().catch(() => []);
      return {
        routeStatus,
        currentPathCached,
        dataStatuses: nextDataStatuses,
      };
    },
    [isRouteCached, pathname, routes],
  );

  const applySnapshot = useCallback((snapshot: CacheSnapshot) => {
    setStatus(snapshot.routeStatus);
    setCurrentCached(snapshot.currentPathCached);
    setDataStatuses(snapshot.dataStatuses);
  }, []);

  const checkAll = useCallback(
    async (routeList = routes) => {
      const snapshot = await collectStatus(routeList);
      applySnapshot(snapshot);
      return snapshot;
    },
    [applySnapshot, collectStatus, routes],
  );

  const removeStalePages = useCallback(async () => {
    const allowed = new Set<string>([
      ...routes.map((r) => normalizePath(r.path)),
      ...EXTRA_ALLOWED_PAGES,
    ]);

    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      if (!cacheName.includes("pages") && !cacheName.includes("start-url")) continue;
      const cache = await caches.open(cacheName);
      const requests = await cache.keys();

      for (const req of requests) {
        try {
          const url = new URL(req.url);
          if (url.origin !== window.location.origin) continue;
          const path = normalizePath(url.pathname);
          if (!isPageLikePath(path)) continue;
          if (!allowed.has(path)) {
            await cache.delete(req, { ignoreSearch: true });
          }
        } catch {
          // ignore malformed entries
        }
      }
    }
  }, [routes]);

  useEffect(() => {
    void loadRoutes();
  }, [loadRoutes]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void checkAll();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [checkAll]);

  useEffect(() => {
    const onSyncComplete = () => {
      void loadRoutes();
      void checkAll();
    };

    window.addEventListener("sync:complete", onSyncComplete as EventListener);
    return () => window.removeEventListener("sync:complete", onSyncComplete as EventListener);
  }, [checkAll, loadRoutes]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const cacheNow = async (route: string, refreshAfter = true) => {
    try {
      await warmRouteForOffline(route, router.prefetch.bind(router));
      if (refreshAfter) {
        window.setTimeout(() => {
          void checkAll();
        }, 400);
      }
    } catch (err) {
      console.error("cacheNow failed", err);
    }
  };

  const reportIssues = useCallback((routeList: typeof routes, snapshot: CacheSnapshot) => {
    const missingRouteCount = routeList.filter((route) => CORE_ROUTE_SET.has(route.path) && !snapshot.routeStatus[route.path]).length;
    const missingDynamicRouteCount = routeList.filter((route) => !CORE_ROUTE_SET.has(route.path) && !snapshot.routeStatus[route.path]).length;
    const missingDataCount = snapshot.dataStatuses.filter((item) => !item.ready).length;

    if (!missingRouteCount && !missingDataCount && !missingDynamicRouteCount) return;

    const parts: string[] = [];
    if (missingRouteCount) parts.push(`${missingRouteCount} uncached core page${missingRouteCount === 1 ? "" : "s"}`);
    if (missingDataCount) parts.push(`${missingDataCount} module${missingDataCount === 1 ? "" : "s"} not synced locally`);
    if (missingDynamicRouteCount) parts.push(`${missingDynamicRouteCount} dynamic page${missingDynamicRouteCount === 1 ? "" : "s"} not warmed`);
    notifyInfo(`Offline readiness incomplete: ${parts.join(", ")}.`);
  }, []);

  const resyncNow = async () => {
    setSyncing(true);
    setProgress(null);
    try {
      const nextRoutes = await loadRoutes();
      await removeStalePages();
      let index = 0;
      for (const route of nextRoutes) {
        index += 1;
        setProgress({ current: index, total: nextRoutes.length, label: route.label });
        await cacheNow(route.path, false);
      }
      const snapshot = await checkAll(nextRoutes);
      reportIssues(nextRoutes, snapshot);
    } finally {
      setProgress(null);
      setSyncing(false);
    }
  };

  const cacheAllPages = async () => {
    setSyncing(true);
    setProgress(null);
    try {
      const nextRoutes = await loadRoutes();
      let index = 0;
      for (const route of nextRoutes) {
        index += 1;
        setProgress({ current: index, total: nextRoutes.length, label: route.label });
        await cacheNow(route.path, false);
      }
      const snapshot = await checkAll(nextRoutes);
      reportIssues(nextRoutes, snapshot);
    } finally {
      setProgress(null);
      setSyncing(false);
    }
  };

  const cachedCount = routes.filter((r) => status[r.path]).length;
  const currentPath = normalizePath(pathname || "/");
  const missingCoreRoutes = routes.filter((route) => CORE_ROUTE_SET.has(route.path) && !status[route.path]);
  const missingDynamicRoutes = routes.filter((route) => !CORE_ROUTE_SET.has(route.path) && !status[route.path]);
  const missingDataStatuses = dataStatuses.filter((item) => !item.ready);
  const issueCount = missingCoreRoutes.length + missingDataStatuses.length;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((s) => !s)}
        className="text-xs px-2 py-1 rounded border bg-slate-50 dark:bg-[#1a1a2e] border-slate-200 dark:border-[#2a2a3e]"
        title="Cache status"
      >
        Cache: {cachedCount}/{routes.length}
        {issueCount ? (
          <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">{issueCount}</span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-xl dark:border-[#2a2a3e] dark:bg-[#12121a]">
          <div className="mb-2 flex items-center justify-between">
            <strong className="text-sm">Cached Routes</strong>
            <div className="flex items-center gap-2">
              <button className="text-xs text-blue-600" onClick={() => void checkAll()}>
                Refresh
              </button>
              <button
                className="text-xs text-emerald-600 disabled:opacity-60"
                onClick={() => void resyncNow()}
                disabled={syncing}
              >
                {syncing ? "Syncing..." : "Resync"}
              </button>
            </div>
          </div>

          <div className="mb-2 flex items-center justify-between gap-2">
            <button
              className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-700 disabled:opacity-60"
              onClick={() => void cacheAllPages()}
              disabled={syncing}
            >
              {syncing ? "Caching..." : "Cache All App Pages"}
            </button>
            {progress ? (
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {progress.current}/{progress.total} {progress.label}
              </span>
            ) : null}
          </div>

          <div className="mb-2 grid grid-cols-2 gap-2 text-[11px]">
            <div className="rounded border border-slate-200 px-2 py-2 text-slate-600 dark:border-[#2a2a3e] dark:text-slate-300">
              <div className="font-semibold text-slate-800 dark:text-slate-100">Missing Core Pages</div>
              <div className={missingCoreRoutes.length ? "text-rose-600" : "text-emerald-600"}>{missingCoreRoutes.length}</div>
            </div>
            <div className="rounded border border-slate-200 px-2 py-2 text-slate-600 dark:border-[#2a2a3e] dark:text-slate-300">
              <div className="font-semibold text-slate-800 dark:text-slate-100">Data Not Ready</div>
              <div className={missingDataStatuses.length ? "text-rose-600" : "text-emerald-600"}>{missingDataStatuses.length}</div>
            </div>
          </div>

          {missingDynamicRoutes.length ? (
            <div className="mb-2 rounded border border-slate-200 px-2 py-2 text-[11px] text-slate-600 dark:border-[#2a2a3e] dark:text-slate-300">
              <div className="font-semibold text-slate-800 dark:text-slate-100">Dynamic Pages Not Warmed</div>
              <div className="text-amber-600">{missingDynamicRoutes.length}</div>
            </div>
          ) : null}

          <div className="mb-2 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-600 dark:border-[#2a2a3e] dark:text-slate-300">
            Current: <span className="font-medium">{currentPath}</span>{" "}
            <span className={currentCached ? "text-emerald-600" : "text-rose-600"}>
              {currentCached ? "(Cached)" : "(Not cached)"}
            </span>
          </div>

          {missingDataStatuses.length ? (
            <div className="mb-2 rounded border border-amber-200 bg-amber-50 px-2 py-2 text-[11px] text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
              <div className="mb-1 font-semibold">Modules Not Synced Locally</div>
              <ul className="space-y-1">
                {missingDataStatuses.slice(0, 4).map((item) => (
                  <li key={item.key} className="flex items-center justify-between gap-2">
                    <span>{item.label}</span>
                    <span className="text-[10px]">{item.detail}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <ul className="space-y-2">
            {routes.map((r) => {
              const isCached = !!status[r.path];
              return (
                <li key={r.path} className="flex items-center justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={`h-2 w-2 rounded-full ${isCached ? "bg-emerald-500" : "bg-rose-400"}`}
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{r.label}</div>
                      <div className="truncate text-[11px] text-slate-500">{r.path}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCached ? (
                      <span className="text-xs text-emerald-600 bg-emerald-50 text-emerald-700">Cached</span>
                    ) : (
                      <span className="text-xs text-rose-600 bg-rose-50 text-rose-700" />
                    )}

                    {!isCached ? (
                      <button
                        onClick={() => {
                          void cacheNow(r.path);
                        }}
                        className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-600"
                      >
                        Cache
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
