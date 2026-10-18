import type { NextConfig } from "next";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const runtimeCaching = require("next-pwa/cache");

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const withPWA = (require("next-pwa") as any)({
  dest: "public",
  disable: false,
  register: false,
  skipWaiting: true,
  // Sem rota especial para "/": ela entra na regra "telas" abaixo (espera curta e 90 dias), como as outras páginas.
  // A rota padrão do next-pwa para o endereço inicial não tinha limite de espera e falhava sem internet.
  cacheStartUrl: false,
  dynamicStartUrl: false,
  // Toda regra precisa de `options` (mesmo vazio): com `fallbacks`, o next-pwa lê options.precacheFallback de cada uma
  runtimeCaching: [
    { urlPattern: /\/api\/(?:auth(?:\/|$)|perfil(?:\/|$))/, handler: 'NetworkOnly', method: 'GET', options: {} },
    // Telas do site (Painel, Anotar, Login, Início): guardadas por 90 dias, como a sessão. A regra padrão
    // do next-pwa ("others") guardava por um dia, e quem ficava mais tempo sem internet caía na tela offline.
    // Espera 3 s pela rede antes de usar a cópia. As respostas de navegação interna (cabeçalho RSC) ficam na regra padrão.
    {
      urlPattern: ({ url, request }: { url: URL; request: Request }) =>
        url.origin === self.origin
        && !url.pathname.startsWith('/api/')
        && !url.pathname.startsWith('/_next/')
        && !/\.[a-z0-9]{2,5}$/i.test(url.pathname)
        && !request.headers.get('RSC'),
      handler: 'NetworkFirst',
      method: 'GET',
      options: { cacheName: 'telas', expiration: { maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 90 }, networkTimeoutSeconds: 3 },
    },
    // A voz guarda os próprios arquivos no celular; sem isso o PWA faria outra cópia de 32 MB
    { urlPattern: /\/voz\//, handler: 'NetworkOnly', method: 'GET', options: {} },
    // Leitura da folha pela foto: worker, núcleo e idioma do OCR ficam guardados um ano depois da primeira leitura
    { urlPattern: /\/ocr\//, handler: 'CacheFirst', method: 'GET', options: { cacheName: 'ocr', expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 365 } } },
    ...runtimeCaching,
  ],
  // A voz sem internet (~38 MB) é baixada só por quem pedir, no Anota Aí Leite
  // O OCR (12 MB) também: baixado na primeira leitura e guardado pela regra abaixo
  publicExcludes: ["!noprecache/**/*", "!voz/**/*", "!ocr/**/*"],
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
