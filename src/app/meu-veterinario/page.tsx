'use client'

// Produtor: libera a propriedade aberta para um veterinário consultor (pelo código dele) e encerra o acesso quando quiser.
import { useCallback, useEffect, useState } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { useUser } from '@/contexts/UserContext'
import { useLocale, useT } from '@/lib/i18n'
import { CadeadoIcon, CheckIcon } from '@/components/ModuleIcons'

// Estado vazio: pessoa com estetoscópio, em traço simples
function VetIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="7" r="3.5" />
      <path d="M5 21v-1.5A5.5 5.5 0 0110.5 14h3a5.5 5.5 0 015.5 5.5V21" />
      <path d="M9 14.3v2.2a3 3 0 006 0v-2.2" />
      <circle cx="12" cy="20.5" r="1" />
    </svg>
  )
}

interface Visit { id: string; date: string; time: string | null; purpose: string | null; vet: string }
interface Vet { id: string; name: string; phone: string | null; crmv: string | null; city: string | null; state: string | null; since: string }

export default function MeuVeterinarioPage() {
  const { user } = useUser()
  const { confirm, notify } = useDialog()
  const t = useT()
  const locale = useLocale()
  const [vets, setVets] = useState<Vet[] | null>(null)
  const [visits, setVisits] = useState<Visit[]>([])
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const canEdit = (user?.role === 'admin' || user?.role === 'editor') && !user?.vet

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/meu-veterinario')
      if (res.ok) setVets(await res.json())
      else setError((await res.json().catch(() => ({}))).error || t('Não foi possível carregar.'))
    } catch {
      setError(t('Sem internet. Esta tela precisa de conexão.'))
    }
  }, [t])
  useEffect(() => { void load() }, [load])
  // Visitas que o veterinário marcou para esta propriedade (sem internet a lista só não aparece)
  useEffect(() => {
    fetch('/api/meu-veterinario/visitas').then(async (res) => { if (res.ok) setVisits(await res.json()) }).catch(() => {})
  }, [])
  // Link enviado pelo veterinário: /meu-veterinario?codigo=XXXXXXXX já deixa o código no campo
  useEffect(() => { setCode(new URLSearchParams(window.location.search).get('codigo')?.toUpperCase() ?? '') }, [])

  async function link(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setMessage(''); setSaving(true)
    try {
      const res = await fetch('/api/meu-veterinario', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || t('Não foi possível liberar o acesso.'))
      setCode('')
      setMessage(t('{name} agora acompanha {farm}.', { name: data.name, farm: user?.farmName ?? t('a propriedade') }))
      await load()
    } catch {
      setError(t('Erro de conexão. Tente novamente.'))
    } finally {
      setSaving(false)
    }
  }

  async function end(vet: Vet) {
    const ok = await confirm({
      title: t('Encerrar o acesso de {name}?', { name: vet.name }),
      message: t('O veterinário deixa de ver e de lançar na propriedade. Ele fica com uma cópia do que ele mesmo lançou (coberturas e diagnósticos); os dados da propriedade continuam com você.'),
      confirmLabel: t('Encerrar acesso'),
    })
    if (!ok) return
    const res = await fetch(`/api/meu-veterinario/${vet.id}`, { method: 'DELETE' })
    if (!res.ok) return notify(t('Não foi possível encerrar'), (await res.json().catch(() => ({}))).error)
    await load()
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-800">{t('Meu veterinário')}</h1>
      <p className="text-gray-500 mt-1">
        {t('O veterinário que você liberar vê e lança animais, reprodução, vacinas, tratamentos e leite de {farm}.', { farm: user?.farmName ?? t('sua propriedade') })}
      </p>
      {/* O que o veterinário vê (verde) e o que fica só com o produtor (vermelho) */}
      <div className="mt-3 mb-6 flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
          <CheckIcon className="w-3.5 h-3.5" />
          {t('Vê animais, reprodução, vacinas, tratamentos e leite')}
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
          <CadeadoIcon className="w-3.5 h-3.5" />
          {t('Não vê financeiro nem estoque')}
        </span>
      </div>

      {user?.vet ? <p className="mb-6 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-900">{t('Só o produtor libera ou encerra o acesso do veterinário.')}</p> : canEdit && (
        <form onSubmit={link} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5 mb-6">
          <label className="text-sm font-medium text-gray-700">{t('Código do veterinário')}
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required maxLength={8} placeholder={t('8 letras e números')} autoCapitalize="characters"
              className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-lg font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-green-600" />
          </label>
          <p className="mt-1 text-sm text-gray-500">{t('Peça o código ao seu veterinário; ele aparece no painel de consultoria dele.')}</p>
          {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
          {message && <p role="status" className="mt-2 text-sm text-green-700">{message}</p>}
          <button type="submit" disabled={saving || code.length < 8} className="mt-3 w-full sm:w-auto rounded-lg bg-green-800 px-5 py-2.5 text-base font-semibold text-white hover:bg-green-700 disabled:bg-green-400">{t(saving ? 'Liberando…' : 'Liberar a propriedade')}</button>
        </form>
      )}

      {visits.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">{t('Próximas visitas')}</h2>
          <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {visits.map((v) => (
              <li key={v.id} className="px-4 py-3">
                <p className="font-medium text-gray-900">{new Date(v.date).toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: '2-digit', timeZone: 'UTC' })}{v.time ? ` · ${v.time}` : ''}</p>
                <p className="text-sm text-gray-500">{[v.vet, v.purpose].filter(Boolean).join(' · ')}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="text-lg font-semibold text-gray-800 mb-2">{t('Quem acompanha a propriedade')}</h2>
      {vets === null ? <p className="text-gray-500">{error && !canEdit ? error : t('Carregando…')}</p> : vets.length === 0 ? (
        <div className="flex flex-col items-center bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-10 text-center">
          <VetIcon className="w-14 h-14 text-gray-300" />
          <p className="mt-3 font-bold text-gray-800">{t('Nenhum veterinário acompanha esta propriedade.')}</p>
          {canEdit && <p className="mt-1 text-sm text-gray-500">{t('Informe o código de 8 caracteres para vincular.')}</p>}
        </div>
      ) : (
        <ul className="bg-white rounded-xl border border-gray-200 shadow-sm divide-y divide-gray-100">
          {vets.map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">{v.name}</p>
                <p className="text-sm text-gray-500 truncate">{[v.crmv, [v.city, v.state].filter(Boolean).join(', '), v.phone].filter(Boolean).join(' · ') || t('Veterinário')} · {t('desde')} {new Date(v.since).toLocaleDateString(locale)}</p>
              </div>
              {canEdit && <button type="button" onClick={() => end(v)} className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">{t('Encerrar acesso')}</button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
