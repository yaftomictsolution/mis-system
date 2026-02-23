import type { NextConfig } from "next";
import withPWAInit from "next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  register: true,
  skipWaiting: true,
  // Enable PWA only in production builds unless explicitly enabled in dev.
  disable:
    process.env.NODE_ENV === "development" &&
    process.env.NEXT_PUBLIC_ENABLE_SW !== "true",
  fallbacks: {
    document: "/offline",
  },
  runtimeCaching: [
    {
      // Next.js static chunks and static assets.
      urlPattern: /^https?.*\.(?:js|css|woff2|png|jpg|jpeg|svg|ico)$/i,
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
      handler: "NetworkFirst",
      options: {
        cacheName: "pages",
        expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      urlPattern: /\/\?_rsc=|\/_next\/.*\?_rsc=/,
      handler: "NetworkFirst",
      options: {
        cacheName: "rsc",
        expiration: { maxEntries: 50, maxAgeSeconds: 7 * 24 * 60 * 60 },
      },
    },
    {
      // Backend API GET requests.
      urlPattern: /^http:\/\/127\.0\.0\.1:8000\/api\/.*$/i,
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
