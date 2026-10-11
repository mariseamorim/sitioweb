import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const runtimeCaching = require("next-pwa/cache");

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const withPWA = (require("next-pwa") as any)({
  dest: "public",
  disable: false,
  register: false,
  skipWaiting: true,
  runtimeCaching,
  fallbacks: {
    document: "/offline",
  },
});

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
};

export default withPWA(nextConfig);
