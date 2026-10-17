'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { BackLink } from '@/components/BackLink'
import { GoogleLoginButton } from '@/components/GoogleLoginButton'
import { FARM_SEGMENTS } from '@/lib/farmSegments'
import { DOCUMENT_PLACEHOLDER, maskDocument, maskPhone } from '@/lib/masks'
import { contactLabel } from '@/lib/identity'

const EMPTY_FARM = { name: '', propertyType: 'Fazenda', documentType: 'CNPJ', documentNumber: '', owner: '', phone: '', address: '', city: '', state: '' }

export default function CadastroPage() {
  const [step, setStep] = useState(1)
  const [ready, setReady] = useState(false)
  const [farm, setFarm] = useState(EMPTY_FARM)
  const [segments, setSegments] = useState<string[]>([])
  const [user, setUser] = useState({ name: '', email: '', phone: '', password: '', confirm: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleNext, setGoogleNext] = useState('/cadastro')
  useEffect(() => {
    setGoogleNext(`/cadastro${window.location.search}`)
    fetch('/api/auth/me').then(async r => {
      if (r.status === 401) return
      if (!r.ok) throw new Error('Não foi possível verificar a conta')
      const account = await r.json()
      if (account.role !== 'onboarding') { window.location.href = '/'; return }
      setUser(u => ({ ...u, name: account.name, email: account.email ?? '', phone: account.phone ?? '' }))
      setFarm(f => ({ ...f, owner: account.name }))
      setStep(2)
    }).catch(() => setError('Verifique sua conexão para continuar o cadastro.')).finally(() => setReady(true))
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (step === 1 && user.password !== user.confirm) { setError('As senhas não coincidem'); return }
    if (step === 1 && !user.phone.trim() && !user.email.trim()) { setError('Informe um telefone ou um e-mail para entrar'); return }
    setLoading(true)
    try {
      const inviteCode = new URLSearchParams(window.location.search).get('convite')
      const res = await fetch('/api/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(step === 1 ? { user: { name: user.name, email: user.email, phone: user.phone, password: user.password } } : { farm: { ...farm, segments }, inviteCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar')
      if (step === 1) { setStep(2); setFarm(f => ({ ...f, owner: user.name })); setUser(u => ({ ...u, password: '', confirm: '' })) }
      else window.location.href = inviteCode ? '/ofertas' : '/'
    } catch (e) { setError(e instanceof Error ? e.message : 'Verifique sua conexão e tente novamente') }
    finally { setLoading(false) }
  }
  const input = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
  return <div className="mx-auto max-w-md py-6">
    <BackLink href="/criar-conta" />
    <div className="mt-3 rounded-2xl bg-white p-6 shadow-md">
      <h1 className="text-2xl font-bold text-gray-900">{step === 1 ? 'Crie sua conta' : 'Cadastre sua propriedade'}</h1>
      <ol className="my-5 flex gap-4 text-sm font-semibold"><li className={step === 1 ? 'text-green-700' : 'text-gray-500'}>1. Usuário</li><li className={step === 2 ? 'text-green-700' : 'text-gray-500'}>2. Propriedade</li></ol>
      {!ready ? <p>Carregando...</p> : <>
        {step === 1 && <GoogleLoginButton next={googleNext} />}
        {step === 2 && <p className="mb-4 text-sm text-gray-600">Conta criada para {contactLabel(user)}. Agora informe os dados da fazenda ou sítio.</p>}
        <form onSubmit={submit} className="mt-4">
          <fieldset disabled={loading} className="flex flex-col gap-4">
            {step === 1 ? <>
              <label>Seu nome<input required autoComplete="name" className={input} value={user.name} onChange={e => setUser({ ...user, name: e.target.value })} /></label>
              <label>Telefone<input type="tel" inputMode="tel" autoComplete="tel" placeholder="(35) 99999-0000" className={input} value={user.phone} onChange={e => setUser({ ...user, phone: maskPhone(e.target.value) })} /></label>
              <label>E-mail <span className="text-gray-400">(opcional)</span><input type="email" autoComplete="email" className={input} value={user.email} onChange={e => setUser({ ...user, email: e.target.value })} /></label>
              <p className="-mt-2 text-xs text-gray-500">Você entra com o telefone ou com o e-mail. Informe pelo menos um.</p>
              <label>Senha<input required type="password" minLength={6} autoComplete="new-password" className={input} value={user.password} onChange={e => setUser({ ...user, password: e.target.value })} /></label>
              <label>Confirmar senha<input required type="password" minLength={6} autoComplete="new-password" className={input} value={user.confirm} onChange={e => setUser({ ...user, confirm: e.target.value })} /></label>
            </> : <>
              <label>Tipo de propriedade<select className={input} value={farm.propertyType} onChange={e => setFarm({ ...farm, propertyType: e.target.value })}><option>Fazenda</option><option>Sítio</option></select></label>
              <fieldset><legend>O que a propriedade faz? (pode marcar mais de um)</legend>
                <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {FARM_SEGMENTS.map(seg => {
                    const on = segments.includes(seg.key)
                    return <button key={seg.key} type="button" aria-pressed={on} onClick={() => setSegments(on ? segments.filter(k => k !== seg.key) : [...segments, seg.key])}
                      className={`rounded-lg border py-2.5 text-sm font-semibold ${on ? 'border-green-700 bg-green-700 text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}>{seg.label}</button>
                  })}
                </div>
              </fieldset>
              {Object.entries({ name: 'Nome da propriedade', owner: 'Proprietário', documentNumber: 'CPF/CNPJ', phone: 'Telefone', address: 'Endereço', city: 'Cidade', state: 'Estado' }).map(([key, label]) => <label key={key}>{label}
                <input required={key === 'name'} className={input} maxLength={key === 'state' ? 2 : undefined} value={farm[key as keyof typeof farm]} inputMode={key === 'phone' ? 'tel' : key === 'documentNumber' ? 'numeric' : undefined}
                  placeholder={key === 'phone' ? '(35) 99999-0000' : key === 'documentNumber' ? DOCUMENT_PLACEHOLDER[farm.documentType] : undefined}
                  onChange={e => setFarm({ ...farm, [key]: key === 'phone' ? maskPhone(e.target.value) : key === 'documentNumber' ? maskDocument(e.target.value, farm.documentType) : e.target.value })} />
              </label>)}
              <label>Tipo de documento<select className={input} value={farm.documentType} onChange={e => setFarm({ ...farm, documentType: e.target.value, documentNumber: maskDocument(farm.documentNumber, e.target.value) })}><option>CNPJ</option><option>CPF</option></select></label>
            </>}
            {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <button type="submit" className="rounded-lg bg-green-700 py-3 font-semibold text-white hover:bg-green-600">{loading ? 'Salvando...' : step === 1 ? 'Criar conta e continuar' : 'Salvar propriedade e começar'}</button>
          </fieldset>
        </form>
      </>}
      <p className="mt-5 text-sm text-gray-600">Já tem conta? <Link href="/login?next=/cadastro" className="font-semibold text-green-700">Entrar</Link></p>
    </div>
  </div>
}
