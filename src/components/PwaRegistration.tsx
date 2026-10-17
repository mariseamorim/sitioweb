'use client'

import { useEffect } from 'react'

// Registro explícito para o App Router: next-pwa injeta apenas no main.js do Pages Router.

/** Telas que precisam abrir sem internet mesmo que a pessoa nunca tenha passado por elas neste aparelho */
export const OFFLINE_PAGES = ['/offline', '/inicio', '/login', '/', '/lite']
const WARM_KEY = 'offline_pages_warmed_at'
const WARM_EVERY = 6 * 60 * 60 * 1000

/** Guarda as telas essenciais no aparelho (o service worker salva a resposta na regra "telas"). No máximo a cada 6 horas; `force` ignora o prazo. */
export async function warmOfflinePages(force = false) {
  if (!('serviceWorker' in navigator) || !navigator.onLine) return
  try {
    const last = Number(localStorage.getItem(WARM_KEY) || 0)
    if (!force && Date.now() - last < WARM_EVERY) return
  } catch {}
  try {
    // Sem service worker registrado (modo anônimo, http na rede local), "ready" nunca resolve: espera no máximo 3 s
    const ready = await Promise.race([navigator.serviceWorker.ready, new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000))])
    if (!ready) return
    // No primeiro acesso a página ainda não é controlada pelo service worker, e os pedidos passariam direto, sem guardar
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
        setTimeout(resolve, 10000)
      })
      if (!navigator.serviceWorker.controller) return
    }
    await Promise.all(OFFLINE_PAGES.map((url) => fetch(url, { credentials: 'same-origin', headers: { accept: 'text/html' } }).catch(() => undefined)))
    try { localStorage.setItem(WARM_KEY, String(Date.now())) } catch {}
  } catch {}
}

/** Depois de entrar ou sair, as telas guardadas precisam ser refeitas para a pessoa certa */
export function forgetWarmedPages() {
  try { localStorage.removeItem(WARM_KEY) } catch {}
}

export function PwaRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return
    let active = true
    const register = () => {
      if (!active) return
      void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .then(() => warmOfflinePages())
        .catch(() => {
          console.warn('Não foi possível ativar o modo offline. Verifique a conexão e atualize a página.')
        })
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
    return () => { active = false; window.removeEventListener('load', register) }
  }, [])
  return null
}
