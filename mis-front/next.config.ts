import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const APP_CACHE_VERSION =
  process.env.APP_BUILD_ID?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.SOURCE_VERSION?.trim() ||
  String(Date.now());

function normalizePathPrefix(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === "/") return "";
  return `/${trimmed.replace(/^\/+|\/+$/g, "")}`;
}

function buildPrefixedPath(prefix: string, suffix: string): string {
  const normalizedPrefix = normalizePathPrefix(prefix);
  const normalizedSuffix = suffix.startsWith("/") ? suffix : `/${suffix}`;
  return `${normalizedPrefix}${normalizedSuffix}`.replace(/\/{2,}/g, "/");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildUrlPattern(originPattern: string, prefix: string): RegExp {
  return new RegExp(`^${originPattern}${escapeRegExp(prefix)}.*$`, "i");
}

function getApiRuntimeConfig(rawBaseUrl: string | undefined): {
  apiOrigin: string | null;
  apiPrefix: string;
  storagePrefix: string;
} {
  const trimmed = rawBaseUrl?.trim() ?? "";

  if (!trimmed) {
    return {
      apiOrigin: null,
      apiPrefix: "/api/",
      storagePrefix: "/storage/",
    };
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const parsed = new URL(trimmed);
      const prefix = normalizePathPrefix(parsed.pathname);
      return {
        apiOrigin: parsed.origin,
        apiPrefix: buildPrefixedPath(prefix, "/api/"),
        storagePrefix: buildPrefixedPath(prefix, "/storage/"),
      };
    } catch {
      return {
        apiOrigin: null,
        apiPrefix: "/api/",
        storagePrefix: "/storage/",
      };
    }
  }

  return {
    apiOrigin: null,
    apiPrefix: buildPrefixedPath(trimmed, "/api/"),
    storagePrefix: buildPrefixedPath(trimmed, "/storage/"),
  };
}

const { apiOrigin, apiPrefix, storagePrefix } = getApiRuntimeConfig(process.env.NEXT_PUBLIC_API_BASE_URL);
const apiUrlPattern = buildUrlPattern(apiOrigin ? escapeRegExp(apiOrigin) : "https?:\\/\\/[^/]+", apiPrefix);
const storageUrlPattern = buildUrlPattern(apiOrigin ? escapeRegExp(apiOrigin) : "https?:\\/\\/[^/]+", storagePrefix);

const STATIC_APP_ROUTES = [
  "/",
  "/login",
  "/offline",
  "/account-settings",
  "/apartment-sales",
  "/apartments",
  "/crm",
  "/customers",
  "/customers/detail",
  "/customers/new",
  "/documents",
  "/asset-requests",
  "/employees",
  "/inventory-requests",
  "/inventory-movements",
  "/purchase-requests",
  "/warehouse-stock",
  "/installments",
  "/inventories",
  "/payroll",
  "/projects",
  "/rental-payments",
  "/rentals",
  "/user-roles",
  "/users",
];

const STATIC_PWA_ASSETS = [
  "/manifest.json",
  "/favicon-32x32.png",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-192.png",
  "/icon-maskable-512.png",
];

const withPWA = withPWAInit({
  dest: "public",
  register: false,
  skipWaiting: true,
  cacheStartUrl: false,
  dynamicStartUrl: false,
  cacheOnFrontEndNav: true,
  // Enable PWA only in production builds unless explicitly enabled in dev.
  disable:
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_SW !== "true",
  fallbacks: {
    document: "/",
  },
  additionalManifestEntries: [...STATIC_APP_ROUTES, ...STATIC_PWA_ASSETS].map((url) => ({
    url,
    revision: APP_CACHE_VERSION,
  })),
  runtimeCaching: [
    {
      // Only cache same-origin app assets. Cross-origin storage files can be blocked by CORS
      // and should not poison the SW cache flow.
      urlPattern: ({ request, url }: { request: Request; url: URL }) =>
        request.method === "GET" &&
        url.origin === location.origin &&
        /\.(?:js|css|woff2|png|jpg|jpeg|svg|ico)$/i.test(url.pathname),
      handler: "CacheFirst",
      options: {
        cacheName: "static-assets",
        expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
      },
    },
    {
      // HTML routes, including route warm requests triggered from client code.
      urlPattern: ({ request, url }: { request: Request; url: URL }) => {
        if (request.destination === "document" || request.mode === "navigate") return true;
        if (request.method !== "GET") return false;
        if (url.origin !== location.origin) return false;
        if (url.pathname.startsWith("/_next/")) return false;
        if (url.pathname.startsWith("/api/")) return false;
        return !/\.[^/]+$/.test(url.pathname);
      },
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "pages",
        expiration: { maxEntries: 100, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/\?_rsc=|\/_next\/.*\?_rsc=/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "rsc",
        expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      // Backend API GET requests. This works for localhost, same-origin reverse proxies,
      // and production API hosts set through NEXT_PUBLIC_API_BASE_URL.
      urlPattern: apiUrlPattern,
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "api-get",
        expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
    {
      // Cache backend storage assets after first load so document/image previews survive brief outages.
      urlPattern: storageUrlPattern,
      handler: "StaleWhileRevalidate",
      method: "GET",
      options: {
        cacheName: "backend-storage",
        cacheableResponse: {
          statuses: [0, 200],
        },
        expiration: {
          maxEntries: 150,
          maxAgeSeconds: 7 * 24 * 60 * 60,
        },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Silence Next 16 warning if needed.
  turbopack: {},
};

export default withPWA(nextConfig);
