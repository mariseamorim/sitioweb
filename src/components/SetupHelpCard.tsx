'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SupportWhatsApp } from '@/components/SupportWhatsApp'
import { useUser } from '@/contexts/UserContext'

// Painel de quem acabou de começar: oferece ajuda para configurar pelo WhatsApp. Some quando a pessoa dispensa
// (guardado no aparelho) ou quando a propriedade já tem animais. O resumo do cadastro é montado no servidor, na rota de suporte.

export function SetupHelpCard({ farmId }: { farmId: string }) {
  const key = `setup_help_dismissed:${farmId}`
  const { user } = useUser()
  const [show, setShow] = useState(false)
  useEffect(() => {
    let dismissed = false
    try { dismissed = localStorage.getItem(key) === '1' } catch {}
    if (!dismissed) void Promise.resolve().then(() => setShow(true))
  }, [key])
  if (!show || !user?.support) return null

  function dismiss() {
    try { localStorage.setItem(key, '1') } catch {}
    setShow(false)
  }

  return (
    <section aria-labelledby="setup-help" className="mb-8 rounded-xl border border-green-200 bg-green-50 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 id="setup-help" className="text-lg font-bold text-green-950">Quer ajuda para começar?</h2>
          <p className="mt-1 text-sm text-green-900">A gente configura o sistema com você pelo WhatsApp: propriedade, animais, leite e quem vai usar. Os dados do seu cadastro já vão na mensagem.</p>
        </div>
        <button type="button" onClick={dismiss} className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-green-800 hover:bg-green-100">Agora não</button>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <SupportWhatsApp kind="configurar" variant="button" label="Pedir configuração inicial" />
        <Link href="/ajuda" className="text-sm font-semibold text-green-800 hover:underline">Ver todas as opções de ajuda</Link>
      </div>
    </section>
  )
}
