'use client'

import { useEffect } from 'react'

// Registro explícito para o App Router: next-pwa injeta apenas no main.js do Pages Router.
export function PwaRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return
    let active = true
    const register = () => {
      if (active) void navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }).catch(() => {
        console.warn('Não foi possível ativar o modo offline. Verifique a conexão e atualize a página.')
      })
    }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
    return () => { active = false; window.removeEventListener('load', register) }
  }, [])
  return null
}
