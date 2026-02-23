declare module "next-pwa" {
  import type { NextConfig } from "next";

  type WithPWA = (nextConfig: NextConfig) => NextConfig;

  interface PWAOptions {
    [key: string]: unknown;
  }

  function withPWAInit(options?: PWAOptions): WithPWA;

  export default withPWAInit;
}
