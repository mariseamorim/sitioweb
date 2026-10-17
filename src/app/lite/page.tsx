'use client'
import { MilkDecimalInput } from '@/components/MilkDecimalInput'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { OfflineVoiceSetup, VoiceButton } from '@/components/VoiceButton'
import { RouteStopInfo } from '@/components/RouteStopInfo'
import { useDialog } from '@/components/DialogProvider'
import { SetaDireitaIcon, SemSinalIcon, SincronizarIcon, CheckIcon } from '@/components/ModuleIcons'
import { KIND_LABEL, LiteChange, LiteData, LitePayee, LitePoint, LiteSheetChange, LiteSplitChange, PointKind, SHEET_ALERT_PERCENT, checkSheets, isDriverRole, isLiteOnlyRole, lastSplit, litersSinceLastSplit, parseLiters, suggestSplit, totalsByPayee } from '@/lib/lite'
import { PointOp, applyChanges, applyPointOps, applySheets, applySplits, enqueue, enqueuePoint, enqueueSheet, enqueueSplits, newPointId, pendingChanges, pendingCount, pendingPointOps, pendingSheets, pendingSplits, readCache, syncLite, writeCache } from '@/lib/liteStore'
import { exportCSV } from '@/lib/reportExport'
import { fmtMoney, fmtNumber } from '@/lib/reports'
import { todayISO } from '@/lib/utils'

type Tab = 'anotar' | 'historico' | 'locais' | 'conferir' | 'nomes'

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
  const [upgrading, setUpgrading] = useState(false)

  const today = todayISO()

  const sync = useCallback(async () => {
    setSyncing(true)
    const { data: fresh, result } = await syncLite()
    if (fresh) setData(fresh)
    setNeedsLogin(result === 'auth' && navigator.onLine)
    setPending(pendingCount())
    setSyncing(false)
    if (result === 'conflict') setMessage('O total é menor que os litros registrados na Produção de leite. Corrija o total aqui ou ajuste os lançamentos na Produção de leite.')
    return result
  }, [])

  useEffect(() => {
    // Abre na hora com o que está no aparelho; depois atualiza pela internet.
    // (Lido após a montagem para o HTML do servidor e o do navegador serem iguais.)
    void Promise.resolve().then(() => {
      const cached = readCache()
      if (cached) setData(applySplits(applySheets(applyChanges(applyPointOps(cached, pendingPointOps()), pendingChanges()), pendingSheets()), pendingSplits()))
      setPending(pendingCount())
      setOnline(navigator.onLine)
      return sync()
    })

    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/lite-sw.js', { scope: '/lite' }).catch(() => {})

    const goOnline = () => { setOnline(true); void sync() }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    const refresh = () => { if (navigator.onLine) void sync() }
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('focus', refresh)
    }
  }, [sync])

  const activePoints = useMemo(() => (data?.points ?? []).filter((p) => p.active), [data])
  // Motorista anota a rota (vários locais); produtor anota só a própria produção
  const driver = isDriverRole(data?.role)
  const single = !driver && activePoints.length === 1 ? activePoints[0] : null
  // Leitor da propriedade (versão completa) vê, mas não anota
  const canWrite = data?.canEdit !== false
  const dayCollections = (data?.collections ?? []).filter((c) => c.date === date)
  const tabs = driver
    ? ([['anotar', 'Anotar'], ['historico', 'Histórico'], ['locais', 'Rota']] as const)
    : ([['anotar', 'Anotar'], ['historico', 'Histórico'], ['conferir', 'Conferir'], ['nomes', 'Nomes']] as const)
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

  // Motorista de laticínio: paradas das rotas do dia em ordem, depois os demais locais
  const skipped = useMemo(() => {
    const map = new Map<string, string>()
    for (const e of data?.entries ?? []) if (e.date === date && e.skipReason) map.set(e.pointId, e.skipReason)
    return map
  }, [data, date])
  const sections = useMemo(() => {
    if (!driver) return [{ title: '', points: activePoints }]
    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay()
    const routes = new Map<string, { title: string; stops: { point: LitePoint; position: number }[] }>()
    for (const p of activePoints) {
      for (const r of p.routes ?? []) {
        if (!r.days.includes(weekday)) continue
        const route = routes.get(r.id) ?? { title: `Rota de hoje: ${r.name}`, stops: [] }
        route.stops.push({ point: p, position: r.position })
        routes.set(r.id, route)
      }
    }
    const inRoutes = new Set([...routes.values()].flatMap((r) => r.stops.map((s) => s.point.id)))
    const list = [...routes.values()].map((r) => ({ title: r.title, points: r.stops.sort((a, b) => a.position - b.position).map((s) => s.point) }))
    const others = activePoints.filter((p) => !inRoutes.has(p.id))
    if (others.length) list.push({ title: list.length ? 'Outros locais' : '', points: others })
    return list
  }, [driver, activePoints, date])

  // Coleta não realizada: grava na hora (não espera digitar) com o motivo; "Desfazer" apaga
  async function markSkip(point: LitePoint, skipReason: string | null) {
    if (!data || !canWrite) return
    const change: LiteChange = { pointId: point.id, date, liters: null, skipReason }
    enqueue([change])
    setData(applyChanges(data, [change]))
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== `${date}|${point.id}`)))
    setPending(pendingCount())
    if (navigator.onLine) await sync()
  }

  // auto: salvamento sozinho. Não apaga anotação (campo vazio) e mantém o que está digitado
  // no campo, para não atrapalhar quem ainda está escrevendo
  async function save({ auto = false } = {}) {
    const toSave = auto ? changes.filter((c) => c.liters !== null) : changes
    if (!data || !canWrite || toSave.length === 0) return
    enqueue(toSave)
    setData(applyChanges(data, toSave))
    if (!auto) setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => !k.startsWith(`${date}|`))))
    setPending(pendingCount())
    // O aparelho pode dizer que está online sem o sinal chegar: a mensagem segue o resultado do envio
    if (navigator.onLine && await sync() === 'conflict') return
    setMessage(pendingCount() ? 'Salvo no celular. Será enviado quando houver internet.' : 'Salvo e enviado.')
    setTimeout(() => setMessage(''), 4000)
  }

  // Salva sozinho pouco depois de parar de digitar (sem internet fica guardado no celular)
  const autoKey = changes.filter((c) => c.liters !== null).map((c) => `${c.date}|${c.pointId}=${c.liters}`).join(' ')
  const saveRef = useRef(save)
  useEffect(() => { saveRef.current = save })
  useEffect(() => {
    if (!autoKey) return
    const timer = setTimeout(() => void saveRef.current({ auto: true }), 1500)
    return () => clearTimeout(timer)
  }, [autoKey])
  // Ao sair do app ou bloquear o celular no meio da digitação, salva na hora
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') void saveRef.current({ auto: true }) }
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [])

  // Excluir a anotação de um local no dia (também sem internet: entra na fila como as outras)
  async function removeEntry(point: LitePoint) {
    if (!data || !canWrite) return
    const label = single ? fmtDay(date) : `${point.name} em ${fmtDay(date)}`
    if (!(await confirm({ title: `Excluir o leite de ${label}?`, message: data.mode === 'fazenda'
      ? 'Apaga o que foi anotado por aqui. Ordenhas lançadas na tela Produção de leite continuam.'
      : `${fmtNumber(saved.get(point.id) ?? 0)} L serão apagados.`, confirmLabel: 'Excluir', danger: true }))) return
    const change: LiteChange = { pointId: point.id, date, liters: null }
    enqueue([change])
    setData(applyChanges(data, [change]))
    setDrafts((d) => Object.fromEntries(Object.entries(d).filter(([k]) => k !== `${date}|${point.id}`)))
    setPending(pendingCount())
    if (navigator.onLine && await sync() === 'conflict') return
    setMessage(pendingCount() ? 'Excluído no celular. Será enviado quando houver internet.' : 'Anotação excluída.')
    setTimeout(() => setMessage(''), 4000)
  }

  // Número falado vai para o campo como se tivesse sido digitado (o salvar sozinho grava)
  function setSpoken(pointId: string, liters: number) {
    setDrafts((d) => ({ ...d, [`${date}|${pointId}`]: String(liters).replace('.', ',') }))
  }

  // Trocar de dia não perde o que acabou de ser digitado
  function goToDay(day: string) {
    void saveRef.current({ auto: true })
    setDate(day)
  }

  // Folha do motorista: guarda no celular e envia quando houver internet
  function saveSheet(change: LiteSheetChange) {
    enqueueSheet(change)
    setData((d) => (d ? applySheets(d, [change]) : d))
    setPending(pendingCount())
    if (navigator.onLine) void sync()
  }

  // Divisão da nota no dia da coleta: guarda no celular e envia quando houver internet
  function saveSplits(changes: LiteSplitChange[]) {
    enqueueSplits(changes)
    setData((d) => (d ? applySplits(d, changes) : d))
    setPending(pendingCount())
    setMessage(navigator.onLine ? 'Divisão salva.' : 'Divisão salva no celular. Será enviada quando houver internet.')
    setTimeout(() => setMessage(''), 4000)
    if (navigator.onLine) void sync()
  }

  // Nomes da nota alterados (cadastro com internet): atualiza a cópia do aparelho
  function payeesChanged(payees: LitePayee[]) {
    setData((d) => { if (!d) return d; const next = { ...d, payees }; writeCache(next); return next })
  }

  function pointOp(op: PointOp) {
    enqueuePoint(op)
    setData((d) => (d ? applyPointOps(d, [op]) : d))
    setPending(pendingCount())
    if (navigator.onLine) void sync()
  }

  async function logout() {
    if (pendingCount() > 0) {
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
        <div className="mx-auto mb-3 flex max-w-xl gap-2 px-4">
          <Link href="/lite/perfil" className="group flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-green-900 transition-colors hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 focus-visible:ring-offset-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-green-700" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><circle cx="12" cy="8" r="3.5" /><path d="M5 21v-2a7 7 0 0 1 14 0v2" /></svg>
            </span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">Meu cadastro</span><span className="block text-xs text-green-700">Ver e editar meus dados</span></span>
            <SetaDireitaIcon className="h-4 w-4 shrink-0" />
          </Link>
          {data && !isLiteOnlyRole(data.role) && (
            <Link href="/" aria-label="Voltar ao painel" className="inline-flex min-h-12 shrink-0 items-center gap-1 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600">
              <SetaDireitaIcon className="h-4 w-4 rotate-180" />Painel
            </Link>
          )}
        </div>
        <nav className={`mx-auto max-w-xl px-4 pb-2 grid gap-1 ${tabs.length === 4 ? 'grid-cols-4' : tabs.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`} aria-label="Seções">
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
            <FirstPoint driver={driver} onPointOp={pointOp} />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => goToDay(shiftDay(date, -1))} aria-label="Dia anterior"
                  className="h-12 w-12 shrink-0 rounded-xl border border-gray-300 bg-white flex items-center justify-center text-gray-700">
                  <SetaDireitaIcon className="w-5 h-5 rotate-180" />
                </button>
                <label className="flex-1">
                  <span className="sr-only">Data</span>
                  <input type="date" value={date} max={today} onChange={(e) => e.target.value && goToDay(e.target.value)}
                    className={`${input} text-center font-semibold`} />
                </label>
                <button type="button" onClick={() => goToDay(shiftDay(date, 1))} disabled={date >= today} aria-label="Próximo dia"
                  className="h-12 w-12 shrink-0 rounded-xl border border-gray-300 bg-white flex items-center justify-center text-gray-700 disabled:opacity-30">
                  <SetaDireitaIcon className="w-5 h-5" />
                </button>
              </div>
              <p className="mt-2 text-center text-sm text-gray-500">
                {date === today ? 'Hoje' : fmtDay(date, { weekday: 'long' })}
                {date !== today && <button type="button" onClick={() => goToDay(today)} className="ml-2 font-semibold text-green-700 underline">Voltar para hoje</button>}
              </p>

              {single ? (
                <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-5 text-center">
                  <span className="block text-sm font-medium text-gray-500">{single.name}</span>
                  <span className="mt-1 block text-lg font-semibold text-gray-900">Leite do dia</span>
                  <span className="mt-4 flex items-center justify-center gap-2">
                    <MilkDecimalInput type="text" inputMode="decimal" placeholder="0" value={valueOf(single.id)} autoFocus readOnly={!canWrite}
                      onChange={(e) => setDrafts({ ...drafts, [`${date}|${single.id}`]: e.target.value.replace(/[^\d.,]/g, '') })}
                      aria-label={`Litros de ${single.name}`}
                      className="w-44 border border-gray-300 rounded-2xl px-4 py-4 !text-5xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-green-600" />
                    <span className="text-2xl text-gray-500">L</span>
                  </span>
                  {canWrite && <VoiceButton label="os litros do dia" onNumber={(v) => setSpoken(single.id, v)} />}
                  {canWrite && saved.has(single.id) && (
                    <button type="button" onClick={() => void removeEntry(single)} className="mt-3 text-sm font-semibold text-red-700 underline">
                      Excluir anotação deste dia
                    </button>
                  )}
                  <PriceLine data={data} liters={parseLiters(valueOf(single.id)) ?? 0} online={online} canWrite={canWrite}
                    onSaved={(milkPrice) => { const d = { ...data, milkPrice }; setData(d); writeCache(d) }} />
                </div>
              ) : (
              <div className="mt-5 space-y-5">
                {sections.map((section) => (
                  <section key={section.title || 'locais'}>
                    {section.title && <h2 className="mb-2 text-sm font-semibold text-gray-600">{section.title}</h2>}
                    <ul className="space-y-3">
                      {section.points.map((p) => (
                        <li key={p.id} className="bg-white rounded-2xl border border-gray-200 p-4">
                          <div className="flex items-start gap-2">
                            <label className="flex flex-1 min-w-0 items-center gap-3">
                              <span className="flex-1 min-w-0">
                                <span className="block text-lg font-semibold text-gray-900 truncate">{p.name}</span>
                                {p.kind === 'tanque' && <span className="text-xs font-medium text-gray-500">{KIND_LABEL.tanque}</span>}
                              </span>
                              {!skipped.has(p.id) && (
                                <span className="flex items-center gap-2 shrink-0">
                                  <MilkDecimalInput type="text" inputMode="decimal" placeholder="0" value={valueOf(p.id)}
                                    onChange={(e) => setDrafts({ ...drafts, [`${date}|${p.id}`]: e.target.value.replace(/[^\d.,]/g, '') })}
                                    aria-label={`Litros de ${p.name}`}
                                    className="w-28 border border-gray-300 rounded-xl px-3 py-3 !text-2xl font-semibold text-right focus:outline-none focus:ring-2 focus:ring-green-600" />
                                  <span className="text-lg text-gray-500">L</span>
                                </span>
                              )}
                            </label>
                            {canWrite && !skipped.has(p.id) && <VoiceButton size="sm" label={`os litros de ${p.name}`} onNumber={(v) => setSpoken(p.id, v)} />}
                          </div>
                          {canWrite && saved.has(p.id) && !skipped.has(p.id) && (
                            <div className="mt-1 text-right">
                              <button type="button" onClick={() => void removeEntry(p)} className="text-sm font-semibold text-red-700 underline">Excluir</button>
                            </div>
                          )}
                          {p.org && <RouteStopInfo point={p} skipReason={skipped.get(p.id) ?? null} canWrite={canWrite}
                            hasLiters={!!parseLiters(valueOf(p.id))} onSkip={(reason) => markSkip(p, reason)} />}
                        </li>
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
              )}
              {!driver && activePoints.map((p) => (
                <SplitCard key={`${p.id}|${date}`} data={data} point={p} date={date} canWrite={canWrite} showName={!single} onSave={saveSplits} />
              ))}
              {canWrite && <OfflineVoiceSetup online={online} />}

              {(data.milkWithdrawals ?? []).length > 0 && (
                <section role="alert" className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <h2 className="text-sm font-semibold text-red-900">Leite em carência: não vai para o tanque</h2>
                  <ul className="mt-1 space-y-0.5 text-sm text-red-900">
                    {data.milkWithdrawals!.map((w) => <li key={`${w.animalName}|${w.until}`}><strong>{w.animalName}</strong> até {fmtDay(w.until)} ({w.medicine})</li>)}
                  </ul>
                </section>
              )}

              {dayCollections.length > 0 && (
                <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <h2 className="text-sm font-semibold text-blue-900">Coletado pelo motorista neste dia</h2>
                  <ul className="mt-2 space-y-1">
                    {dayCollections.map((c) => (
                      <li key={c.pointId} className="flex justify-between text-sm text-blue-900">
                        <span>{c.driverName} · {c.pointName}</span>
                        <span className="font-semibold">{fmtNumber(c.liters)} L</span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {!canWrite && <p className="mt-4 text-center text-sm text-gray-500">Seu acesso é só de leitura.</p>}
            </>
          )
        ) : tab === 'historico' ? (
          <History data={data} online={online} canWrite={canWrite} onOpenDay={(day) => { goToDay(day); setTab('anotar'); window.scrollTo(0, 0) }}
            onPriceSaved={(milkPrice) => { const d = { ...data, milkPrice }; setData(d); writeCache(d) }} />
        ) : tab === 'conferir' && !driver ? (
          <Conferir data={data} online={online} canWrite={canWrite} onSave={saveSheet} />
        ) : tab === 'nomes' && !driver ? (
          <Nomes data={data} online={online} canWrite={canWrite} onChanged={payeesChanged} />
        ) : driver ? (
          <Points data={data} online={online} onPointOp={pointOp} onChanged={(d) => { setData(d); writeCache(d) }} />
        ) : null}

        {data && (
          <footer className="mt-10 flex flex-col items-center gap-3 text-sm text-gray-500">
            <p>{data.userName}</p>
            <div className="flex gap-4">
              {!isLiteOnlyRole(data.role) && <Link href="/" className="font-medium text-green-700 underline">Abrir app completo</Link>}
              {data.role === 'lite' && (
                <button type="button" onClick={() => setUpgrading(true)} className="font-medium text-green-700 underline">Quero a versão completa</button>
              )}
              <button type="button" onClick={logout} className="font-medium text-gray-600 underline">Sair</button>
            </div>
          </footer>
        )}
      </main>

      {upgrading && data && (
        <UpgradeModal data={data} online={online} pending={pending} onClose={() => setUpgrading(false)} />
      )}

      {tab === 'anotar' && activePoints.length > 0 && canWrite && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white border-t border-gray-200" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
          <div className="mx-auto max-w-xl px-4 py-3 flex items-center gap-4">
            {!single && (
              <div className="shrink-0">
                <p className="text-xs text-gray-500">Total do dia</p>
                <p className="text-2xl font-bold text-green-800">{fmtNumber(dayTotal)} L</p>
              </div>
            )}
            <button type="button" onClick={() => void save()} disabled={changes.length === 0}
              className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white text-lg font-bold py-4 rounded-xl">
              {changes.length === 0 ? 'Salvo' : online ? 'Salvar' : 'Salvar no celular'}
            </button>
          </div>
          {message
            ? <p role="status" className="pb-3 text-center text-sm font-medium text-green-800">{message}</p>
            : <p className="pb-3 text-center text-xs text-gray-500">Salva sozinho quando você para de digitar, mesmo sem internet.</p>}
        </div>
      )}
    </div>
  )
}

// ── Primeiro local ──────────────────────────────────────────────────────

function FirstPoint({ driver, onPointOp }: { driver: boolean; onPointOp: (op: PointOp) => void }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <h1 className="text-xl font-bold text-gray-900">{driver ? 'Monte sua rota' : 'Qual o nome do seu sítio?'}</h1>
      <p className="mt-1 text-gray-600">
        {driver
          ? 'Cadastre os sítios e tanques comunitários onde você recolhe o leite. Comece pelo primeiro.'
          : 'É só para aparecer nas suas anotações e na planilha.'}
      </p>
      <div className="mt-4">
        <PointForm chooseKind={driver} onSubmit={({ name, kind }) => onPointOp({ id: newPointId(), create: true, name, kind })} />
      </div>
    </div>
  )
}

/** Cadastro ou edição de local. Funciona sem internet: o local entra na fila de envio. */
function PointForm({ point, chooseKind = true, onSubmit, onCancel }: {
  point?: LitePoint
  /** Motorista escolhe entre sítio e tanque comunitário; produtor anota sempre o próprio sítio */
  chooseKind?: boolean
  onSubmit: (values: { name: string; kind: PointKind }) => void
  onCancel?: () => void
}) {
  const [name, setName] = useState(point?.name ?? '')
  const [kind, setKind] = useState<PointKind>(point?.kind ?? 'sitio')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onSubmit({ name: trimmed, kind })
    if (!point) setName('')
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
      <div className="flex gap-2">
        {onCancel && <button type="button" onClick={onCancel} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl">Cancelar</button>}
        <button type="submit" className="flex-1 bg-green-700 hover:bg-green-600 text-white font-semibold py-3 rounded-xl">
          {point ? 'Salvar' : chooseKind ? 'Adicionar local' : 'Começar a anotar'}
        </button>
      </div>
    </form>
  )
}

// ── Locais ──────────────────────────────────────────────────────────────

function Points({ data, online, onPointOp, onChanged }: {
  data: LiteData
  online: boolean
  onPointOp: (op: PointOp) => void
  /** Resposta do servidor ao ligar/desligar um sítio a uma propriedade (precisa de internet) */
  onChanged: (d: LiteData) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const linked = (p: LitePoint) => onChanged({ ...data, points: data.points.map((x) => (x.id === p.id ? p : x)) })
  const toggle = (p: LitePoint) => onPointOp({ id: p.id, active: !p.active })

  // Pontos do laticínio vêm prontos nas rotas: aqui o motorista cuida só dos locais dele
  const active = data.points.filter((p) => p.active && !p.org)
  const archived = data.points.filter((p) => !p.active && !p.org)

  return (
    <div>
      <ul className="space-y-2">
        {active.map((p) => (
          <li key={p.id} className="bg-white rounded-2xl border border-gray-200 p-4">
            {editing === p.id ? (
              <PointForm point={p} onSubmit={(v) => { onPointOp({ id: p.id, ...v }); setEditing(null) }} onCancel={() => setEditing(null)} />
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">{p.name}</p>
                    <p className="text-sm text-gray-500">{KIND_LABEL[p.kind]}</p>
                  </div>
                  <button type="button" onClick={() => setEditing(p.id)} className="text-sm font-semibold text-green-700">Editar</button>
                  <button type="button" onClick={() => toggle(p)} className="text-sm font-semibold text-gray-600">Arquivar</button>
                </div>
                {p.kind === 'sitio' && <FarmLinker point={p} online={online} onChanged={linked} />}
              </>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4">
        {adding ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-4">
            <PointForm onSubmit={(v) => { onPointOp({ id: newPointId(), create: true, ...v }); setAdding(false) }} onCancel={() => setAdding(false)} />
          </div>
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
                <button type="button" onClick={() => toggle(p)} className="text-sm font-semibold text-green-700">Reativar</button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ── Histórico ───────────────────────────────────────────────────────────

function History({ data, online, canWrite, onOpenDay, onPriceSaved }: {
  data: LiteData
  online: boolean
  canWrite: boolean
  /** Abre o dia na aba Anotar, onde dá para alterar ou excluir */
  onOpenDay: (day: string) => void
  onPriceSaved: (price: number | null) => void
}) {
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
  // Estimativa em R$ (só para quem anota a própria produção) e coletas do motorista (versão completa)
  const price = isDriverRole(data.role) ? null : data.milkPrice
  const periodCollections = (data.collections ?? []).filter((c) => c.date >= from && c.date <= today)
  const collected = periodCollections.reduce((s, c) => s + c.liters, 0)
  const best = dayList.reduce<[string, number] | null>((b, [day, d]) => (!b || d.total > b[1] ? [day, d.total] : b), null)
  // Nota com mais de um nome: quanto cada nome recebe no período (soma das divisões das coletas)
  const payeesInScope = (data.payees ?? []).filter((p) => !pointId || p.pointId === pointId)
  const payeeIds = new Set(payeesInScope.map((p) => p.id))
  const splitsInScope = (data.splits ?? []).filter((s) => payeeIds.has(s.payeeId))
  const payeeLiters = totalsByPayee(splitsInScope, from, today)
  const payeeTotals = payeesInScope.filter((p) => payeeLiters.has(p.id)).map((p) => ({ payee: p, liters: payeeLiters.get(p.id)! }))
  const payeeSum = payeeTotals.reduce((t, x) => t + x.liters, 0)
  const splitDays = new Set(splitsInScope.filter((x) => x.date >= from && x.date <= today).map((x) => x.date))
  // Gráfico: um traço por dia em 7 e 30 dias; em 90 dias, um por semana para caber na tela
  const step = days > 30 ? 7 : 1
  const bars: { label: string; title: string; liters: number }[] = []
  for (let start = from; start <= today; start = shiftDay(start, step)) {
    const end = step === 1 ? start : (shiftDay(start, step - 1) < today ? shiftDay(start, step - 1) : today)
    let liters = 0
    for (let d = start; d <= end; d = shiftDay(d, 1)) liters += byDay.get(d)?.total ?? 0
    bars.push({
      label: step === 1 ? fmtDay(start, days === 7 ? { weekday: 'short' } : { day: 'numeric' }) : fmtDay(start, { day: 'numeric', month: 'numeric' }),
      title: `${step === 1 ? fmtDay(start) : `${fmtDay(start)} a ${fmtDay(end)}`}: ${fmtNumber(liters)} L`,
      liters,
    })
  }
  const maxBar = Math.max(...bars.map((b) => b.liters), 1)
  const labelEvery = bars.length > 14 ? Math.ceil(bars.length / 7) : 1

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
        ...(price ? [{
          title: 'Estimativa',
          columns: ['Valor do litro', 'Total estimado'],
          rows: [[fmtMoney(price), fmtMoney(total * price)]],
        }] : []),
        ...(periodCollections.length ? [{
          title: 'Coletado pelo motorista',
          columns: ['Data', 'Motorista', 'Local', 'Litros'],
          rows: periodCollections.map((c) => [fmtDay(c.date), c.driverName, c.pointName, fmtNumber(c.liters)]),
          footer: ['', '', 'Total', fmtNumber(collected)],
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

      {selected && <p className="mt-4 text-base font-semibold text-gray-900">{selected.name}</p>}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">Total no período</p>
          <p className="text-2xl font-bold text-green-800">{fmtNumber(total)} L</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">Média por dia anotado</p>
          <p className="text-2xl font-bold text-gray-900">{fmtNumber(dayList.length ? total / dayList.length : 0)} L</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">Melhor dia</p>
          <p className="text-lg font-bold text-gray-900">{best ? `${fmtNumber(best[1])} L` : '—'}</p>
          {best && <p className="text-xs text-gray-500">{fmtDay(best[0])}</p>}
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">Dias anotados</p>
          <p className="text-lg font-bold text-gray-900">{dayList.length} de {days}</p>
        </div>
      </div>

      {payeeTotals.length > 0 && (
        <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-4" aria-label="Por nome da nota">
          <div className="flex justify-between">
            <h2 className="text-sm font-semibold text-gray-700">Por nome da nota</h2>
            <span className="text-sm font-bold text-gray-900">{fmtNumber(payeeSum)} L</span>
          </div>
          <ul className="mt-2 space-y-1">
            {payeeTotals.map(({ payee, liters }) => (
              <li key={payee.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate text-gray-800">{payee.producerCode ? <span className="font-mono text-xs text-gray-500">{payee.producerCode} </span> : null}{payee.name}</span>
                <span className="shrink-0 font-semibold text-gray-900">{fmtNumber(liters)} L <span className="text-xs font-normal text-gray-500">{payeeSum ? Math.round((liters / payeeSum) * 100) : 0}%</span></span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-gray-500">É o que cada nome recebe do laticínio nas coletas do período. Compare com o depósito.</p>
        </section>
      )}

      {total > 0 && (
        <section className="mt-3 rounded-2xl border border-gray-200 bg-white p-4" aria-label="Litros por dia">
          <h2 className="text-sm font-semibold text-gray-700">{step === 1 ? 'Litros por dia' : 'Litros por semana'}</h2>
          <div className="mt-3 flex h-36 items-end gap-1">
            {bars.map((b, i) => (
              <div key={i} title={b.title} className="flex h-full min-w-0 flex-1 flex-col justify-end">
                <div className={`w-full rounded-t ${b.liters ? 'bg-green-600' : 'bg-gray-100'}`} style={{ height: `${b.liters ? Math.max((b.liters / maxBar) * 100, 4) : 2}%` }} />
              </div>
            ))}
          </div>
          <div className="mt-1 flex gap-1" aria-hidden="true">
            {bars.map((b, i) => (
              <span key={i} className="min-w-0 flex-1 overflow-visible whitespace-nowrap text-center text-[10px] text-gray-500">{i % labelEvery === 0 ? b.label : ''}</span>
            ))}
          </div>
        </section>
      )}

      {!isDriverRole(data.role) && (
        <div className={`mt-3 rounded-2xl border-2 px-4 pb-4 ${data.milkPrice ? 'border-green-300 bg-green-50' : 'border-gray-200 bg-white'}`}>
          <PriceLine data={data} liters={total} period="no período" highlight online={online} canWrite={canWrite} onSaved={onPriceSaved} />
        </div>
      )}

      {periodCollections.length > 0 && (
        <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex justify-between">
            <h2 className="text-sm font-semibold text-blue-900">Coletado pelo motorista</h2>
            <span className="text-sm font-bold text-blue-900">{fmtNumber(collected)} L</span>
          </div>
          <ul className="mt-2 space-y-1">
            {periodCollections.map((c) => (
              <li key={`${c.pointId}|${c.date}`} className="flex justify-between text-sm text-blue-900">
                <span>{fmtDay(c.date)} · {c.driverName}</span>
                <span className="font-semibold">{fmtNumber(c.liters)} L</span>
              </li>
            ))}
          </ul>
        </section>
      )}

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
                  <span className="text-gray-700">{fmtDay(day)} <span className="text-xs text-gray-400">{fmtDay(day, { weekday: 'short' })}</span>{splitDays.has(day) && <span className="ml-1.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">coleta</span>}</span>
                  <span className="flex items-center gap-3">
                    <span className="font-semibold text-gray-900">{fmtNumber(d.total)} L</span>
                    {canWrite && <button type="button" onClick={() => onOpenDay(day)} className="text-sm font-semibold text-green-700">Alterar</button>}
                  </span>
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

// ── Nota do laticínio com mais de um nome ───────────────────────────────

const fmtInput = (n: number) => String(n).replace('.', ',')

/** No dia da coleta: quanto do leite desde a última coleta vai para cada nome da nota.
 *  Montado com key por local e dia, para o rascunho zerar ao trocar de dia. */
function SplitCard({ data, point, date, canWrite, showName, onSave }: {
  data: LiteData
  point: LitePoint
  date: string
  canWrite: boolean
  showName: boolean
  onSave: (changes: LiteSplitChange[]) => void
}) {
  const { confirm } = useDialog()
  const allPayees = data.payees ?? []
  const splits = data.splits ?? []
  const payees = allPayees.filter((p) => p.pointId === point.id && p.active)
  const savedMap = new Map(splits.filter((s) => s.date === date && payees.some((p) => p.id === s.payeeId)).map((s) => [s.payeeId, s.liters]))
  const hasSplit = savedMap.size > 0
  const [open, setOpen] = useState(false)
  const [totalDraft, setTotalDraft] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [chip, setChip] = useState<'last' | 'equal' | 'first' | null>(null)

  if (payees.length === 0 || (!canWrite && !hasSplit)) return null

  const since = litersSinceLastSplit(data.entries, splits, allPayees, point.id, date)
  const previous = lastSplit(splits, allPayees, point.id, date)
  const savedTotal = [...savedMap.values()].reduce((t, l) => t + l, 0)
  const totalText = totalDraft ?? fmtInput(hasSplit ? Math.round(savedTotal * 10) / 10 : since.liters)
  const total = parseLiters(totalText) ?? 0
  const valueOf = (id: string) => values[id] ?? (savedMap.has(id) ? fmtInput(savedMap.get(id)!) : '')
  const sum = Math.round(payees.reduce((t, p) => t + (parseLiters(valueOf(p.id)) ?? 0), 0) * 10) / 10
  const filled = payees.every((p) => valueOf(p.id) !== '')
  const matches = Math.abs(sum - total) < 0.05
  const changed = payees.some((p) => (parseLiters(valueOf(p.id)) ?? null) !== (savedMap.get(p.id) ?? null))

  function applySuggestion(kind: 'last' | 'equal' | 'first') {
    const map = kind === 'last' ? suggestSplit(total, payees, previous) : kind === 'equal' ? suggestSplit(total, payees) : suggestSplit(total, payees, [{ payeeId: payees[0].id, liters: 1 }])
    setValues(Object.fromEntries(payees.map((p) => [p.id, fmtInput(map[p.id] ?? 0)])))
    setChip(kind)
  }
  // Com dois nomes, digitar um lado completa o outro
  function change(id: string, text: string) {
    const clean = text.replace(/[^\d.,]/g, '')
    const next = { ...values, [id]: clean }
    if (payees.length === 2) {
      const other = payees.find((p) => p.id !== id)!
      const liters = parseLiters(clean)
      if (liters !== null && total >= liters) next[other.id] = fmtInput(Math.round((total - liters) * 10) / 10)
    }
    setValues(next)
    setChip(null)
  }
  async function remove() {
    if (!(await confirm({ title: `Apagar a divisão de ${fmtDay(date)}?`, message: 'Os litros do dia continuam anotados. Só a divisão entre os nomes é apagada.', confirmLabel: 'Apagar', danger: true }))) return
    onSave(payees.map((p) => ({ payeeId: p.id, date, liters: null })))
    setValues({}); setTotalDraft(null); setOpen(false)
  }

  if (!open && !hasSplit) {
    return (
      <button type="button" onClick={() => { setOpen(true); applySuggestion(previous.length ? 'last' : 'equal') }}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl border-2 border-dashed border-green-300 bg-white px-4 py-3 text-left hover:bg-green-50">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-lg font-bold text-green-800" aria-hidden="true">÷</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-gray-900">Coleta hoje? Dividir a nota{showName ? ` de ${point.name}` : ''}</span>
          <span className="block text-sm text-gray-600">{fmtNumber(since.liters)} L desde {since.from === date ? 'hoje' : fmtDay(since.from)} entre {payees.map((p) => p.name.split(' ')[0]).join(' e ')}</span>
        </span>
      </button>
    )
  }

  return (
    <section className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4" aria-label={`Divisão da nota${showName ? ` de ${point.name}` : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold text-blue-950">Nota de {fmtDay(date)}{showName ? ` · ${point.name}` : ''}</h2>
          <p className="text-xs text-blue-900">{since.from === date ? 'Só o leite de hoje' : `Leite de ${fmtDay(since.from)} a ${fmtDay(date)}`}. Corrija o total se a coleta levou outro valor.</p>
        </div>
        {hasSplit && <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-blue-900">salva</span>}
      </div>

      <label className="mt-3 flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-blue-950">Total da coleta</span>
        <span className="flex items-center gap-2">
          <MilkDecimalInput type="text" inputMode="decimal" value={totalText} readOnly={!canWrite}
            onChange={(e) => { setTotalDraft(e.target.value.replace(/[^\d.,]/g, '')); setChip(null) }}
            aria-label="Total da coleta" className="w-28 rounded-xl border border-blue-200 bg-white px-3 py-2 text-right !text-xl font-bold focus:outline-none focus:ring-2 focus:ring-green-600" />
          <span className="text-blue-900">L</span>
        </span>
      </label>

      {canWrite && (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Sugestão de divisão">
          {previous.length > 0 && <button type="button" aria-pressed={chip === 'last'} onClick={() => applySuggestion('last')} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${chip === 'last' ? 'bg-green-700 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>Como da última</button>}
          <button type="button" aria-pressed={chip === 'equal'} onClick={() => applySuggestion('equal')} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${chip === 'equal' ? 'bg-green-700 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>Igual para todos</button>
          <button type="button" aria-pressed={chip === 'first'} onClick={() => applySuggestion('first')} className={`rounded-full px-3 py-1.5 text-sm font-semibold ${chip === 'first' ? 'bg-green-700 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}>Tudo em {payees[0].name.split(' ')[0]}</button>
        </div>
      )}

      <ul className="mt-3 space-y-2">
        {payees.map((p) => (
          <li key={p.id} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold text-gray-900">{p.name}</span>
              {(p.producerCode || p.sequence) && <span className="block text-xs text-gray-500">{[p.producerCode && `produtor ${p.producerCode}`, p.sequence && `seq. ${p.sequence}`].filter(Boolean).join(' · ')}</span>}
            </span>
            <MilkDecimalInput type="text" inputMode="decimal" placeholder="0" value={valueOf(p.id)} readOnly={!canWrite}
              onChange={(e) => change(p.id, e.target.value)} aria-label={`Litros de ${p.name}`}
              className="w-24 rounded-xl border border-gray-300 px-3 py-2 text-right !text-xl font-bold focus:outline-none focus:ring-2 focus:ring-green-600" />
            <span className="text-gray-500">L</span>
            {canWrite && <VoiceButton size="sm" label={`os litros de ${p.name}`} onNumber={(v) => change(p.id, fmtInput(v))} />}
          </li>
        ))}
      </ul>

      <p className={`mt-2 text-sm font-medium ${!filled ? 'text-gray-600' : matches ? 'text-green-800' : 'text-red-700'}`} role="status">
        {!filled ? 'Preencha os litros de cada nome.' : matches ? `Soma ${fmtNumber(sum)} L, igual ao total.` : `Soma ${fmtNumber(sum)} L. ${sum < total ? `Faltam ${fmtNumber(Math.round((total - sum) * 10) / 10)} L` : `Passou ${fmtNumber(Math.round((sum - total) * 10) / 10)} L`} para bater com o total.`}
      </p>

      {canWrite && (
        <div className="mt-3 flex items-center gap-3">
          <button type="button" disabled={!filled || !matches || total <= 0 || (!changed && hasSplit)} onClick={() => onSave(payees.map((p) => ({ payeeId: p.id, date, liters: parseLiters(valueOf(p.id)) })))}
            className="flex-1 rounded-xl bg-green-700 py-3 font-bold text-white hover:bg-green-600 disabled:bg-gray-300">
            {hasSplit && !changed ? 'Divisão salva' : 'Salvar divisão'}
          </button>
          {hasSplit
            ? <button type="button" onClick={() => void remove()} className="text-sm font-semibold text-red-700 underline">Apagar</button>
            : <button type="button" onClick={() => { setOpen(false); setValues({}); setTotalDraft(null) }} className="text-sm font-semibold text-gray-600 underline">Hoje não</button>}
        </div>
      )}
    </section>
  )
}

/** Cadastro dos nomes da nota (quem recebe uma parte do leite). Precisa de internet. */
function Nomes({ data, online, canWrite, onChanged }: {
  data: LiteData
  online: boolean
  canWrite: boolean
  onChanged: (payees: LitePayee[]) => void
}) {
  const { confirm, notify } = useDialog()
  const points = data.points.filter((p) => p.active)
  const [pointId, setPointId] = useState(points[0]?.id ?? '')
  const all = data.payees ?? []
  const payees = all.filter((p) => p.pointId === pointId)
  const [editing, setEditing] = useState<LitePayee | 'new' | null>(null)
  const [form, setForm] = useState({ name: '', producerCode: '', sequence: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function startNew() { setForm({ name: '', producerCode: '', sequence: '' }); setError(''); setEditing('new') }
  function startEdit(p: LitePayee) { setForm({ name: p.name, producerCode: p.producerCode ?? '', sequence: p.sequence ?? '' }); setError(''); setEditing(p) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setBusy(true); setError('')
    try {
      const res = await fetch(editing === 'new' ? '/api/lite/nomes' : `/api/lite/nomes/${editing.id}`, {
        method: editing === 'new' ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...(editing === 'new' ? { pointId } : {}) }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(body.error || 'Não foi possível salvar'); return }
      const saved = body as LitePayee
      onChanged(editing === 'new' ? [...all, saved] : all.map((p) => (p.id === saved.id ? saved : p)))
      setEditing(null)
    } catch {
      setError('Sem internet. Cadastrar nomes precisa de sinal; a divisão da coleta funciona sem.')
    } finally {
      setBusy(false)
    }
  }

  async function toggle(p: LitePayee) {
    if (p.active && !(await confirm({ title: `Tirar ${p.name} da nota?`, message: 'Sai das próximas coletas. As divisões já feitas ficam no histórico. Dá para reativar depois.', confirmLabel: 'Tirar', danger: true }))) return
    try {
      const res = await fetch(`/api/lite/nomes/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !p.active }) })
      if (!res.ok) { await notify('Não foi possível alterar'); return }
      const saved = (await res.json()) as LitePayee
      onChanged(all.map((x) => (x.id === saved.id ? saved : x)))
    } catch {
      await notify('Sem internet', 'Cadastrar ou alterar nomes precisa de sinal.')
    }
  }

  const formView = editing && (
    <form onSubmit={submit} className="mt-3 rounded-2xl border border-gray-200 bg-white p-4">
      <h3 className="font-semibold text-gray-900">{editing === 'new' ? `Nome ${payees.length + 1}` : 'Alterar nome'}</h3>
      <label className="mt-3 block">
        <span className="text-sm font-medium text-gray-700">Nome como está na folha</span>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required autoFocus className={`mt-1 ${input}`} />
      </label>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Código de produtor</span>
          <input value={form.producerCode} onChange={(e) => setForm({ ...form, producerCode: e.target.value })} inputMode="numeric" placeholder="ex.: 005712" className={`mt-1 ${input}`} />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-gray-700">Seq. na folha</span>
          <input value={form.sequence} onChange={(e) => setForm({ ...form, sequence: e.target.value })} inputMode="numeric" placeholder="ex.: 030" className={`mt-1 ${input}`} />
        </label>
      </div>
      <p className="mt-2 text-xs text-gray-500">O código de produtor é o número que o laticínio dá a cada pessoa. É ele que define para quem vai o pagamento.</p>
      {error && <p role="alert" className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700">Cancelar</button>
        <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-green-700 py-3 font-semibold text-white disabled:bg-gray-300">{busy ? 'Salvando...' : 'Salvar'}</button>
      </div>
    </form>
  )

  return (
    <div>
      {points.length > 1 && (
        <label className="block mb-3">
          <span className="text-sm font-medium text-gray-700">Local</span>
          <select value={pointId} onChange={(e) => { setPointId(e.target.value); setEditing(null) }} className={`mt-1 ${input} bg-white font-semibold`}>
            {points.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}
      {!online && <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">Sem internet. Cadastrar nomes precisa de sinal; a divisão da coleta funciona sem.</p>}

      {payees.length === 0 && editing !== 'new' ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 text-center">
          <span className="text-4xl" aria-hidden="true">📄</span>
          <h2 className="mt-2 text-lg font-bold text-gray-900">A nota do laticínio tem mais de um nome?</h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-gray-600">Cadastre quem divide o leite do tanque. Depois, a cada coleta, você só diz quanto vai para cada um, na tela Anotar.</p>
          {canWrite && <button type="button" onClick={startNew} disabled={!online} className="mt-4 w-full rounded-xl bg-green-700 py-3 font-bold text-white disabled:bg-gray-300">Cadastrar os nomes</button>}
        </div>
      ) : (
        <ul className="space-y-2">
          {payees.map((p) => (
            <li key={p.id} className={`rounded-2xl border border-gray-200 bg-white p-4 ${p.active ? '' : 'opacity-60'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  <p className="text-xs text-gray-500">{[p.producerCode && `produtor ${p.producerCode}`, p.sequence && `seq. ${p.sequence}`].filter(Boolean).join(' · ') || 'sem código'}{p.active ? '' : ' · fora da nota'}</p>
                </div>
                {canWrite && (
                  <div className="flex shrink-0 gap-3 text-sm font-semibold">
                    <button type="button" onClick={() => startEdit(p)} className="text-green-700">Alterar</button>
                    <button type="button" onClick={() => void toggle(p)} className={p.active ? 'text-gray-500' : 'text-green-700'}>{p.active ? 'Tirar' : 'Reativar'}</button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {formView}
      {canWrite && payees.length > 0 && !editing && (
        <button type="button" onClick={startNew} disabled={!online} className="mt-3 w-full rounded-xl border-2 border-green-700 py-3 font-semibold text-green-800 disabled:border-gray-300 disabled:text-gray-400">+ Adicionar outro nome</button>
      )}
      {payees.length > 0 && <p className="mt-4 text-center text-sm text-gray-500">Laticínio, rota e tanque vêm do laticínio. Você só cadastra os nomes.</p>}
    </div>
  )
}

// ── Conferir a folha do motorista ───────────────────────────────────────

const fmtSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtNumber(Math.abs(n))}`

function Conferir({ data, online, canWrite, onSave }: {
  data: LiteData
  online: boolean
  canWrite: boolean
  onSave: (change: LiteSheetChange) => void
}) {
  const { confirm } = useDialog()
  const today = todayISO()
  const [date, setDate] = useState(today)
  const [draft, setDraft] = useState<{ date: string; value: string } | null>(null)
  const [message, setMessage] = useState('')
  const formRef = useRef<HTMLDivElement>(null)
  const sheets = useMemo(() => data.sheets ?? [], [data.sheets])
  const existing = sheets.find((s) => s.date === date)
  // O campo mostra o que foi digitado para este dia ou, se nada, o que já está salvo
  const value = draft?.date === date ? draft.value : existing ? String(existing.liters).replace('.', ',') : ''
  const liters = parseLiters(value)
  const checks = useMemo(() => checkSheets(sheets, data.entries), [sheets, data.entries])

  // Resumo do mês: total da folha, total anotado e quanto deve receber pela folha
  const months = [0, 1, 2].map((back) => {
    const d = new Date(`${today.slice(0, 7)}-01T00:00:00Z`)
    d.setUTCMonth(d.getUTCMonth() - back)
    return d.toISOString().slice(0, 7)
  })
  const [month, setMonth] = useState(months[0])
  const monthSheets = sheets.filter((s) => s.date.startsWith(month))
  const sheetTotal = monthSheets.reduce((sum, s) => sum + s.liters, 0)
  // Comparação do mês só com as coletas conferidas, para folha e anotação cobrirem os mesmos dias
  const compared = checks.filter((c) => c.date.startsWith(month) && c.noted)
  const comparedSheet = compared.reduce((sum, c) => sum + c.sheet, 0)
  const comparedNoted = compared.reduce((sum, c) => sum + (c.noted ?? 0), 0)
  const price = data.milkPrice
  const monthLabel = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'long' })

  function save() {
    if (!liters) return
    onSave({ date, liters })
    setDraft(null)
    setMessage(online ? 'Folha salva.' : 'Salva no celular. Será enviada quando houver internet.')
    setTimeout(() => setMessage(''), 4000)
  }

  async function remove() {
    if (!(await confirm({ title: `Apagar a coleta de ${fmtDay(date)}?`, confirmLabel: 'Apagar' }))) return
    onSave({ date, liters: null })
    setDraft(null)
  }

  function edit(day: string) {
    setDate(day)
    setDraft(null)
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div>
      {canWrite && (
        <div ref={formRef} className="scroll-mt-48 rounded-2xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">O motorista levou</h2>
          <p className="mt-1 text-sm text-gray-600">Quando o caminhão passar, digite os litros que estão na folha do motorista.</p>
          <label className="mt-4 block text-sm font-medium text-gray-700">Dia da coleta
            <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className={`mt-1 ${input} font-semibold`} />
          </label>
          <div className="mt-3 flex items-center gap-2">
            <label className="flex flex-1 items-center gap-2">
              <span className="sr-only">Litros da folha</span>
              <MilkDecimalInput type="text" inputMode="decimal" placeholder="0" value={value}
                onChange={(e) => setDraft({ date, value: e.target.value.replace(/[^\d.,]/g, '') })}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); save() } }}
                className="w-full border border-gray-300 rounded-xl px-3 py-3 !text-3xl font-bold text-center focus:outline-none focus:ring-2 focus:ring-green-600" />
              <span className="text-xl text-gray-500">L</span>
            </label>
            <VoiceButton size="sm" label="os litros da folha" onNumber={(v) => setDraft({ date, value: String(v).replace('.', ',') })} />
          </div>
          <div className="mt-3 flex gap-2">
            {existing && <button type="button" onClick={remove} className="border border-gray-300 text-red-700 font-semibold px-4 py-3 rounded-xl">Apagar</button>}
            <button type="button" onClick={save} disabled={!liters || liters === existing?.liters}
              className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl">
              {existing ? (liters === existing.liters ? 'Salvo' : 'Salvar alteração') : 'Salvar folha'}
            </button>
          </div>
          {message && <p role="status" className="mt-2 text-center text-sm font-medium text-green-800">{message}</p>}
        </div>
      )}

      <section className="mt-5" aria-label="Resumo do mês">
        <div className="grid grid-cols-3 gap-2">
          {months.map((m) => (
            <button key={m} type="button" onClick={() => setMonth(m)}
              className={`py-2.5 rounded-xl text-sm font-semibold border capitalize ${month === m ? 'bg-green-700 border-green-700 text-white' : 'border-gray-300 bg-white text-gray-700'}`}>
              {monthLabel(m)}
            </button>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">Pela folha do motorista</p>
            <p className="text-2xl font-bold text-gray-900">{fmtNumber(sheetTotal)} L</p>
            <p className="text-xs text-gray-500">{monthSheets.length} coleta{monthSheets.length === 1 ? '' : 's'}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">Diferença nas coletas conferidas</p>
            <p className={`text-2xl font-bold ${compared.length && Math.abs(comparedSheet - comparedNoted) / comparedNoted * 100 > SHEET_ALERT_PERCENT ? 'text-red-700' : 'text-gray-900'}`}>
              {compared.length ? `${fmtSigned(Math.round((comparedSheet - comparedNoted) * 10) / 10)} L` : '—'}
            </p>
            <p className="text-xs text-gray-500">
              {compared.length ? `Folha ${fmtNumber(comparedSheet)} L · você ${fmtNumber(comparedNoted)} L` : 'Precisa de duas coletas'}
            </p>
          </div>
        </div>
        {price && sheetTotal > 0 ? (
          <div className="mt-2 rounded-2xl border-2 border-green-300 bg-green-50 p-4">
            <p className="text-sm font-medium text-green-900">Pela folha, você deve receber em {monthLabel(month)}</p>
            <p className="mt-1 text-3xl font-bold text-green-800">{fmtMoney(sheetTotal * price)}</p>
            <p className="mt-1 text-sm text-gray-600">Litro a {fmtMoney(price)}. Confira com o pagamento do laticínio.</p>
          </div>
        ) : sheetTotal > 0 && (
          <p className="mt-2 text-sm text-gray-600">Informe o valor do litro na aba Histórico para ver quanto deve receber.</p>
        )}
      </section>

      <section className="mt-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-500">Cada coleta</h2>
        {checks.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 text-center text-gray-600">
            Nenhuma coleta anotada ainda. Anote a próxima vez que o motorista passar.
          </p>
        ) : (
          <ul className="space-y-2">
            {checks.map((c) => (
              <li key={c.date} className={`rounded-2xl border bg-white p-4 ${c.alert ? 'border-red-300' : 'border-gray-200'}`}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-semibold text-gray-900">{fmtDay(c.date)} <span className="text-xs font-normal text-gray-400">{fmtDay(c.date, { weekday: 'short' })}</span></span>
                  {canWrite && <button type="button" onClick={() => edit(c.date)} className="text-sm font-semibold text-green-700">Alterar</button>}
                </div>
                <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                  <div><dt className="text-gray-500">Folha do motorista</dt><dd className="text-lg font-bold text-gray-900">{fmtNumber(c.sheet)} L</dd></div>
                  {c.noted !== null && (
                    <div>
                      <dt className="text-gray-500">Você anotou{c.from && c.from < c.date ? ` de ${fmtDay(c.from, { day: 'numeric', month: 'numeric' })} a ${fmtDay(c.date, { day: 'numeric', month: 'numeric' })}` : ''}</dt>
                      <dd className="text-lg font-bold text-green-800">{fmtNumber(c.noted)} L</dd>
                    </div>
                  )}
                </dl>
                {c.noted === null ? (
                  <p className="mt-2 text-sm text-gray-500">Primeira coleta anotada. A conferência começa na próxima.</p>
                ) : c.noted === 0 ? (
                  <p className="mt-2 text-sm text-gray-500">Você não anotou o leite desses dias, então não dá para conferir.</p>
                ) : c.diff === 0 ? (
                  <p className="mt-2 text-sm font-semibold text-green-800">A folha bate com a sua anotação.</p>
                ) : (
                  <p className={`mt-2 text-sm ${c.alert ? 'font-semibold text-red-700' : 'text-gray-600'}`}>
                    {fmtSigned(c.diff!)} L na folha ({fmtSigned(c.percent ?? 0)}%).{' '}
                    {c.alert
                      ? c.diff! < 0 ? 'A folha tem bem menos do que você anotou. Vale conversar com o motorista.' : 'A folha tem bem mais do que você anotou. Confira a sua anotação.'
                      : 'Diferença pequena, normal entre a régua do tanque e a ordenha.'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-gray-500">
          A folha é comparada com o leite que você anotou desde o dia seguinte à coleta anterior até o dia da coleta. Diferença acima de {SHEET_ALERT_PERCENT}% aparece em vermelho.
        </p>
      </section>
    </div>
  )
}

// ── Valor do litro ──────────────────────────────────────────────────────

function PriceLine({ data, liters, period = 'no dia', highlight = false, online, canWrite, onSaved }: {
  data: LiteData
  liters: number
  period?: string
  highlight?: boolean
  online: boolean
  canWrite: boolean
  onSaved: (price: number | null) => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const price = data.milkPrice

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/lite/preco', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: value.trim() || null }),
      })
      const body = await res.json()
      if (!res.ok) return setError(body.error || 'Não foi possível salvar')
      onSaved(body.milkPrice)
      setEditing(false)
    } catch {
      setError('Sem internet. Tente de novo quando houver sinal.')
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="mt-4 text-left">
        <label className="text-sm font-medium text-gray-700">Valor do litro (R$)
          <MilkDecimalInput decimals={2} inputMode="decimal" value={value} autoFocus placeholder="Ex.: 2,50"
            onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void save() } }}
            className={`mt-1 ${input}`} />
        </label>
        <p className="mt-1 text-xs text-gray-500">Opcional. Serve só para estimar quanto você vai receber. Deixe vazio para não usar.</p>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setEditing(false)} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-xl">Cancelar</button>
          <button type="button" onClick={save} disabled={saving || !online} className="flex-1 bg-green-700 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-xl">
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    )
  }

  const editButton = canWrite && (
    <button type="button" onClick={() => { setValue(price ? price.toFixed(2).replace('.', ',') : ''); setEditing(true) }}
      className="ml-2 font-semibold text-green-700 underline">
      {price ? 'Alterar' : 'Informar valor do litro'}
    </button>
  )

  // No Histórico o valor do período é a informação principal: número grande em destaque
  if (highlight && price) {
    return (
      <div className="pt-4">
        <p className="text-sm font-medium text-green-900">Você recebe aproximadamente {period}</p>
        <p className="mt-1 text-3xl font-bold text-green-800">{fmtMoney(liters * price)}</p>
        <p className="mt-1 text-sm text-gray-600">Litro a {fmtMoney(price)}{editButton}</p>
      </div>
    )
  }

  return (
    <p className="mt-4 text-sm text-gray-600">
      {price
        ? <>Litro a {fmtMoney(price)} · aproximadamente <strong className="text-gray-900">{fmtMoney(liters * price)}</strong> {period}</>
        : 'Quer saber quanto vai receber?'}
      {editButton}
    </p>
  )
}

// ── Passar para a versão completa ───────────────────────────────────────

function UpgradeModal({ data, online, pending, onClose }: {
  data: LiteData
  online: boolean
  pending: number
  onClose: () => void
}) {
  const [form, setForm] = useState({ name: data.points[0]?.name ?? '', propertyType: 'Sítio', city: '', state: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const blocked = !online ? 'Conecte-se à internet para passar para a versão completa.'
    : pending ? 'Envie as anotações pendentes antes de continuar (aguarde o "Tudo enviado").' : ''

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/lite/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const body = await res.json()
      if (!res.ok) return setError(body.error || 'Não foi possível concluir')
      try { localStorage.removeItem('lite_cache_v1') } catch {}
      window.location.href = '/'
    } catch {
      setError('Sem internet. Tente de novo quando houver sinal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-4">
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-md bg-white rounded-2xl p-5 flex flex-col gap-3 max-h-[95vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-900">Versão completa</h2>
        <p className="text-gray-600">
          Além do leite, você passa a controlar rebanho, vacinas, financeiro, estoque e relatórios.
          Todas as suas anotações de leite vão junto, e você continua anotando por aqui.
        </p>
        <label className="text-sm font-medium text-gray-700">Nome da propriedade
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={`mt-1 ${input}`} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          {['Sítio', 'Fazenda'].map((t) => (
            <button key={t} type="button" onClick={() => setForm({ ...form, propertyType: t })} aria-pressed={form.propertyType === t}
              className={`py-3 rounded-xl border-2 text-sm font-semibold ${form.propertyType === t ? 'border-green-700 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <label className="col-span-2 text-sm font-medium text-gray-700">Cidade
            <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required className={`mt-1 ${input}`} />
          </label>
          <label className="text-sm font-medium text-gray-700">UF
            <input value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value.toUpperCase() })} required maxLength={2} placeholder="MG" className={`mt-1 ${input}`} />
          </label>
        </div>
        <p className="text-xs text-gray-500">A cidade ajuda o motorista do leite a encontrar sua propriedade e mostrar as coletas para você.</p>
        {(blocked || error) && <p className="text-sm text-red-600">{blocked || error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={onClose} className="flex-1 border border-gray-300 text-gray-700 font-semibold py-3 rounded-xl">Agora não</button>
          <button type="submit" disabled={saving || !!blocked} className="flex-1 bg-green-700 disabled:bg-gray-300 text-white font-bold py-3 rounded-xl">
            {saving ? 'Criando...' : 'Quero a versão completa'}
          </button>
        </div>
      </form>
    </div>
  )
}

// ── Motorista: ligar sítio da rota a uma propriedade Pro ────────────────

function FarmLinker({ point, online, onChanged }: { point: LitePoint; online: boolean; onChanged: (p: LitePoint) => void }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [city, setCity] = useState('')
  const [found, setFound] = useState<NonNullable<LitePoint['farm']>[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    if (q.trim().length < 3) return
    const timer = setTimeout(() => {
      fetch(`/api/lite/propriedades?q=${encodeURIComponent(q.trim())}&cidade=${encodeURIComponent(city.trim())}`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setFound)
        .catch(() => setFound([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [q, city])

  async function link(farmId: string | null) {
    setError('')
    const res = await fetch(`/api/lite/locais/${point.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farmId }),
    }).catch(() => null)
    if (!res?.ok) return setError(online ? 'Não foi possível salvar' : 'Sem internet')
    onChanged(await res.json())
    setOpen(false)
  }

  if (point.farm) {
    return (
      <p className="mt-2 text-sm text-gray-600">
        Ligado a <strong className="text-gray-900">{point.farm.name}</strong>
        {(point.farm.city || point.farm.state) && ` (${[point.farm.city, point.farm.state].filter(Boolean).join('/')})`}
        <button type="button" onClick={() => link(null)} disabled={!online} className="ml-2 font-semibold text-gray-600 underline disabled:text-gray-300">Desligar</button>
      </p>
    )
  }
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} disabled={!online} className="mt-2 text-sm font-semibold text-green-700 underline disabled:text-gray-300">
        Ligar à propriedade do produtor
      </button>
    )
  }
  return (
    <div className="mt-3 rounded-xl bg-gray-50 p-3">
      <p className="text-sm text-gray-600">Procure a propriedade pelo nome. O produtor passa a ver o que você coletar aqui.</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nome da propriedade" aria-label="Nome da propriedade" className={`col-span-2 ${input}`} />
        <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Cidade" aria-label="Cidade" className={input} />
      </div>
      {q.trim().length >= 3 && (
        <ul className="mt-2 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {found.length === 0 ? (
            <li className="px-3 py-2.5 text-sm text-gray-500">Nenhuma propriedade encontrada.</li>
          ) : found.map((f) => (
            <li key={f.id}>
              <button type="button" onClick={() => link(f.id)} className="w-full px-3 py-2.5 text-left hover:bg-green-50">
                <span className="block font-medium text-gray-900">{f.name}</span>
                <span className="block text-sm text-gray-500">{[f.city, f.state].filter(Boolean).join('/') || 'Sem cidade informada'}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      <button type="button" onClick={() => setOpen(false)} className="mt-2 text-sm font-medium text-gray-600 underline">Cancelar</button>
    </div>
  )
}
