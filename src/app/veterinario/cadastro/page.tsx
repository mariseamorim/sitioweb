'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BackLink } from '@/components/BackLink'
import { GoogleLoginButton } from '@/components/GoogleLoginButton'
import { useRegistrationAccount } from '@/lib/useRegistrationAccount'
import { maskPhone } from '@/lib/masks'

const EMPTY = { name: '', crmv: '', city: '', state: '', phone: '', email: '', password: '', confirm: '' }

const input = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'

export default function CadastroVeterinarioPage() {
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
      const { name, crmv, city, state, phone, email, password } = form
      const res = await fetch('/api/veterinarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user: { name: name || account?.name, phone, email, password }, vet: { crmv, city, state } }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Erro ao criar cadastro')
      window.location.href = '/consultoria'
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
          <h1 className="text-2xl font-bold text-gray-900">Cadastro de veterinário</h1>
          <p className="mt-1 text-gray-500">
            Acompanhe a reprodução e o manejo das propriedades que você atende. O produtor libera a propriedade com o seu código,
            ou você cadastra a propriedade do cliente. Gratuito na fase de testes.
          </p>

          {account ? <p className="mt-4 text-sm text-green-700">Conta criada para {account.label}. Complete os seus dados.</p> : <div className="mt-4"><GoogleLoginButton next="/veterinario/cadastro" /></div>}
          {accountError && <p role="alert" className="mt-3 text-red-700">{accountError}</p>}
          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-gray-900 mb-2">Seus dados</legend>
              <label className="text-sm font-medium text-gray-700">Seu nome *
                <input value={form.name || account?.name || ''} onChange={set('name')} required autoFocus className={`mt-1 ${input}`} />
              </label>
              <label className="text-sm font-medium text-gray-700">Registro profissional (CRMV)
                <input value={form.crmv} onChange={set('crmv')} placeholder="Ex.: CRMV-MG 12345" className={`mt-1 ${input}`} />
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

            {!account && <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-semibold text-gray-900 mb-2">Acesso</legend>
              <p className="text-sm text-gray-500">Informe o telefone, o e-mail ou os dois. Você entra com qualquer um deles.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm font-medium text-gray-700">Telefone
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} inputMode="tel" placeholder="(35) 99999-0000" className={`mt-1 ${input}`} />
                </label>
                <label className="text-sm font-medium text-gray-700">E-mail
                  <input type="email" value={form.email} onChange={set('email')} className={`mt-1 ${input}`} />
                </label>
                <label className="text-sm font-medium text-gray-700">Senha *
                  <input type="password" value={form.password} onChange={set('password')} required className={`mt-1 ${input}`} />
                </label>
                <label className="text-sm font-medium text-gray-700">Repita a senha *
                  <input type="password" value={form.confirm} onChange={set('confirm')} required className={`mt-1 ${input}`} />
                </label>
              </div>
            </fieldset>}

            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

            <button type="submit" disabled={loading || !ready || !!accountError} className="w-full bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-base font-semibold py-3 rounded-lg">
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
