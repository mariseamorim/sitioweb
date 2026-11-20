'use client'

import { useState } from 'react'
import { fetchWithTimeout } from '@/lib/offlineData'

/** Senha fácil de ditar pelo telefone: 8 letras e números sem os que se confundem (0/O, 1/l/I) */
export function suggestPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

// Conta fixa de demonstração do consultor: veterinário com três propriedades fictícias, para mostrar o sistema
// a quem quiser conhecer. Renovar recria os dados com as datas de hoje e troca a senha (ver src/lib/demoVet.ts).
export function DemoConsultant({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [login, setLogin] = useState<{ email: string; password: string } | null>(null)

  async function reset() {
    if (!window.confirm('Criar a conta de demonstração do consultor? Se ela já existe, os dados fictícios são recriados com as datas de hoje e a senha muda.')) return
    setBusy(true)
    setError('')
    const password = suggestPassword()
    try {
      const res = await fetchWithTimeout('/api/admin/demo-consultor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) }, 60_000).catch(() => null)
      if (!res) throw new Error('Sem internet. Esta ação precisa de conexão; tente de novo quando o sinal voltar.')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível criar a conta de demonstração. Tente de novo.')
      setLogin({ email: data.email, password })
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Verifique sua conexão e tente novamente')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 max-w-xl">
          <h2 className="text-base font-semibold text-gray-900">Demonstração do consultor</h2>
          <p className="mt-1 text-sm text-gray-500">Conta de veterinário com três propriedades fictícias (rebanho, coberturas, leite de 12 meses, vacinas, agenda e recibos). Use para mostrar o sistema; não vence.</p>
        </div>
        <button type="button" onClick={reset} disabled={busy} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:bg-green-400">
          {busy ? 'Criando... (leva até 1 minuto)' : 'Criar ou renovar'}
        </button>
      </div>
      {login && (
        <div role="status" className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          <p className="font-semibold">Conta de demonstração pronta.</p>
          <p className="mt-1">E-mail: <code className="rounded bg-white px-2 py-0.5 font-mono font-bold">{login.email}</code></p>
          <p className="mt-1">Senha: <code className="rounded bg-white px-2 py-0.5 font-mono font-bold">{login.password}</code> — anote agora; a senha não fica visível de novo.</p>
        </div>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}
