'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BackLink } from '@/components/BackLink'
import { GoogleLoginButton } from '@/components/GoogleLoginButton'
import { useRegistrationAccount } from '@/lib/useRegistrationAccount'

const EMPTY = {
  companyName: '', document: '', contactName: '', phone: '', whatsapp: '',
  city: '', state: '', description: '', email: '', password: '', confirm: '',
}

const input = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'

export default function CadastroFornecedorPage() {
  const { account, ready, error: accountError } = useRegistrationAccount()
  const [form, setForm] = useState(EMPTY)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value })

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!account && form.password !== form.confirm) return setError('As senhas não coincidem')
    if (!account && form.password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres')

    setLoading(true)
    try {
      const { companyName, document, contactName, phone, whatsapp, city, state, description, email, password } = form
      const res = await fetch('/api/fornecedores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendor: { companyName, document, contactName: contactName || account?.name, phone, whatsapp, city, state, description },
          user: { email, password },
        }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Erro ao criar cadastro')
      window.location.href = '/fornecedor'
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
        <h1 className="text-2xl font-bold text-gray-900">Cadastro de fornecedor</h1>
        <p className="mt-1 text-gray-500">
          Divulgue ofertas de ração, sal mineral e outros insumos para os produtores da sua região.
          Seu cadastro passa por aprovação antes de publicar.
        </p>

        {account ? <p className="mt-4 text-sm text-green-700">Conta criada para {account.email}. Complete os dados da empresa.</p> : <div className="mt-4"><GoogleLoginButton next="/fornecedor/cadastro" /></div>}
        {accountError && <p role="alert" className="mt-3 text-red-700">{accountError}</p>}
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold text-gray-900 mb-2">Empresa</legend>
            <label className="text-sm font-medium text-gray-700">Nome da empresa *
              <input value={form.companyName} onChange={set('companyName')} required autoFocus placeholder="Ex.: Casa da Ração Boa Safra" className={`mt-1 ${input}`} />
            </label>
            <label className="text-sm font-medium text-gray-700">CNPJ ou CPF
              <input value={form.document} onChange={set('document')} className={`mt-1 ${input}`} />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="col-span-2 text-sm font-medium text-gray-700">Cidade
                <input value={form.city} onChange={set('city')} className={`mt-1 ${input}`} />
              </label>
              <label className="text-sm font-medium text-gray-700">Estado
                <input value={form.state} onChange={set('state')} maxLength={2} placeholder="MG" className={`mt-1 ${input} uppercase`} />
              </label>
            </div>
            <label className="text-sm font-medium text-gray-700">O que você vende
              <textarea value={form.description} onChange={set('description')} rows={2} placeholder="Ex.: ração, sal mineral, entrega na zona rural" className={`mt-1 ${input} resize-none`} />
            </label>
          </fieldset>

          <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold text-gray-900 mb-2">Contato</legend>
            <label className="text-sm font-medium text-gray-700">Seu nome *
              <input value={form.contactName || account?.name || ''} onChange={set('contactName')} required className={`mt-1 ${input}`} />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">Telefone *
                <input value={form.phone} onChange={set('phone')} required inputMode="tel" placeholder="(35) 99999-0000" className={`mt-1 ${input}`} />
              </label>
              <label className="text-sm font-medium text-gray-700">WhatsApp
                <input value={form.whatsapp} onChange={set('whatsapp')} inputMode="tel" placeholder="Se for outro número" className={`mt-1 ${input}`} />
              </label>
            </div>
          </fieldset>

          {!account && <fieldset className="flex flex-col gap-3">
            <legend className="text-sm font-semibold text-gray-900 mb-2">Acesso</legend>
            <label className="text-sm font-medium text-gray-700">E-mail *
              <input type="email" value={form.email} onChange={set('email')} required className={`mt-1 ${input}`} />
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">Senha *
                <input type="password" value={form.password} onChange={set('password')} required className={`mt-1 ${input}`} />
              </label>
              <label className="text-sm font-medium text-gray-700">Repita a senha *
                <input type="password" value={form.confirm} onChange={set('confirm')} required className={`mt-1 ${input}`} />
              </label>
            </div>
          </fieldset>}

          {error && <p className="text-sm text-red-600">{error}</p>}

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
