'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { KIND_LABEL, PointKind } from '@/lib/lite'
import { BackLink } from '@/components/BackLink'
import { GoogleLoginButton } from '@/components/GoogleLoginButton'
import { useRegistrationAccount } from '@/lib/useRegistrationAccount'

type Profile = 'produtor' | 'motorista'

const PROFILES: { key: Profile; title: string; text: string }[] = [
  { key: 'produtor', title: 'Sou produtor', text: 'Anoto o leite do meu sítio todo dia.' },
  { key: 'motorista', title: 'Sou motorista ou coletor', text: 'Recolho o leite em vários sítios e tanques comunitários.' },
]

const input = 'mt-1 w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-600'

export default function LiteCadastroPage() {
  const { account, ready, error: accountError } = useRegistrationAccount()
  const [profile, setProfile] = useState<Profile>('produtor')
  const [form, setForm] = useState({ name: '', email: '', password: '', pointName: '' })
  const [kind, setKind] = useState<PointKind>('sitio')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const driver = profile === 'motorista'

  // Link direto para motoristas: /lite/cadastro?perfil=motorista
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('perfil') === 'motorista') {
      void Promise.resolve().then(() => setProfile('motorista'))
    }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!account && form.password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres')
    setLoading(true)
    try {
      const res = await fetch('/api/lite/cadastro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, pointKind: kind, profile }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Erro ao criar conta')
      window.location.href = '/lite'
    } catch {
      setError('Sem internet. O cadastro precisa de conexão.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-gray-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        <BackLink href="/criar-conta" className="mb-2 -ml-2" />
        <div className="bg-white rounded-2xl shadow-md p-6">
        <Image src="/anota-ai-agro-logo.png" width={1632} height={473} alt="Anota Aí Agro" className="mx-auto h-auto w-40" />
        <h1 className="mt-5 text-2xl font-bold text-gray-900 text-center">Anota Aí Leite</h1>
        <p className="mt-1 text-center text-gray-600">Anote o leite no celular, mesmo sem internet.</p>

        {account ? <p className="mt-4 text-sm text-green-700">Conta criada para {account.email}. Complete seu perfil abaixo.</p> : <div className="mt-4"><GoogleLoginButton next={driver ? '/lite/cadastro?perfil=motorista' : '/lite/cadastro'} /></div>}
        {accountError && <p role="alert" className="mt-3 text-red-700">{accountError}</p>}
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
          <fieldset>
            <legend className="text-sm font-medium text-gray-700 mb-2">Como você vai usar?</legend>
            <div className="grid gap-2">
              {PROFILES.map((p) => (
                <button key={p.key} type="button" onClick={() => setProfile(p.key)} aria-pressed={profile === p.key}
                  className={`text-left rounded-xl border-2 px-4 py-3 ${profile === p.key ? 'border-green-700 bg-green-50' : 'border-gray-200'}`}>
                  <span className="block font-semibold text-gray-900">{p.title}</span>
                  <span className="block text-sm text-gray-600">{p.text}</span>
                </button>
              ))}
            </div>
          </fieldset>

          {!account && <><label className="text-sm font-medium text-gray-700">Seu nome
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={input} />
          </label>
          <label className="text-sm font-medium text-gray-700">E-mail
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required className={input} />
          </label>
          <label className="text-sm font-medium text-gray-700">Senha
            <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required className={input} />
          </label></>}

          {driver ? (
            <fieldset>
              <legend className="text-sm font-medium text-gray-700">Primeiro local da rota <span className="font-normal text-gray-400">(opcional)</span></legend>
              <input value={form.pointName} onChange={(e) => setForm({ ...form, pointName: e.target.value })}
                placeholder="Ex.: Sítio do João ou Tanque da Ponte" aria-label="Nome do local" className={input} />
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(['sitio', 'tanque'] as const).map((k) => (
                  <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
                    className={`py-3 rounded-xl border-2 text-sm font-semibold ${kind === k ? 'border-green-700 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>
                    {KIND_LABEL[k]}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">Depois você cadastra os outros locais da rota.</p>
            </fieldset>
          ) : (
            <label className="text-sm font-medium text-gray-700">Nome do seu sítio
              <input value={form.pointName} onChange={(e) => setForm({ ...form, pointName: e.target.value })} required
                placeholder="Ex.: Sítio Boa Vista" className={input} />
            </label>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading || !ready || !!accountError} className="w-full bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-lg font-bold py-4 rounded-xl">
            {loading ? 'Criando...' : 'Começar a anotar'}
          </button>
          <p className="text-center text-sm text-gray-500">
            Já tem conta? <Link href="/login?next=/lite" className="font-semibold text-green-700">Entrar</Link>
          </p>
        </form>
      </div>
      </div>
    </div>
  )
}
