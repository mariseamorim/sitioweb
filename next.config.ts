import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const runtimeCaching = require("next-pwa/cache");

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const withPWA = (require("next-pwa") as any)({
  dest: "public",
  disable: false,
  register: false,
  skipWaiting: true,
  // Toda regra precisa de `options` (mesmo vazio): com `fallbacks`, o next-pwa lê options.precacheFallback de cada uma
  runtimeCaching: [
    { urlPattern: /\/api\/(?:auth(?:\/|$)|perfil(?:\/|$))/, handler: 'NetworkOnly', method: 'GET', options: {} },
    // A voz guarda os próprios arquivos no celular; sem isso o PWA faria outra cópia de 32 MB
    { urlPattern: /\/voz\//, handler: 'NetworkOnly', method: 'GET', options: {} },
    ...runtimeCaching,
  ],
  // A voz sem internet (~38 MB) é baixada só por quem pedir, no Anota Aí Leite
  publicExcludes: ["!noprecache/**/*", "!voz/**/*"],
  fallbacks: {
    document: "/offline",
  },
});

const nextConfig: NextConfig = {
  // O next-pwa só funciona com webpack (usado no build). No `next dev` com Turbopack, esta linha evita o erro de configuração.
  turbopack: {},
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }] }];
  },
};

export default withPWA(nextConfig);
