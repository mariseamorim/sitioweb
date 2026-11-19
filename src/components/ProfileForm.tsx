'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useUser } from '@/contexts/UserContext'
import { GoogleLoginButton, GOOGLE_ERRORS } from '@/components/GoogleLoginButton'
import { homeForRole } from '@/lib/organizations'
import { maskPhone } from '@/lib/masks'
import { useDialog } from '@/components/DialogProvider'
import { wipeDevice } from '@/lib/offlineUnlock'
import { cachedGet, fetchWithTimeout } from '@/lib/offlineData'
import { PasswordInput } from '@/components/PasswordInput'
import { useT } from '@/lib/i18n'

interface Profile {
  name: string
  email: string | null
  phone: string | null
  role: string
  hasPassword: boolean
  googleConnected: boolean
  vendor: Record<string, string | null> | null
  milkPoints: { id: string; name: string; kind: string }[]
}

export function ProfileForm() {
  const { refresh } = useUser()
  const { confirm } = useDialog()
  const t = useT()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [password, setPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [saving, setSaving] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('googleError')
    if (code) setError(t(GOOGLE_ERRORS[code] || GOOGLE_ERRORS.failed))
    // Cadastro com cópia no aparelho: sem sinal ou com sinal fraco, mostra a última cópia (só leitura)
    cachedGet<Profile>('cache_perfil', '/api/perfil').then(({ data, fromCache }) => {
      setProfile(data)
      setFromCache(fromCache)
    }).catch((e: Error) => setError(t(e.message || 'Não foi possível carregar o cadastro')))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!profile) return
    setError(''); setSuccess(false)
    if (password !== confirmation) { setError(t('As senhas não coincidem')); return }
    setSaving(true)
    try {
      const vendor = profile.vendor ? Object.fromEntries(Object.entries(profile.vendor).map(([key, value]) => [key, value ?? ''])) : null
      const res = await fetchWithTimeout('/api/perfil', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...profile, vendor, points: profile.milkPoints, password, currentPassword }) }).catch(() => null)
      if (!res) throw new Error(t('Sem internet. Esta ação precisa de conexão; tente de novo quando o sinal voltar.'))
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(t(data.error ?? 'Não foi possível salvar'))
      setPassword(''); setConfirmation(''); setCurrentPassword('')
      refresh()
      if (password) setProfile(p => p ? { ...p, hasPassword: true } : p)
      setSuccess(true)
    } catch (e) { setError(e instanceof Error ? e.message : t('Verifique sua conexão e tente novamente')) }
    finally { setSaving(false) }
  }

  // Aparelho emprestado ou de uso comum: sai e apaga tudo (dados, filas e a senha guardada para entrar sem internet)
  async function wipeAndLogout() {
    if (!(await confirm({ title: t('Sair e apagar os dados deste aparelho?'), message: t('Apaga as anotações guardadas, o que ainda não foi enviado e a senha guardada para entrar sem internet. Só faça isso com internet e com tudo enviado.'), confirmLabel: t('Sair e apagar'), danger: true }))) return
    await wipeDevice()
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    window.location.href = '/login'
  }

  const home = homeForRole(profile?.role)
  const input = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
  return <div className="mx-auto w-full max-w-xl px-4 py-6">
    <Link href={home} className="text-sm font-medium text-green-700">← {t('Voltar')}</Link>
    <h1 className="mt-4 text-2xl font-bold text-gray-900">{t('Meu cadastro')}</h1>
    {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}
    {fromCache && <p role="status" className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">{t('Sinal fraco ou sem internet: mostrando a última cópia guardada neste aparelho. Para alterar, é preciso conexão.')}</p>}
    {!profile ? <p className="mt-4 text-gray-500">{t(error ? 'Cadastro indisponível.' : 'Carregando...')}</p> :
      <form onSubmit={save} className="mt-5 rounded-xl border border-gray-200 bg-white p-5">
        <fieldset disabled={saving} className="flex flex-col gap-4 disabled:opacity-70">
          <legend className="mb-3 font-semibold">{t('Dados da conta')}</legend>
          <label>{t('Nome')}<input required autoComplete="name" className={input} value={profile.name} onChange={e => setProfile({ ...profile, name: e.target.value })} /></label>
          <label>{t('Telefone')}<input type="tel" inputMode="tel" autoComplete="tel" placeholder={t('(35) 99999-0000')} className={input} value={profile.phone ? maskPhone(profile.phone) : ''} onChange={e => setProfile({ ...profile, phone: e.target.value.replace(/\D/g, '') || null })} /></label>
          <label>{t('E-mail')} <span className="text-gray-400">({t('opcional')})</span><input type="email" autoComplete="email" className={input} value={profile.email ?? ''} onChange={e => setProfile({ ...profile, email: e.target.value || null })} /></label>
          <p className="-mt-2 text-xs text-gray-500">{t('Você entra com o telefone ou com o e-mail. Informe pelo menos um.')}</p>
          {profile.vendor && <fieldset className="flex flex-col gap-4">
            <legend className="mb-3 font-semibold">{t('Dados da empresa')}</legend>
            {Object.entries({ companyName: 'Nome da empresa', document: 'CPF/CNPJ', phone: 'Telefone', whatsapp: 'WhatsApp', city: 'Cidade', state: 'Estado', description: 'O que você vende' }).map(([key, label]) => <label key={key}>{t(label)}
              <input className={input} required={key === 'companyName' || key === 'phone'} maxLength={key === 'state' ? 2 : undefined} value={profile.vendor?.[key] ?? ''} onChange={e => setProfile({ ...profile, vendor: { ...profile.vendor, [key]: e.target.value } })} />
            </label>)}
          </fieldset>}
          {(profile.role === 'lite' || profile.role === 'motorista') && profile.milkPoints.length > 0 && <fieldset className="flex flex-col gap-4">
            <legend className="mb-3 font-semibold">{t(profile.role === 'motorista' ? 'Locais da rota' : 'Minha propriedade')}</legend>
            {profile.milkPoints.map((point, index) => <div key={point.id}>
              <label>{t('Nome do local')}<input required className={input} value={point.name} onChange={e => setProfile({ ...profile, milkPoints: profile.milkPoints.map((p, i) => i === index ? { ...p, name: e.target.value } : p) })} /></label>
              {profile.role === 'motorista' && <label className="mt-2 block">{t('Tipo')}<select className={input} value={point.kind} onChange={e => setProfile({ ...profile, milkPoints: profile.milkPoints.map((p, i) => i === index ? { ...p, kind: e.target.value } : p) })}><option value="sitio">{t('Sítio')}</option><option value="tanque">{t('Tanque comunitário')}</option></select></label>}
            </div>)}
          </fieldset>}
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 font-semibold">{t('Segurança')}</legend>
            <p className="text-sm text-gray-500">{t(profile.hasPassword ? 'Para alterar o e-mail ou a senha, informe sua senha atual. Deixe a nova senha vazia para manter a atual.' : 'Você usa o Google para entrar. Pode criar uma senha para também entrar com e-mail e senha.')}</p>
            {profile.hasPassword && <label>{t('Senha atual')}<PasswordInput autoComplete="current-password" className={input} value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} /></label>}
            <label>{t('Nova senha')}<PasswordInput autoComplete="new-password" minLength={6} className={input} value={password} onChange={e => setPassword(e.target.value)} /></label>
            <label>{t('Confirmar nova senha')}<PasswordInput autoComplete="new-password" className={input} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
          </fieldset>
          {profile.googleConnected ? <p className="text-sm text-green-700">{t('Conta Google conectada.')}</p> : <GoogleLoginButton link next={home === '/lite' ? '/lite/perfil' : '/perfil'} />}
          <button type="submit" className="rounded-lg bg-green-700 py-3 font-semibold text-white hover:bg-green-600">{t(saving ? 'Salvando...' : 'Salvar alterações')}</button>
        </fieldset>
        {success && <p role="status" className="mt-4 text-green-700">{t('Cadastro atualizado com sucesso.')}</p>}
      </form>}
    {profile && <section className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="font-semibold">{t('Este aparelho')}</h2>
      <p className="mt-1 text-sm text-gray-600">{t('Depois de entrar uma vez com internet, você entra sem sinal com a mesma senha, e o que anotar fica guardado até o sinal voltar. “Sair” no menu mantém isso. Num aparelho emprestado, apague tudo.')}</p>
      <button type="button" onClick={() => void wipeAndLogout()} className="mt-3 rounded-lg border border-red-300 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50">{t('Sair e apagar os dados deste aparelho')}</button>
    </section>}
  </div>
}
