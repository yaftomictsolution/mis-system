import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

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
  "/installments",
  "/inventories",
  "/payroll",
  "/projects",
  "/rental-payments",
  "/rentals",
  "/user-roles",
  "/users",
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
    document: "/offline",
  },
  additionalManifestEntries: STATIC_APP_ROUTES.map((url) => ({
    url,
    revision: "v1",
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
      // Backend API GET requests.
      urlPattern: /^http:\/\/(?:127\.0\.0\.1|localhost):8000\/api\/.*$/i,
      handler: "NetworkFirst",
      method: "GET",
      options: {
        cacheName: "api-get",
        expiration: { maxEntries: 200, maxAgeSeconds: 24 * 60 * 60 },
      },
    },
  ],
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Silence Next 16 warning if needed.
  turbopack: {},
};

export default withPWA(nextConfig);
