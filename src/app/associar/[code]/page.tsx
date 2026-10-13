'use client'

import { use, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BackLink } from '@/components/BackLink'

interface Invite { name: string; contactName: string; city: string | null; state: string | null; loggedIn: boolean; canJoin: boolean; member: boolean }

// Convite da associação: o produtor entra e decide se compartilha o total de leite
export default function AssociarPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const [invite, setInvite] = useState<Invite | null>(null)
  const [invalid, setInvalid] = useState(false)
  const [share, setShare] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/associar/${code}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setInvite)
      .catch(() => setInvalid(true))
  }, [code])

  const next = encodeURIComponent(`/associar/${code}`)

  async function join() {
    setJoining(true)
    setError('')
    try {
      const res = await fetch('/api/minhas-associacoes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code, shareProduction: share }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || 'Não foi possível se associar')
      setInvite((i) => (i ? { ...i, member: true } : i))
    } catch {
      setError('Sem conexão. Tente de novo.')
    } finally {
      setJoining(false)
    }
  }

  async function switchAccount() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    window.location.href = `/login?next=${next}`
  }

  return (
    <div className="flex items-center justify-center min-h-[85vh] px-4">
      <div className="w-full max-w-md">
        <BackLink href="/inicio" label="Voltar ao início" className="mb-2 -ml-2" />
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8 text-center">
          <Image src="/anota-ai-agro-logo.png" width={1632} height={473} alt="Anota Aí Agro" className="mx-auto h-auto w-44" />
          {invalid ? (
            <>
              <h1 className="mt-6 text-xl font-bold text-gray-900">Convite não encontrado</h1>
              <p className="mt-2 text-gray-500">Confira o link com a associação.</p>
            </>
          ) : !invite ? (
            <p className="mt-8 text-gray-400 text-sm">Carregando...</p>
          ) : (
            <>
              <p className="mt-6 text-sm font-medium text-green-700">Convite de associação</p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">{invite.name}</h1>
              <p className="mt-1 text-gray-500">{invite.contactName}{(invite.city || invite.state) && ` · ${[invite.city, invite.state].filter(Boolean).join('/')}`}</p>
              <p className="mt-5 text-gray-600">Associe-se para participar das compras coletivas e receber o apoio da associação.</p>

              <div className="mt-6 flex flex-col gap-2 text-left">
                {invite.member ? (
                  <>
                    <p className="rounded-lg bg-green-50 px-3 py-2 text-center font-semibold text-green-800">Pronto! Você é associado da {invite.name}.</p>
                    <Link href="/lite/associacao" className="w-full bg-green-700 hover:bg-green-600 text-white text-center font-semibold py-3 rounded-lg">Ver minha associação</Link>
                  </>
                ) : invite.canJoin ? (
                  <>
                    <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
                      <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 h-5 w-5 accent-green-700" />
                      <span>Mostrar à associação o <strong>total de leite</strong> que eu produzo. Animais, financeiro e os outros dados continuam privados. Dá para mudar depois.</span>
                    </label>
                    <button type="button" onClick={join} disabled={joining} className="w-full bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white font-semibold py-3 rounded-lg">
                      {joining ? 'Associando...' : 'Quero me associar'}
                    </button>
                  </>
                ) : invite.loggedIn ? (
                  <>
                    <p className="text-center text-sm text-gray-600">Para se associar, entre com a conta de produtor (versão completa ou Anota Aí Leite). Na versão completa, quem administra a propriedade é quem associa.</p>
                    <button type="button" onClick={switchAccount} className="w-full border-2 border-green-700 text-green-700 font-semibold py-2.5 rounded-lg hover:bg-green-50">Entrar com a conta de produtor</button>
                  </>
                ) : (
                  <>
                    <Link href={`/login?next=${next}`} className="w-full bg-green-700 hover:bg-green-600 text-white text-center font-semibold py-3 rounded-lg">Já sou cadastrado</Link>
                    <Link href="/criar-conta" className="w-full border-2 border-green-700 text-green-700 text-center font-semibold py-2.5 rounded-lg hover:bg-green-50">Criar conta</Link>
                    <p className="text-center text-xs text-gray-500">Depois de criar a conta, abra este link de novo para se associar.</p>
                  </>
                )}
                {error && <p className="text-center text-sm text-red-600">{error}</p>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
