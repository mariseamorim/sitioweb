'use client'

import { useEffect, useState } from 'react'

function countPending(): number {
  try {
    let total = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('pending_')) continue
      const list = JSON.parse(localStorage.getItem(key) || '[]')
      if (Array.isArray(list)) total += list.length
    }
    return total
  } catch {
    return 0
  }
}

// Mostra na barra do topo se o aparelho está sem sinal e quantos registros aguardam envio
export function SyncStatus() {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)

  useEffect(() => {
    const refresh = () => {
      setOnline(navigator.onLine)
      setPending(countPending())
    }
    refresh()
    const timer = setInterval(refresh, 3000)
    window.addEventListener('online', refresh)
    window.addEventListener('offline', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', refresh)
      window.removeEventListener('offline', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  if (online && pending === 0) return null

  const label = !online
    ? pending > 0 ? `Sem internet · ${pending} aguardando` : 'Sem internet'
    : `${pending} para enviar`

  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${
        online ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
      }`}
      title={pending > 0 ? 'Os registros estão salvos neste aparelho. Abra a tela correspondente e use Enviar registros quando a internet voltar.' : undefined}
    >
      <span className={`w-2 h-2 rounded-full ${online ? 'bg-blue-600' : 'bg-amber-600'}`} />
      {label}
    </span>
  )
}
