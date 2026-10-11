// Service worker do Anota Aí Leite (escopo /lite).
// Faz a tela abrir sem internet: página pela rede quando houver e, sem sinal, a última cópia guardada.
// Os dados não passam por aqui: a tela guarda os dados e a fila de envio no próprio aparelho.
const CACHE = 'anota-lite-v2'
const PAGES = ['/lite']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PAGES))
      .catch(() => {})
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('anota-lite-') && key !== CACHE) await caches.delete(key)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/lite'))
  } else if (isImmutable(url.pathname)) {
    // Arquivos com hash no nome (build de produção) nunca mudam: cópia guardada primeiro
    event.respondWith(cacheFirst(request))
  } else if (url.pathname.startsWith('/_next/') || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    // Sem hash no nome (ex.: npm run dev) o conteúdo muda: rede primeiro, cópia só sem sinal
    event.respondWith(networkFirst(request))
  }
})

function isImmutable(path) {
  return path.startsWith('/_next/static/') && /[-./][0-9a-f]{8,}\.(js|css)$|\/_next\/static\/media\//.test(path)
}

async function networkFirst(request, fallback) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return (await cache.match(request, { ignoreSearch: true })) || (fallback && (await cache.match(fallback))) || Response.error()
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}
