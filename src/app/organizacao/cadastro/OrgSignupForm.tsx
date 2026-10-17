'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BackLink } from '@/components/BackLink'
import { GoogleLoginButton } from '@/components/GoogleLoginButton'
import { useRegistrationAccount } from '@/lib/useRegistrationAccount'
import { ORG_TYPES, type OrgType } from '@/lib/organizations'
import { maskDocument, maskPhone } from '@/lib/masks'

const EMPTY = { name: '', document: '', contactName: '', phone: '', city: '', state: '', email: '', password: '', confirm: '' }
const input = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'

export function OrgSignupForm({ type }: { type: OrgType }) {
  const info = ORG_TYPES[type]
  const { account, ready, error: accountError } = useRegistrationAccount()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!account && form.password !== form.confirm) return setError('As senhas não coincidem')
    if (!account && form.password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres')
    setLoading(true)
    try {
      const { name, document, contactName, phone, city, state, email, password } = form
      const res = await fetch('/api/organizacoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organization: { type, name, document, contactName: contactName || account?.name, phone, city, state },
          user: { email, phone, password },
        }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Erro ao criar cadastro')
      window.location.href = info.panel
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[85vh] px-4 py-6">
      <div className="w-full max-w-lg">
        <BackLink href="/criar-conta" className="mb-2 -ml-2" />
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900">{info.signupTitle}</h1>
          <p className="mt-1 text-gray-500">{info.intro} O cadastro passa por aprovação.</p>

          {account
            ? <p className="mt-4 text-sm text-green-700">Conta criada para {account.label}. Complete os dados.</p>
            : <div className="mt-4"><GoogleLoginButton next={`/organizacao/cadastro?tipo=${type}`} /></div>}
          {accountError && <p role="alert" className="mt-3 text-red-700">{accountError}</p>}

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-gray-900 mb-2">{info.label}</legend>
              <label className="text-sm font-medium text-gray-700">Nome *
                <input value={form.name} onChange={set('name')} required autoFocus
                  placeholder={type === 'laticinio' ? 'Ex.: Laticínio Serra Verde' : 'Ex.: Associação dos Produtores do Córrego Fundo'} className={`mt-1 ${input}`} />
              </label>
              <label className="text-sm font-medium text-gray-700">CNPJ
                <input value={form.document} onChange={(e) => setForm({ ...form, document: maskDocument(e.target.value) })} inputMode="numeric" placeholder="CPF ou CNPJ" className={`mt-1 ${input}`} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="col-span-2 text-sm font-medium text-gray-700">Cidade
                  <input value={form.city} onChange={set('city')} className={`mt-1 ${input}`} />
                </label>
                <label className="text-sm font-medium text-gray-700">Estado
                  <input value={form.state} onChange={set('state')} maxLength={2} placeholder="MG" className={`mt-1 ${input} uppercase`} />
                </label>
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-gray-900 mb-2">Responsável</legend>
              <label className="text-sm font-medium text-gray-700">Seu nome *
                <input value={form.contactName || account?.name || ''} onChange={set('contactName')} required className={`mt-1 ${input}`} />
              </label>
              <label className="text-sm font-medium text-gray-700">Telefone / WhatsApp *
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} required inputMode="tel" placeholder="(35) 99999-0000" className={`mt-1 ${input}`} />
              </label>
            </fieldset>

            {!account && (
              <fieldset className="flex flex-col gap-3">
                <legend className="text-sm font-semibold text-gray-900 mb-2">Acesso</legend>
                <label className="text-sm font-medium text-gray-700">E-mail *
                  <input type="email" value={form.email} onChange={set('email')} className={`mt-1 ${input}`} />
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-gray-700">Senha *
                    <input type="password" value={form.password} onChange={set('password')} required className={`mt-1 ${input}`} />
                  </label>
                  <label className="text-sm font-medium text-gray-700">Repita a senha *
                    <input type="password" value={form.confirm} onChange={set('confirm')} required className={`mt-1 ${input}`} />
                  </label>
                </div>
              </fieldset>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={loading || !ready || !!accountError}
              className="w-full bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-base font-semibold py-3 rounded-lg">
              {loading ? 'Enviando...' : 'Criar cadastro'}
            </button>
            <p className="text-center text-sm text-gray-500">
              Já tem cadastro? <Link href="/login" className="font-medium text-green-700 hover:underline">Entrar</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
