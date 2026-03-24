import { NAV_ITEMS } from "@/config/nav";

export type CacheRoute = {
  path: string;
  label: string;
};

type CacheRouteDefinition = CacheRoute & {
  permission?: string;
};

function normalizePath(path: string): string {
  if (!path) return "/";
  if (path !== "/" && path.endsWith("/")) return path.slice(0, -1);
  return path;
}

const routeMap = new Map<string, CacheRouteDefinition>();
routeMap.set("/", { path: "/", label: "Dashboard" });

for (const group of NAV_ITEMS) {
  for (const item of group.items) {
    const path = normalizePath(item.path);
    if (!routeMap.has(path)) {
      routeMap.set(path, {
        path,
        label: item.label,
        permission: "permission" in item && typeof item.permission === "string" ? item.permission : undefined,
      });
    }
  }
}

const EXTRA_CACHE_ROUTES: CacheRouteDefinition[] = [
  { path: "/customers/new", label: "New Customer", permission: "customers.view" },
  { path: "/customers/detail", label: "Customer Detail", permission: "customers.view" },
  { path: "/account-settings", label: "Account Settings" },
  { path: "/offline", label: "Offline" },
];

for (const route of EXTRA_CACHE_ROUTES) {
  const normalized = normalizePath(route.path);
  if (!routeMap.has(normalized)) {
    routeMap.set(normalized, {
      path: normalized,
      label: route.label,
      permission: route.permission,
    });
  }
}

const ALL_CACHE_ROUTE_DEFINITIONS = Array.from(routeMap.values());

export function getCacheRoutesForPermissions(permissions: string[] = []): CacheRoute[] {
  return ALL_CACHE_ROUTE_DEFINITIONS
    .filter((route) => !route.permission || permissions.includes(route.permission))
    .map(({ path, label }) => ({ path, label }));
}

export const CACHE_ROUTES: CacheRoute[] = ALL_CACHE_ROUTE_DEFINITIONS.map(({ path, label }) => ({
  path,
  label,
}));

export const CACHE_ROUTE_PATHS = CACHE_ROUTES.map((route) => route.path);

