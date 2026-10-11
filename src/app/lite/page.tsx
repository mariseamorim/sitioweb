'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useDialog } from '@/components/DialogProvider'
import { SetaDireitaIcon, SemSinalIcon, SincronizarIcon, CheckIcon } from '@/components/ModuleIcons'
import { KIND_LABEL, LiteChange, LiteData, LitePoint, PointKind, isDriverRole, isLiteOnlyRole, parseLiters } from '@/lib/lite'
import { applyChanges, enqueue, pendingChanges, readCache, syncLite, writeCache } from '@/lib/liteStore'
import { exportCSV } from '@/lib/reportExport'
import { fmtNumber } from '@/lib/reports'
import { todayISO } from '@/lib/utils'

type Tab = 'anotar' | 'historico' | 'locais'

function shiftDay(iso: string, days: number) {
  const d = new Date(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

const fmtDay = (iso: string, opts: Intl.DateTimeFormatOptions = {}) =>
  new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC', ...opts })

const input = 'w-full border border-gray-300 rounded-xl px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-600'

export default function LitePage() {
  const { confirm, notify } = useDialog()
  const [data, setData] = useState<LiteData | null>(null)
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [needsLogin, setNeedsLogin] = useState(false)
  const [tab, setTab] = useState<Tab>('anotar')
  const [date, setDate] = useState(todayISO())
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [message, setMessage] = useState('')

  const today = todayISO()

  const sync = useCallback(async () => {
    setSyncing(true)
    const { data: fresh, result } = await syncLite()
    if (fresh) setData(fresh)
    setNeedsLogin(result === 'auth' && navigator.onLine)
    setPending(pendingChanges().length)
    setSyncing(false)
  }, [])

  useEffect(() => {
    // Abre na hora com o que está no aparelho; depois atualiza pela internet.
    // (Lido após a montagem para o HTML do servidor e o do navegador serem iguais.)
    void Promise.resolve().then(() => {
      const cached = readCache()
      if (cached) setData(applyChanges(cached, pendingChanges()))
      setPending(pendingChanges().length)
      setOnline(navigator.onLine)
      return sync()
    })

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/lite-sw.js', { scope: '/lite' }).catch(() => {})

    const goOnline = () => { setOnline(true); void sync() }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [sync])

  const activePoints = useMemo(() => (data?.points ?? []).filter((p) => p.active), [data])
  // Motorista anota a rota (vários locais); produtor anota só a própria produção
  const driver = isDriverRole(data?.role)
  const single = !driver && activePoints.length === 1 ? activePoints[0] : null
  const tabs = driver
    ? ([['anotar', 'Anotar'], ['historico', 'Histórico'], ['locais', 'Rota']] as const)
    : ([['anotar', 'Anotar'], ['historico', 'Histórico']] as const)
  const saved = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of data?.entries ?? []) if (e.date === date) map.set(e.pointId, e.liters)
    return map
  }, [data, date])

  const valueOf = (pointId: string) => {
    const draft = drafts[`${date}|${pointId}`]
    if (draft !== undefined) return draft
    const v = saved.get(pointId)
    return v === undefined ? '' : String(v).replace('.', ',')
  }

  const changes: LiteChange[] = activePoints.flatMap((p) => {
    const draft = drafts[`${date}|${p.id}`]
    if (draft === undefined) return []
    const liters = parseLiters(draft)
    return liters === (saved.get(p.id) ?? null) ? [] : [{ pointId: p.id, date, liters }]
  })
  const dayTotal = activePoints.reduce((s, p) => s + (parseLiters(valueOf(p.id)) ?? 0), 0)

  async function save() {
    if (!data || changes.length === 0) return
    enqueue(changes)
    setData(applyChanges(data, changes))
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !k.startsWith(`${date}|`))))
    setPending(pendingChanges().length)
    // O aparelho pode dizer que está online sem o sinal chegar: a mensagem segue o resultado do envio
    if (navigator.onLine) await sync()
    setMessage(pendingChanges().length ? 'Salvo no celular. Será enviado quando houver internet.' : 'Salvo e enviado.')
    setTimeout(() => setMessage(''), 4000)
  }

  async function logout() {
    if (pendingChanges().length > 0) {
      await notify('Ainda há anotações não enviadas', 'Conecte-se à internet para enviá-las antes de sair, senão elas se perdem.')
      return
    }
    if (!(await confirm({ title: 'Sair do Anota Aí Leite?', confirmLabel: 'Sair' }))) return
    try { localStorage.clear() } catch {}
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    window.location.href = '/login?next=/lite'
  }

  const status = !online
    ? { icon: <SemSinalIcon className="w-4 h-4" />, text: pending ? `Sem sinal · ${pending} para enviar` : 'Sem sinal', style: 'bg-amber-100 text-amber-800' }
    : pending
      ? { icon: <SincronizarIcon className="w-4 h-4" />, text: syncing ? 'Enviando...' : `${pending} para enviar`, style: 'bg-blue-100 text-blue-800' }
      : { icon: <CheckIcon className="w-4 h-4" />, text: 'Tudo enviado', style: 'bg-green-100 text-green-800' }

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="mx-auto max-w-xl px-4 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Image src="/anota-ai-agro-logo.png" width={132} height={38} alt="Anota Aí Leite" className="h-auto w-24 shrink-0" />
          </div>
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${status.style}`} role="status">
            {status.icon}{status.text}
          </span>
        </div>
        <nav className={`mx-auto max-w-xl px-4 pb-2 grid gap-1 ${tabs.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`} aria-label="Seções">
          {tabs.map(([t, label]) => (
            <button key={t} type="button" onClick={() => setTab(t)} aria-current={tab === t ? 'page' : undefined}
              className={`py-2.5 rounded-lg text-sm font-semibold ${tab === t ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-xl px-4 py-5 pb-32">
        {needsLogin && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
            <p className="font-semibold">Entre de novo para enviar as anotações</p>
            <Link href="/login?next=/lite" className="mt-2 inline-block font-semibold text-green-800 underline">Entrar</Link>
          </div>
        )}

        {!data ? (
          <p className="py-16 text-center text-gray-500">{online ? 'Carregando...' : 'Sem internet. Abra o app uma vez com internet para começar.'}</p>
        ) : tab === 'anotar' ? (
          activePoints.length === 0 ? (
            <FirstPoint driver={driver} online={online} onCreated={() => void sync()} />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setDate(shiftDay(date, -1))} aria-label="Dia anterior"
                  className="h-12 w-12 shrink-0 rounded-xl border border-gray-300 bg-white flex items-center justify-center text-gray-700">
                  <SetaDireitaIcon className="w-5 h-5 rotate-180" />
                </button>
                <label className="flex-1">
                  <span className="sr-only">Data</span>
                  <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)}
                    className={`${input} text-center font-semibold`} />
                </label>
                <button type="button" onClick={() => setDate(shiftDay(date, 1))} disabled={date >= today} aria-label="Próximo dia"
                  className="h-12 w-12 shrink-0 rounded-xl border border-gray-300 bg-white flex items-center justify-center text-gray-700 disabled:opacity-30">
                  <SetaDireitaIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-2 text-center text-sm text-gray-500">
                {date === today ? 'Hoje' : fmtDay(date, { weekday: 'long' })}
                {date !== today && <button type="button" onClick={() => setDate(today)} className="ml-2 font-semibold text-green-700 underline">Voltar para hoje</button>}
              </p>

              {single ? (
                <label className="mt-5 block bg-white rounded-2xl border border-gray-200 p-5 text-center">
                  <span className="block text-sm font-medium text-gray-500">{single.name}</span>
                  <span className="mt-1 block text-lg font-semibold text-gray-900">Leite do dia</span>
                  <span className="mt-4 flex items-center justify-center gap-2">
                    <input type="text" inputMode="decimal" placeholder="0" value={valueOf(single.id)} autoFocus
                      onChange={(e) => setDrafts({ ...drafts, [`${date}|${single.id}`]: e.target.value.replace(/[^\d.,]/g, '') })}
                      aria-label={`Litros de ${single.name}`}
                      className="w-44 border border-gray-300 rounded-2xl px-4 py-4 !text-5xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-green-600" />
                    <span className="text-2xl text-gray-500">L</span>
                  </span>
                </label>
              ) : (
              <ul className="mt-5 space-y-3">
                {activePoints.map((p) => (
                  <li key={p.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                    <label className="flex items-center gap-3">
                      <span className="flex-1 min-w-0">
                        <span className="block text-lg font-semibold text-gray-900 truncate">{p.name}</span>
                        {p.kind === 'tanque' && <span className="text-xs font-medium text-gray-500">{KIND_LABEL.tanque}</span>}
                      </span>
                      <span className="flex items-center gap-2 shrink-0">
                        <input type="text" inputMode="decimal" placeholder="0" value={valueOf(p.id)}
                          onChange={(e) => setDrafts({ ...drafts, [`${date}|${p.id}`]: e.target.value.replace(/[^\d.,]/g, '') })}
                          aria-label={`Litros de ${p.name}`}
                          className="w-28 border border-gray-300 rounded-xl px-3 py-3 !text-2xl font-semibold text-right focus:outline-none focus:ring-2 focus:ring-green-600" />
                        <span className="text-lg text-gray-500">L</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              )}
            </>
          )
        ) : tab === 'historico' ? (
          <History data={data} />
        ) : driver ? (
          <Points data={data} online={online} onChanged={(d) => { setData(d); writeCache(d) }} onSync={() => void sync()} />
        ) : null}

        {data && (
          <footer className="mt-10 flex flex-col items-center gap-3 text-sm text-gray-500">
            <p>{data.userName}</p>
            <div className="flex gap-4">
              {!isLiteOnlyRole(data.role) && <Link href="/" className="font-medium text-green-700 underline">Abrir app completo</Link>}
              <button type="button" onClick={logout} className="font-medium text-gray-600 underline">Sair</button>
            </div>
          </footer>
        )}
      </main>

      {tab === 'anotar' && activePoints.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="mx-auto max-w-xl px-4 py-3 flex items-center gap-4">
            {!single && (
              <div className="shrink-0">
                <p className="text-xs text-gray-500">Total do dia</p>
                <p className="text-2xl font-bold text-green-800">{fmtNumber(dayTotal)} L</p>
              </div>
            )}
            <button type="button" onClick={save} disabled={changes.length === 0}
              className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white text-lg font-bold py-4 rounded-xl">
              {changes.length === 0 ? 'Salvo' : online ? 'Salvar' : 'Salvar no celular'}
            </button>
          </div>
          {message && <p role="status" className="pb-3 text-center text-sm font-medium text-green-800">{message}</p>}
        </div>
      )}
    </div>
  )
}

// ── Primeiro local ──────────────────────────────────────────────────────

function FirstPoint({ driver, online, onCreated }: { driver: boolean; online: boolean; onCreated: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h1 className="text-xl font-bold text-gray-900">{driver ? 'Monte sua rota' : 'Qual o nome do seu sítio?'}</h1>
      <p className="mt-1 text-gray-600">
        {driver
          ? 'Cadastre os sítios e tanques comunitários onde você recolhe o leite. Comece pelo primeiro.'
          : 'É só para aparecer nas suas anotações e na planilha.'}
      </p>
      <div className="mt-4"><PointForm online={online} chooseKind={driver} onSaved={onCreated} /></div>
    </div>
  )
}

function PointForm({ online, point, chooseKind = true, onSaved, onCancel }: {
  online: boolean
  point?: LitePoint
  /** Motorista escolhe entre sítio e tanque comunitário; produtor anota sempre o próprio sítio */
  chooseKind?: boolean
  onSaved: (p: LitePoint) => void
  onCancel?: () => void
}) {
  const [name, setName] = useState(point?.name ?? '')
  const [kind, setKind] = useState<PointKind>(point?.kind ?? 'sitio')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch(point ? `/api/lite/locais/${point.id}` : '/api/lite/locais', {
        method: point ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, kind }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Não foi possível salvar')
      if (!point) setName('')
      onSaved(data)
    } catch {
      setError('Sem internet. Para cadastrar locais é preciso estar conectado.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="text-sm font-medium text-gray-700">Nome
        <input value={name} onChange={(e) => setName(e.target.value)} required
          placeholder={chooseKind ? 'Ex.: Sítio do João ou Tanque da Ponte' : 'Ex.: Sítio Boa Vista'} className={`mt-1 ${input}`} />
      </label>
      {chooseKind && (
        <div className="grid grid-cols-2 gap-2">
          {(['sitio', 'tanque'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)} aria-pressed={kind === k}
              className={`py-3 rounded-xl border-2 text-sm font-semibold ${kind === k ? 'border-green-700 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      )}
      {!online && <p className="text-sm text-amber-700">Para cadastrar locais é preciso estar com internet.</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl">Cancelar</button>}
        <button type="submit" disabled={saving || !online} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl">
          {saving ? 'Salvando...' : point ? 'Salvar' : chooseKind ? 'Adicionar local' : 'Começar a anotar'}
        </button>
      </div>
    </form>
  )
}

// ── Locais ──────────────────────────────────────────────────────────────

function Points({ data, online, onChanged, onSync }: {
  data: LiteData
  online: boolean
  onChanged: (d: LiteData) => void
  onSync: () => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const upsert = (p: LitePoint) => {
    const exists = data.points.some((x) => x.id === p.id)
    onChanged({ ...data, points: exists ? data.points.map((x) => (x.id === p.id ? p : x)) : [...data.points, p] })
    setEditing(null)
    setAdding(false)
    onSync()
  }

  async function toggle(p: LitePoint) {
    const res = await fetch(`/api/lite/locais/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !p.active }),
    }).catch(() => null)
    if (res?.ok) upsert(await res.json())
  }

  const active = data.points.filter((p) => p.active)
  const archived = data.points.filter((p) => !p.active)

  return (
    <div>
      <ul className="space-y-2">
        {active.map((p) => (
          <li key={p.id} className="bg-white rounded-2xl border border-gray-200 p-4">
            {editing === p.id ? (
              <PointForm online={online} point={p} onSaved={upsert} onCancel={() => setEditing(null)} />
            ) : (
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                  <p className="text-sm text-gray-500">{KIND_LABEL[p.kind]}</p>
                </div>
                <button type="button" onClick={() => setEditing(p.id)} disabled={!online} className="text-sm font-semibold text-green-700 disabled:text-gray-300">Editar</button>
                <button type="button" onClick={() => toggle(p)} disabled={!online} className="text-sm font-semibold text-gray-600 disabled:text-gray-300">Arquivar</button>
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        {adding ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-4"><PointForm online={online} onSaved={upsert} onCancel={() => setAdding(false)} /></div>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="w-full border-2 border-dashed border-gray-300 text-gray-700 font-semibold py-4 rounded-2xl hover:bg-white">
            + Adicionar local
          </button>
        )}
      </div>

      {archived.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Arquivados</h2>
          <p className="text-sm text-gray-500 mb-2">Não aparecem na anotação, mas o histórico fica guardado.</p>
          <ul className="space-y-2">
            {archived.map((p) => (
              <li key={p.id} className="flex items-center gap-3 bg-white rounded-xl border border-gray-200 px-4 py-3">
                <span className="flex-1 text-gray-700">{p.name}</span>
                <button type="button" onClick={() => toggle(p)} disabled={!online} className="text-sm font-semibold text-green-700 disabled:text-gray-300">Reativar</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ── Histórico ───────────────────────────────────────────────────────────

function History({ data }: { data: LiteData }) {
  const [days, setDays] = useState(7)
  const [pointId, setPointId] = useState('') // '' = todos os locais
  const today = todayISO()
  const from = shiftDay(today, -(days - 1))
  const names = new Map(data.points.map((p) => [p.id, p.name]))
  const selected = data.points.find((p) => p.id === pointId)

  const inPeriod = data.entries.filter((e) => e.date >= from && e.date <= today)
  const entries = pointId ? inPeriod.filter((e) => e.pointId === pointId) : inPeriod

  const byDay = new Map<string, { total: number; parts: { pointId: string; liters: number }[] }>()
  for (const e of entries) {
    const d = byDay.get(e.date) ?? { total: 0, parts: [] }
    d.total += e.liters
    d.parts.push({ pointId: e.pointId, liters: e.liters })
    byDay.set(e.date, d)
  }
  const byPoint = new Map<string, number>()
  for (const e of inPeriod) byPoint.set(e.pointId, (byPoint.get(e.pointId) ?? 0) + e.liters)

  const dayList = [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  const total = entries.reduce((s, e) => s + e.liters, 0)
  const showBreakdown = !pointId && data.points.length > 1

  function download() {
    const place = selected ? selected.name : 'Todos os locais'
    exportCSV({
      title: selected ? `Anotações de leite - ${selected.name}` : 'Anotações de leite',
      subtitle: `${fmtDay(from)} a ${fmtDay(today)} · ${place} · ${data.userName}`,
      sections: [
        {
          title: 'Anotações',
          columns: ['Data', 'Local', 'Litros'],
          rows: [...entries].sort((a, b) => a.date.localeCompare(b.date) || (names.get(a.pointId) ?? '').localeCompare(names.get(b.pointId) ?? ''))
            .map((e) => [fmtDay(e.date), names.get(e.pointId) ?? '—', fmtNumber(e.liters)]),
          footer: ['', 'Total', fmtNumber(total)],
        },
        ...(!pointId ? [{
          title: 'Total por local',
          columns: ['Local', 'Litros'],
          rows: [...byPoint.entries()].map(([id, l]) => [names.get(id) ?? '—', fmtNumber(l)]),
        }] : []),
      ],
    })
  }

  return (
    <div>
      {data.points.length > 1 && (
        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700">Local</span>
          <select value={pointId} onChange={(e) => setPointId(e.target.value)} className={`mt-1 ${input} bg-white font-semibold`}>
            <option value="">Todos os locais</option>
            {data.points.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}{p.kind === 'tanque' ? ' (tanque)' : ''}{p.active ? '' : ' (arquivado)'}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-3 gap-2">
        {[7, 30, 90].map((d) => (
          <button key={d} type="button" onClick={() => setDays(d)}
            className={`py-2.5 rounded-xl text-sm font-semibold border ${days === d ? 'bg-green-700 border-green-700 text-white' : 'border-gray-300 bg-white text-gray-700'}`}>
            {d} dias
          </button>
        ))}
      </div>

      <div className="mt-4 bg-white rounded-2xl border border-gray-200 p-4">
        {selected && <p className="mb-2 text-base font-semibold text-gray-900">{selected.name}</p>}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-500">Total no período</p>
            <p className="text-2xl font-bold text-green-800">{fmtNumber(total)} L</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">Média por dia anotado</p>
            <p className="text-2xl font-bold text-gray-900">{fmtNumber(dayList.length ? total / dayList.length : 0)} L</p>
          </div>
        </div>
        <p className="mt-2 text-sm text-gray-500">{dayList.length} dia{dayList.length === 1 ? '' : 's'} com anotação</p>
      </div>

      {showBreakdown && byPoint.size > 0 && (
        <section className="mt-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Por local (toque para ver só ele)</h2>
          <ul className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {[...byPoint.entries()].sort((a, b) => b[1] - a[1]).map(([id, l]) => (
              <li key={id}>
                <button type="button" onClick={() => setPointId(id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50">
                  <span className="text-gray-800">{names.get(id) ?? '—'}</span>
                  <span className="flex items-center gap-2 font-semibold text-gray-900">
                    {fmtNumber(l)} L
                    <SetaDireitaIcon className="w-4 h-4 text-gray-400" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {dayList.length === 0 ? (
        <p className="mt-8 text-center text-gray-500">Nenhuma anotação nesse período.</p>
      ) : (
        <section className="mt-4">
          <h2 className="text-sm font-semibold text-gray-500 mb-2">Por dia</h2>
          <ul className="bg-white rounded-2xl border border-gray-200 divide-y divide-gray-100">
            {dayList.map(([day, d]) => (
              <li key={day} className="px-4 py-3">
                <div className="flex justify-between">
                  <span className="text-gray-700">{fmtDay(day)} <span className="text-xs text-gray-400">{fmtDay(day, { weekday: 'short' })}</span></span>
                  <span className="font-semibold text-gray-900">{fmtNumber(d.total)} L</span>
                </div>
                {showBreakdown && d.parts.length > 0 && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {d.parts.map((part) => `${names.get(part.pointId) ?? '—'}: ${fmtNumber(part.liters)} L`).join(' · ')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <button type="button" onClick={download} disabled={entries.length === 0}
        className="mt-5 w-full border-2 border-green-700 text-green-800 font-semibold py-3 rounded-xl disabled:border-gray-300 disabled:text-gray-400">
        Baixar planilha{selected ? ` de ${selected.name}` : ''}
      </button>
    </div>
  )
}
