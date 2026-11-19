'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BackLink } from '@/components/BackLink'
import { GoogleLoginButton } from '@/components/GoogleLoginButton'
import { useRegistrationAccount } from '@/lib/useRegistrationAccount'
import { maskPhone } from '@/lib/masks'
import { useLang, useT } from '@/lib/i18n'
import { LanguagePicker } from '@/components/LanguagePicker'

const EMPTY = { name: '', crmv: '', city: '', state: '', phone: '', email: '', password: '', confirm: '' }

const input = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'

export default function CadastroVeterinarioPage() {
  const { account, ready, error: accountError } = useRegistrationAccount()
  const t = useT()
  const es = useLang() === 'es'
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [field]: e.target.value })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!account && form.password !== form.confirm) return setError(t('As senhas não coincidem'))
    if (!account && form.password.length < 6) return setError(t('A senha deve ter pelo menos 6 caracteres'))

    setLoading(true)
    try {
      const { name, crmv, city, state, phone, email, password } = form
      const res = await fetch('/api/veterinarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: { name: name || account?.name, phone, email, password }, vet: { crmv, city, state } }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error ? t(data.error) : t('Erro ao criar cadastro'))
      window.location.href = '/consultoria'
    } catch {
      setError(t('Erro de conexão. Tente novamente.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[85vh] px-4 py-6">
      <div className="w-full max-w-lg">
        <div className="mb-2 flex items-center justify-between gap-2"><BackLink href="/criar-conta" label={t('Voltar')} className="-ml-2" /><LanguagePicker /></div>
        <div className="bg-white rounded-2xl shadow-md p-6 sm:p-8">
          <h1 className="text-2xl font-bold text-gray-900">{t('Cadastro de veterinário')}</h1>
          <p className="mt-1 text-gray-500">
            {t('Acompanhe a reprodução e o manejo das propriedades que você atende. O produtor libera a propriedade com o seu código, ou você cadastra a propriedade do cliente. Gratuito na fase de testes.')}
          </p>

          {account ? <p className="mt-4 text-sm text-green-700">{t('Conta criada para {who}. Complete os seus dados.', { who: account.label })}</p> : <div className="mt-4"><GoogleLoginButton next="/veterinario/cadastro" /></div>}
          {accountError && <p role="alert" className="mt-3 text-red-700">{t(accountError)}</p>}
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-gray-900 mb-2">{t('Seus dados')}</legend>
              <label className="text-sm font-medium text-gray-700">{t('Seu nome')} *
                <input value={form.name || account?.name || ''} onChange={set('name')} required autoFocus className={`mt-1 ${input}`} />
              </label>
              <label className="text-sm font-medium text-gray-700">{t('Registro profissional (CRMV)')}
                <input value={form.crmv} onChange={set('crmv')} placeholder={t('Ex.: CRMV-MG 12345')} className={`mt-1 ${input}`} />
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="col-span-2 text-sm font-medium text-gray-700">{t('Cidade')}
                  <input value={form.city} onChange={set('city')} className={`mt-1 ${input}`} />
                </label>
                <label className="text-sm font-medium text-gray-700">{t('Estado')}
                  <input value={form.state} onChange={set('state')} maxLength={es ? 40 : 2} placeholder={es ? 'Central' : 'MG'} className={`mt-1 ${input} ${es ? '' : 'uppercase'}`} />
                </label>
              </div>
            </fieldset>

            {!account && <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-gray-900 mb-2">{t('Acesso')}</legend>
              <p className="text-sm text-gray-500">{t('Informe o telefone, o e-mail ou os dois. Você entra com qualquer um deles.')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm font-medium text-gray-700">{t('Telefone')}
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} inputMode="tel" placeholder={es ? '0981 123456' : '(35) 99999-0000'} className={`mt-1 ${input}`} />
                </label>
                <label className="text-sm font-medium text-gray-700">{t('E-mail')}
                  <input type="email" value={form.email} onChange={set('email')} className={`mt-1 ${input}`} />
                </label>
                <label className="text-sm font-medium text-gray-700">{t('Senha')} *
                  <input type="password" value={form.password} onChange={set('password')} required className={`mt-1 ${input}`} />
                </label>
                <label className="text-sm font-medium text-gray-700">{t('Repita a senha')} *
                  <input type="password" value={form.confirm} onChange={set('confirm')} required className={`mt-1 ${input}`} />
                </label>
              </div>
            </fieldset>}

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={loading || !ready || !!accountError} className="w-full bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-base font-semibold py-3 rounded-lg">
              {t(loading ? 'Enviando...' : 'Criar cadastro')}
            </button>
            <p className="text-center text-sm text-gray-500">
              {t('Já tem cadastro?')} <Link href="/login" className="font-medium text-green-700 hover:underline">{t('Entrar')}</Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
