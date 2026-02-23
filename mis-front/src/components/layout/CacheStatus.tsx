"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CACHE_ROUTES } from "@/config/cacheRoutes";

const EXTRA_ALLOWED_PAGES = ["/offline", "/login"];

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

export default function CacheStatus() {
  const pathname = usePathname();
  const routes = CACHE_ROUTES;
  const [status, setStatus] = useState<Record<string, boolean>>({});
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
      return false;
    },
    [getRouteCandidates]
  );

  const checkAll = useCallback(async () => {
    const next: Record<string, boolean> = {};
    for (const route of routes) {
      try {
        next[route.path] = await isRouteCached(route.path);
      } catch {
        next[route.path] = false;
      }
    }

    const currentPath = normalizePath(pathname || "/");
    try {
      setCurrentCached(await isRouteCached(currentPath));
    } catch {
      setCurrentCached(false);
    }

    setStatus(next);
  }, [isRouteCached, pathname, routes]);

  const removeStalePages = useCallback(async () => {
    const allowed = new Set<string>([
      ...routes.map((r) => normalizePath(r.path)),
      ...EXTRA_ALLOWED_PAGES,
    ]);

    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      // runtime HTML page caches
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
    const timeoutId = window.setTimeout(() => {
      void checkAll();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [checkAll]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const cacheNow = async (route: string, refreshAfter = true) => {
    try {
      if (!("serviceWorker" in navigator)) return;
      const path = normalizePath(route);
      const routeAbs = new URL(path, window.location.origin).href;
      const reg = await navigator.serviceWorker.ready;
      const target = navigator.serviceWorker.controller || reg.active || reg.waiting;
      if (target) {
        await new Promise<void>((resolve) => {
          const mc = new MessageChannel();
          const timeoutId = window.setTimeout(resolve, 1500);
          mc.port1.onmessage = () => {
            window.clearTimeout(timeoutId);
            resolve();
          };
          target.postMessage(
            { type: "CACHE_URLS", payload: { urlsToCache: [path, routeAbs] } },
            [mc.port2]
          );
        });
      }
      await fetch(routeAbs, {
        method: "GET",
        credentials: "same-origin",
        headers: { Accept: "text/html" },
      }).catch(() => {});
      if (refreshAfter) {
        window.setTimeout(() => {
          void checkAll();
        }, 400);
      }
    } catch (err) {
      console.error("cacheNow failed", err);
    }
  };

  const resyncNow = async () => {
    setSyncing(true);
    try {
      await removeStalePages();
      for (const route of routes) {
        await cacheNow(route.path, false);
      }
      await checkAll();
    } finally {
      setSyncing(false);
    }
  };

  const cachedCount = routes.filter((r) => status[r.path]).length;
  const currentPath = normalizePath(pathname || "/");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((s) => !s)}
        className="text-xs px-2 py-1 rounded border bg-slate-50 dark:bg-[#1a1a2e] border-slate-200 dark:border-[#2a2a3e]"
        title="Cache status"
      >
        Cache: {cachedCount}/{routes.length}
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+8px)] w-64 rounded-xl border border-slate-200 dark:border-[#2a2a3e] bg-white dark:bg-[#12121a] shadow-xl z-50 p-3">
          <div className="flex items-center justify-between mb-2">
            <strong className="text-sm">Cached Routes</strong>
            <div className="flex items-center gap-2">
              <button className="text-xs text-blue-600" onClick={checkAll}>
                Refresh
              </button>
              <button
                className="text-xs text-emerald-600 disabled:opacity-60"
                onClick={resyncNow}
                disabled={syncing}
              >
                {syncing ? "Syncing..." : "Resync"}
              </button>
            </div>
          </div>

          <div className="mb-2 rounded border border-slate-200 dark:border-[#2a2a3e] px-2 py-1 text-[11px] text-slate-600 dark:text-slate-300">
            Current: <span className="font-medium">{currentPath}</span>{" "}
            <span className={currentCached ? "text-emerald-600" : "text-rose-600"}>
              {currentCached ? "(Cached)" : "(Not cached)"}
            </span>
          </div>

          <ul className="space-y-2">
            {routes.map((r) => {
              const isCached = !!status[r.path];
              return (
                <li key={r.path} className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isCached ? "bg-emerald-500" : "bg-rose-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="text-sm truncate font-medium">{r.label}</div>
                      <div className="text-[11px] text-slate-500 truncate">{r.path}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isCached ? (
                      <span className="text-xs text-emerald-600 bg-emerald-50 text-emerald-700">
                        Cached
                      </span>
                    ) : (
                      <span className="text-xs text-rose-600 bg-rose-50 text-rose-700" />
                    )}

                    {!isCached ? (
                      <button
                        onClick={() => cacheNow(r.path)}
                        className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600"
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
