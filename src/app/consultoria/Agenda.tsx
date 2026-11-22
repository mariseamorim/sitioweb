'use client'

// Agenda de visitas do veterinário, dentro do painel de Consultoria: as visitas marcadas, com marcar, remarcar,
// concluir e cancelar. O produtor vê as visitas da propriedade dele em "Meu veterinário".
import { useCallback, useEffect, useImperativeHandle, useState } from 'react'
import { todayISO } from '@/lib/utils'
import { useLocale, useT } from '@/lib/i18n'

interface Visit { id: string; clientId: string | null; farmName: string; date: string; time: string | null; purpose: string | null; status: string }
interface Form { id?: string; clientId: string; date: string; time: string; purpose: string }

/** Visitas visíveis antes de "Ver todas" */
const SHOWN = 4

const input = 'mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'

/** O topo da Consultoria abre o formulário de nova visita pelo botão "+ Marcar visita" */
export interface AgendaHandle {
  openNew: () => void
  /** Remarcar uma visita (pela Agenda nova) */
  edit: (visit: { id: string; date: string; time: string | null; purpose: string | null }) => void
  /** Concluir ou cancelar uma visita */
  setStatus: (id: string, status: 'realizada' | 'cancelada') => Promise<boolean>
}

export function Agenda({ clients, onChanged, ref, formOnly = false }: { clients: { id: string; name: string }[]; onChanged?: () => void; ref?: React.Ref<AgendaHandle>; formOnly?: boolean }) {
  const [upcoming, setUpcoming] = useState<Visit[] | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [all, setAll] = useState(false)
  const today = todayISO()
  const t = useT()
  const locale = useLocale()
  const weekday = (iso: string) => new Date(iso).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/veterinario/visitas')
      if (res.ok) setUpcoming((await res.json()).upcoming)
    } catch { /* sem internet: o painel já avisa */ }
  }, [])
  useEffect(() => { if (!formOnly) void load() }, [load, formOnly])
  const openNew = () => { setError(''); setForm({ clientId: clients[0]?.id ?? '', date: today, time: '', purpose: '' }) }
  useImperativeHandle(ref, () => ({
    openNew,
    edit: (v) => { setError(''); setForm({ id: v.id, clientId: '', date: v.date.slice(0, 10), time: v.time ?? '', purpose: v.purpose ?? '' }) },
    setStatus: (id, status) => send(`/api/veterinario/visitas/${id}`, 'PATCH', { status }),
  }))

  async function send(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
    setError('')
    setBusy(true)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
      if (!res.ok) { setError((await res.json().catch(() => ({}))).error || t('Não foi possível salvar.')); return false }
      await load()
      onChanged?.()
      return true
    } catch {
      setError(t('Erro de conexão. Tente novamente.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    const ok = form.id
      ? await send(`/api/veterinario/visitas/${form.id}`, 'PATCH', { date: form.date, time: form.time, purpose: form.purpose })
      : await send('/api/veterinario/visitas', 'POST', form)
    if (ok) setForm(null)
  }

  return (
    <section aria-label={t('Agenda de visitas')}>
      {!formOnly && <>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-gray-800">{t('Agenda de visitas')}</h2>
        <button type="button" disabled={!clients.length} onClick={openNew} className="rounded-lg border border-green-700 px-4 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:border-gray-300">{t('+ Marcar visita')}</button>
      </div>
      {error && !form && <p role="alert" className="mb-2 text-sm text-red-700">{error}</p>}
      {upcoming?.length === 0 && <p className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-500">{t('Nenhuma visita marcada.')}</p>}
      {!!upcoming?.length && (
        <ul className="overflow-hidden bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {(all ? upcoming : upcoming.slice(0, SHOWN)).map((v) => {
            const late = v.date.slice(0, 10) < today
            const isToday = v.date.slice(0, 10) === today
            return (
              <li key={v.id} className="relative flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 pl-5 pr-4">
                {/* Faixa à esquerda: hoje ou atrasada em laranja, as próximas em azul */}
                <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${late || isToday ? 'bg-amber-500' : 'bg-blue-500'}`} />
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">
                    <span className={late || isToday ? 'text-amber-700' : 'text-green-800'}>{isToday ? t('Hoje') : weekday(v.date)}{v.time ? ` · ${v.time}` : ''}</span> · {v.farmName}
                  </p>
                  <p className="text-sm text-gray-500">{[v.purpose, late ? t('já passou: conclua ou remarque') : null].filter(Boolean).join(' · ') || t('Sem motivo anotado')}</p>
                </div>
                <div className="-mx-1 flex flex-wrap items-center gap-1">
                  <button type="button" disabled={busy} onClick={() => send(`/api/veterinario/visitas/${v.id}`, 'PATCH', { status: 'realizada' })} className="rounded-full bg-green-800 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-green-400">{t('Concluir')}</button>
                  <button type="button" disabled={busy} onClick={() => { setError(''); setForm({ id: v.id, clientId: v.clientId ?? '', date: v.date.slice(0, 10), time: v.time ?? '', purpose: v.purpose ?? '' }) }} className="rounded-lg px-2 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100">{t('Remarcar')}</button>
                  <button type="button" disabled={busy} onClick={() => send(`/api/veterinario/visitas/${v.id}`, 'PATCH', { status: 'cancelada' })} className="rounded-lg px-2 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50">{t('Cancelar')}</button>
                </div>
              </li>
            )
          })}
          {upcoming.length > SHOWN && (
            <li><button type="button" onClick={() => setAll(!all)} className="w-full px-4 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-50">{all ? t('Mostrar menos') : t('Ver todas ({n})', { n: upcoming.length })}</button></li>
          )}
        </ul>
      )}
      </>}

      {form && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={t(form.id ? 'Remarcar visita' : 'Marcar visita')}>
          <form onSubmit={submit} className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6 flex flex-col gap-3">
            <h2 className="text-lg font-bold text-gray-900">{t(form.id ? 'Remarcar visita' : 'Marcar visita')}</h2>
            {!form.id && (
              <label className="text-sm font-medium text-gray-700">{t('Propriedade')} *
                <select value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })} required className={input}>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">{t('Dia')} *<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className={input} /></label>
              <label className="text-sm font-medium text-gray-700">{t('Horário')}<input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className={input} /></label>
            </div>
            <label className="text-sm font-medium text-gray-700">{t('Motivo')}<input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder={t('Diagnóstico de gestação, inseminação, vacinação…')} maxLength={200} className={input} /></label>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setForm(null)} className="flex-1 rounded-lg border border-gray-300 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50">{t('Fechar')}</button>
              <button type="submit" disabled={busy} className="flex-1 rounded-lg bg-green-700 py-3 text-base font-semibold text-white hover:bg-green-600 disabled:bg-green-400">{t(busy ? 'Salvando…' : form.id ? 'Remarcar' : 'Marcar visita')}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
