import { NAV_ITEMS } from "@/config/nav";

export type CacheRoute = {
  path: string;
  label: string;
};

function normalizePath(path: string): string {
  if (!path) return "/";
  if (path !== "/" && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

const routeMap = new Map<string, string>();
routeMap.set("/", "Dashboard");

for (const group of NAV_ITEMS) {
  for (const item of group.items) {
    const path = normalizePath(item.path);
    if (!routeMap.has(path)) {
      routeMap.set(path, item.label);
    }
  }
}

const EXTRA_CACHE_ROUTES: Array<[string, string]> = [
  ["/customers/new", "New Customer"],
  ["/customers/detail", "Customer Detail"],
];

for (const [path, label] of EXTRA_CACHE_ROUTES) {
  const normalized = normalizePath(path);
  if (!routeMap.has(normalized)) {
    routeMap.set(normalized, label);
  }
}

export const CACHE_ROUTES: CacheRoute[] = Array.from(routeMap.entries()).map(([path, label]) => ({
  path,
  label,
}));

export const CACHE_ROUTE_PATHS = CACHE_ROUTES.map((route) => route.path);

