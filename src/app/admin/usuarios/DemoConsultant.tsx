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

// Conta fixa de demonstração do veterinário consultor, como as outras contas @demo.com: e-mail e senha fixos.
// Renovar recria os dados fictícios com as datas de hoje; a senha só muda se for digitada (ver src/lib/demoVet.ts).
export function DemoConsultant({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ email: string; password: string } | null>(null)

  async function reset(e: React.FormEvent) {
    e.preventDefault()
    if (!window.confirm('Criar ou renovar a conta de demonstração do veterinário? Os dados fictícios são recriados com as datas de hoje.')) return
    setBusy(true)
    setError('')
    try {
      const body = password ? { password } : {}
      const res = await fetchWithTimeout('/api/admin/demo-consultor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, 60_000).catch(() => null)
      if (!res) throw new Error('Sem internet. Esta ação precisa de conexão; tente de novo quando o sinal voltar.')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível criar a conta de demonstração. Tente de novo.')
      setDone({ email: data.email, password })
      setPassword('')
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verifique sua conexão e tente novamente')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-base font-semibold text-gray-900">Demonstração do veterinário</h2>
      <p className="mt-1 text-sm text-gray-500">
        Conta <strong className="text-gray-700">veterinario@demo.com</strong> com três propriedades fictícias (rebanho, coberturas, leite de 12 meses, vacinas, agenda e recibos).
        Não vence. Renove de vez em quando para os partos e as tarefas acompanharem a data de hoje.
      </p>
      <form onSubmit={reset} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="text-xs font-medium text-gray-600 sm:w-72">Senha <span className="font-normal text-gray-500">(vazio mantém a atual)</span>
          <input type="text" autoComplete="off" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
        </label>
        <button type="submit" disabled={busy} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600 disabled:bg-green-400">
          {busy ? 'Criando... (leva até 1 minuto)' : 'Criar ou renovar'}
        </button>
      </form>
      {done && (
        <p role="status" className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900">
          Pronto. Entre com <strong>{done.email}</strong> e {done.password ? <>a senha <strong className="font-mono">{done.password}</strong></> : 'a senha de sempre'}.
        </p>
      )}
      {error && <p role="alert" className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
    </section>
  )
}
