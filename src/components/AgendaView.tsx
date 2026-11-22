'use client'

// Agenda: visitas e manejos do rebanho por dia, com a faixa da semana (ou o mês), filtros por tipo e propriedade,
// ações rápidas e o envio da lista pelo WhatsApp. Usada pelo produtor (/agenda) e pelo veterinário (Consultoria).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AGENDA_KINDS, agendaShareText, countByDay, ddmm, groupAgenda, shiftDay, type AgendaItem, type AgendaKind } from '@/lib/agenda'
import { useLocale, useT } from '@/lib/i18n'
import { CalendarioIcon, LeiteIcon, PropriedadeIcon, ReproducaoIcon, TratamentoIcon, VacinaIcon, WhatsAppLineIcon } from '@/components/ModuleIcons'

type IconType = (p: { className?: string }) => React.ReactElement
const KIND_STYLE: Record<AgendaKind, { Icon: IconType; circle: string; bar: string }> = {
  visita: { Icon: PropriedadeIcon, circle: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500' },
  vacina: { Icon: VacinaIcon, circle: 'bg-teal-100 text-teal-700', bar: 'bg-teal-500' },
  parto: { Icon: ReproducaoIcon, circle: 'bg-purple-100 text-purple-700', bar: 'bg-purple-500' },
  secagem: { Icon: LeiteIcon, circle: 'bg-amber-100 text-amber-700', bar: 'bg-amber-500' },
  preparto: { Icon: ReproducaoIcon, circle: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500' },
  diagnostico: { Icon: ReproducaoIcon, circle: 'bg-sky-100 text-sky-700', bar: 'bg-sky-500' },
  cio: { Icon: ReproducaoIcon, circle: 'bg-pink-100 text-pink-700', bar: 'bg-pink-500' },
  carencia: { Icon: TratamentoIcon, circle: 'bg-red-100 text-red-700', bar: 'bg-red-500' },
}

/** Tela de cada tipo, para o botão "Abrir" */
export function agendaHref(item: AgendaItem, vet: boolean): string {
  switch (item.kind) {
    case 'vacina': return '/vacinacao'
    case 'parto': case 'secagem': case 'preparto': return '/reproducao?filtro=partos'
    case 'diagnostico': case 'cio': return '/reproducao'
    case 'carencia': return '/veterinary-treatment'
    case 'visita': return vet ? '/consultoria' : '/meu-veterinario'
  }
}

/** Segunda-feira da semana do dia */
const weekStartOf = (day: string) => shiftDay(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7))

export function AgendaView({ endpoint, vet = false, clients, onOpen, onVisit, canApplyVaccine = false, refreshKey = 0, title }: {
  endpoint: string
  vet?: boolean
  /** Veterinário: propriedades para o filtro */
  clients?: { farmId: string | null; name: string }[]
  onOpen: (item: AgendaItem, href: string) => void
  /** Veterinário: concluir, remarcar ou cancelar a visita */
  onVisit?: (item: AgendaItem, action: 'concluir' | 'remarcar' | 'cancelar') => void
  /** Produtor: marcar a vacina como aplicada pela agenda */
  canApplyVaccine?: boolean
  /** Muda para recarregar (depois de marcar ou concluir uma visita) */
  refreshKey?: number
  title?: React.ReactNode
}) {
  const t = useT()
  const locale = useLocale()
  const [data, setData] = useState<{ today: string; items: AgendaItem[] } | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [view, setView] = useState<'semana' | 'mes'>('semana')
  const [selected, setSelected] = useState<string | null>(null)
  const [weekStart, setWeekStart] = useState<string | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [kind, setKind] = useState<AgendaKind | ''>('')
  const [farm, setFarm] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(endpoint)
      if (!res.ok) throw new Error()
      setData(await res.json())
      setError('')
    } catch {
      setError(t('Não foi possível carregar a agenda. Confira a internet e tente de novo.'))
    }
  }, [endpoint, t])
  useEffect(() => { void load() }, [load, refreshKey])

  const today = data?.today ?? new Date().toISOString().slice(0, 10)
  const week = weekStart ?? weekStartOf(today)
  const monthStart = month ?? `${today.slice(0, 7)}-01`
  const filtered = useMemo(() => (data?.items ?? []).filter((i) => (!kind || i.kind === kind) && (!farm || i.farmId === farm)), [data, kind, farm])
  const counts = useMemo(() => countByDay(filtered), [filtered])
  const lateCount = filtered.filter((i) => i.late).length
  const kindsPresent = AGENDA_KINDS.filter((k) => data?.items.some((i) => i.kind === k.kind))
  const shown = selected ? filtered.filter((i) => i.date === selected) : filtered
  const groups = selected ? [{ key: 'dia', label: '', items: shown }] : groupAgenda(shown, today)

  const fmtWeekday = (day: string, opts: Intl.DateTimeFormatOptions) => new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', ...opts })
  const dayTitle = (day: string) => day === today ? t('Hoje') : day === shiftDay(today, 1) ? t('Amanhã') : fmtWeekday(day, { weekday: 'long', day: '2-digit', month: '2-digit' })

  function share() {
    const list = selected ? shown : filtered.filter((i) => i.date <= shiftDay(today, 7))
    const heading = selected ? t('Agenda de {date}', { date: dayTitle(selected) }) : t('Agenda dos próximos 7 dias')
    const text = list.length ? agendaShareText(list, heading, t) : `*${heading}*\n${t('Nada marcado.')}`
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener')
  }

  async function applyVaccine(item: AgendaItem) {
    setBusy(item.key)
    try {
      const res = await fetch(`/api/vacinacao/${item.refId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appliedDate: today }) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error)
      setData((d) => d && { ...d, items: d.items.filter((i) => i.key !== item.key) })
    } catch (err) {
      setError(t((err as Error).message || 'Não foi possível salvar.'))
    } finally {
      setBusy('')
    }
  }

  const days = Array.from({ length: 7 }, (_, i) => shiftDay(week, i))
  const monthDays = (() => {
    const first = weekStartOf(monthStart)
    const next = shiftDay(`${monthStart.slice(0, 7)}-28`, 4).slice(0, 7)
    const cells: string[] = []
    for (let d = first; cells.length < 42; d = shiftDay(d, 1)) { cells.push(d); if (cells.length % 7 === 0 && shiftDay(d, 1).slice(0, 7) >= next) break }
    return cells
  })()
  const weekdayNames = days.map((d) => fmtWeekday(d, { weekday: 'short' }).replace('.', ''))

  const dayButton = (day: string, compact: boolean) => {
    const n = counts.get(day) ?? 0
    const active = selected === day
    const isToday = day === today
    const outside = compact && day.slice(0, 7) !== monthStart.slice(0, 7)
    return (
      <button key={day} type="button" onClick={() => setSelected(active ? null : day)} aria-pressed={active}
        aria-label={`${dayTitle(day)}: ${n === 1 ? t('1 tarefa') : t('{n} tarefas', { n })}`}
        className={`flex flex-col items-center rounded-xl border px-1 ${compact ? 'py-1.5' : 'py-2.5'} ${active ? 'border-green-700 bg-green-700 text-white' : isToday ? 'border-green-600 bg-green-50 text-green-900' : 'border-gray-200 bg-white text-gray-800 hover:bg-gray-50'} ${outside ? 'opacity-40' : ''}`}>
        {!compact && <span className={`text-xs font-medium uppercase ${active ? 'text-green-100' : 'text-gray-500'}`}>{fmtWeekday(day, { weekday: 'short' }).replace('.', '')}</span>}
        <span className={`${compact ? 'text-sm' : 'text-lg'} font-bold`}>{Number(day.slice(8, 10))}</span>
        <span className={`mt-0.5 h-5 min-w-5 rounded-full px-1.5 text-xs font-bold leading-5 ${n ? (active ? 'bg-white text-green-800' : 'bg-green-700 text-white') : 'text-transparent'}`}>{n || '·'}</span>
      </button>
    )
  }

  return (
    <section aria-label={t('Agenda')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        {title ?? <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800"><CalendarioIcon className="h-5 w-5 text-green-700" />{t('Agenda')}</h2>}
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg border border-gray-300 bg-white p-0.5" role="group" aria-label={t('Ver por')}>
            {(['semana', 'mes'] as const).map((v) => (
              <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v} className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === v ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>{t(v === 'semana' ? 'Semana' : 'Mês')}</button>
            ))}
          </div>
          <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-lg border-2 border-green-700 bg-white px-3 py-1.5 text-sm font-semibold text-green-800 hover:bg-green-50">
            <WhatsAppLineIcon className="h-4 w-4" />{t('Enviar pelo WhatsApp')}
          </button>
        </div>
      </div>

      {/* Semana (ou mês) com a quantidade de tarefas de cada dia */}
      <div className="rounded-xl border border-gray-200 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <button type="button" aria-label={t(view === 'semana' ? 'Semana anterior' : 'Mês anterior')} onClick={() => view === 'semana' ? setWeekStart(shiftDay(week, -7)) : setMonth(`${shiftDay(monthStart, -1).slice(0, 7)}-01`)} className="rounded-lg px-3 py-1.5 text-xl leading-none text-gray-600 hover:bg-gray-100">‹</button>
          <p className="text-sm font-semibold capitalize text-gray-700">
            {view === 'semana' ? `${ddmm(days[0])} – ${ddmm(days[6])}` : fmtWeekday(`${monthStart.slice(0, 7)}-15`, { month: 'long', year: 'numeric' })}
          </p>
          <button type="button" aria-label={t(view === 'semana' ? 'Próxima semana' : 'Próximo mês')} onClick={() => view === 'semana' ? setWeekStart(shiftDay(week, 7)) : setMonth(`${shiftDay(monthStart, 32).slice(0, 7)}-01`)} className="rounded-lg px-3 py-1.5 text-xl leading-none text-gray-600 hover:bg-gray-100">›</button>
        </div>
        {view === 'semana' ? (
          <div className="grid grid-cols-7 gap-1.5">{days.map((d) => dayButton(d, false))}</div>
        ) : (
          <>
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase text-gray-500">{weekdayNames.map((w) => <span key={w}>{w}</span>)}</div>
            <div className="grid grid-cols-7 gap-1">{monthDays.map((d) => dayButton(d, true))}</div>
          </>
        )}
      </div>

      {/* Filtros */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => setKind('')} aria-pressed={!kind} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${!kind ? 'bg-gray-800 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>{t('Tudo')}</button>
        {kindsPresent.map((k) => (
          <button key={k.kind} type="button" onClick={() => setKind(kind === k.kind ? '' : k.kind)} aria-pressed={kind === k.kind}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${kind === k.kind ? 'bg-gray-800 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${KIND_STYLE[k.kind].bar}`} />{t(k.label)}
          </button>
        ))}
        {vet && clients && clients.length > 1 && (
          <select value={farm} onChange={(e) => setFarm(e.target.value)} aria-label={t('Propriedade')} className="ml-auto rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm">
            <option value="">{t('Todas as propriedades')}</option>
            {clients.filter((c) => c.farmId).map((c) => <option key={c.farmId} value={c.farmId!}>{c.name}</option>)}
          </select>
        )}
      </div>

      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="mt-3 text-sm text-gray-500">{t('Carregando…')}</p>}

      {selected && (
        <div className="mt-4 flex items-center justify-between gap-2">
          <h3 className="font-semibold capitalize text-gray-800">{dayTitle(selected)}</h3>
          <button type="button" onClick={() => setSelected(null)} className="text-sm font-semibold text-green-800 hover:underline">{t('Ver todos os dias')}</button>
        </div>
      )}
      {!selected && lateCount > 0 && <p className="mt-3 text-sm font-semibold text-red-700">{lateCount === 1 ? t('1 tarefa atrasada') : t('{n} tarefas atrasadas', { n: lateCount })}</p>}

      {data && !shown.length && (
        <p className="mt-3 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500">{t(selected ? 'Nada marcado para este dia.' : 'Nada na agenda. As vacinas, coberturas e tratamentos anotados aparecem aqui com a data de cada manejo.')}</p>
      )}

      {groups.map((g) => (
        <div key={g.key} className="mt-4">
          {g.label && <h3 className={`mb-2 text-sm font-bold uppercase tracking-wide ${g.key === 'atrasados' ? 'text-red-700' : 'text-gray-500'}`}>{t(g.label)} <span className="font-semibold">({g.items.length})</span></h3>}
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {g.items.map((item) => {
              const style = KIND_STYLE[item.kind]
              const href = agendaHref(item, vet)
              return (
                <li key={item.key} className="relative flex flex-wrap items-center gap-3 py-3 pl-5 pr-3">
                  <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 ${item.late ? 'bg-red-500' : style.bar}`} />
                  <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${style.circle}`}><style.Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{t(item.label, item.vars)}</p>
                    <p className="text-sm text-gray-500">
                      {[
                        !selected && g.key !== 'hoje' ? (item.late ? t('era {date}', { date: ddmm(item.date) }) : dayTitle(item.date)) : null,
                        item.time,
                        item.detail ? t(item.detail, item.detailVars) : null,
                        vet && item.kind !== 'visita' ? item.farmName : null,
                      ].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {item.kind === 'vacina' && canApplyVaccine && (
                      <button type="button" disabled={busy === item.key} onClick={() => void applyVaccine(item)} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:bg-gray-300">{t('Aplicada')}</button>
                    )}
                    {item.kind === 'visita' && onVisit ? (
                      <>
                        <button type="button" onClick={() => onVisit(item, 'concluir')} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600">{t('Concluir')}</button>
                        <button type="button" onClick={() => onVisit(item, 'remarcar')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Remarcar')}</button>
                        <button type="button" onClick={() => onVisit(item, 'cancelar')} className="rounded-lg px-2 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">{t('Cancelar')}</button>
                      </>
                    ) : (
                      <button type="button" onClick={() => onOpen(item, href)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Abrir')} ›</button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </section>
  )
}
