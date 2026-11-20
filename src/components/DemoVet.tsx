'use client'
// Demonstração do veterinário consultor (src/lib/demoVet.ts): o botão que abre e a faixa de aviso dentro dela.
import { useState } from 'react'
import { useT } from '@/lib/i18n'

/** Abre a demonstração: cria a conta fictícia (ou reaproveita a que já está aberta) e vai para o painel de consultoria. */
export function DemoVetButton({ className = '' }: { className?: string }) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function open() {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/demo/veterinario', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível abrir a demonstração. Tente de novo.')
      // Recarrega para a sessão nova valer em tudo (menu, propriedade aberta)
      window.location.href = '/consultoria'
    } catch (e) {
      setError(e instanceof Error ? t(e.message) : t('Não foi possível abrir a demonstração. Tente de novo.'))
      setBusy(false)
    }
  }
  return (
    <div className={className}>
      <button type="button" onClick={open} disabled={busy} className="w-full rounded-lg border border-green-700 px-4 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-60">
        {t(busy ? 'Preparando a demonstração...' : 'Ver demonstração do veterinário')}
      </button>
      <p className="mt-1.5 text-center text-xs text-gray-500">{t('Três propriedades com dados fictícios. Não precisa de conta.')}</p>
      {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  )
}

/** Faixa no topo das telas durante a demonstração, com o atalho para criar a conta de verdade. */
export function DemoBanner() {
  const t = useT()
  async function createAccount() {
    // Sai da demonstração antes: o cadastro é de uma conta nova
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
    window.location.href = '/veterinario/cadastro'
  }
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
      <p><span className="font-semibold">{t('Demonstração.')}</span> {t('Os dados são fictícios e somem em 24 horas. Pode anotar, diagnosticar e imprimir à vontade.')}</p>
      <button type="button" onClick={createAccount} className="rounded-lg bg-blue-700 px-3 py-1.5 font-semibold text-white hover:bg-blue-600">{t('Criar minha conta')}</button>
    </div>
  )
}
