'use client'

// Recria por animal, sem lote: a lista de quem está sendo acompanhado um a um, a ficha com pesagens,
// peso-alvo e cobertura, e "Acompanhar um animal". Funciona sem internet pela lista guardada e pela fila.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { RearingEntryForm } from '@/components/RearingEntryForm'
import { SemSinalIcon, SincronizarIcon } from '@/components/ModuleIcons'
import { methodLabel } from '@/lib/coverage'
import { type RearingAnimal, canEnterRearing, isInRearing, rearingSummary } from '@/lib/rearing'
import { pendingRearing, queueRearing, rearingWithPending, syncRearing, writeRearingCache, applyPendingTo } from '@/lib/rearingQueue'
import { fmtDate, fmtNumber } from '@/lib/reports'
import { ReproductionSection } from './LotDetail'
import { type Coverage, type HerdAnimal, Modal, Stat, decimal, input, kg, label, offlineMessage, parseKg, send, tag, toField } from './shared'

export type RearingRow = RearingAnimal & { reproductions: Coverage[] }

function coverageLine(c: Coverage | undefined) {
  if (!c) return 'Sem cobertura registrada'
  if (c.status === 'Vazia' || c.status === 'Perdida') return `${c.status} (cobertura de ${fmtDate(c.coverageDate)})`
  return `${methodLabel(c.method)} em ${fmtDate(c.coverageDate)}${c.expectedBirthDate ? ` · parto previsto ${fmtDate(c.expectedBirthDate)}` : ''}${c.status === 'Prenha' ? ' · prenha' : ''}`
}

export function RearingAnimals({ farmId, herd, canEdit, canBreed, today, visible, onCount, onHerdChanged }: {
  /** null enquanto /api/auth/me não respondeu; '' quando não há propriedade */
  farmId: string | null
  herd: HerdAnimal[]
  canEdit: boolean
  canBreed: boolean
  today: string
  /** A aba mostra esta seção (Todos ou Recria) */
  visible: boolean
  /** Quantos animais estão na recria um a um (para o número da aba) */
  onCount: (n: number) => void
  onHerdChanged: () => void
}) {
  const [list, setList] = useState<RearingRow[] | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [pending, setPending] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const herdRef = useRef(herd)
  herdRef.current = herd

  const refreshPending = useCallback(() => setPending(farmId ? pendingRearing(farmId).length : 0), [farmId])

  const load = useCallback(async () => {
    if (farmId === null) return
    if (!farmId) { setList([]); return }
    const fromDevice = () => setList(rearingWithPending(farmId, herdRef.current) as RearingRow[])
    if (!navigator.onLine) { fromDevice(); refreshPending(); return }
    await syncRearing(farmId)
    try {
      const res = await fetch('/api/recria')
      if (!res.ok) throw new Error()
      const data: RearingRow[] = await res.json()
      writeRearingCache(farmId, data)
      setList(applyPendingTo(farmId, data, herdRef.current) as RearingRow[])
    } catch {
      fromDevice()
    }
    refreshPending()
  }, [farmId, refreshPending])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    void load()
    const online = () => { setIsOnline(true); void load() }
    const offline = () => setIsOnline(false)
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    return () => { window.removeEventListener('online', online); window.removeEventListener('offline', offline) }
  }, [load])

  const active = (list ?? []).filter(isInRearing)
  const ended = (list ?? []).filter((a) => !isInRearing(a))
  useEffect(() => { onCount(active.length) }, [active.length, onCount])

  const replace = (a: RearingRow) => {
    setList((l) => {
      const next = (l ?? []).some((x) => x.id === a.id) ? (l ?? []).map((x) => (x.id === a.id ? a : x)) : [a, ...(l ?? [])]
      if (farmId) writeRearingCache(farmId, next)
      return next
    })
  }
  const current = list?.find((a) => a.id === openId) ?? null

  if (!visible) return null
  return (
    <section className="mb-8">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">Recria um a um</h2>
          <p className="text-xs text-gray-500">Bezerros e novilhas acompanhados sem lote: desmama, pesagens, ganho por dia e cobertura.</p>
        </div>
        {canEdit && <button type="button" onClick={() => setAdding(true)} className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800 hover:bg-sky-100">Acompanhar um animal</button>}
      </div>

      {!isOnline && (
        <p className="mb-3 flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800"><SemSinalIcon className="h-5 w-5 shrink-0" />Sem internet: a recria mostra o que está guardado no aparelho. Desmama, pesagens e saídas ficam na fila e sobem quando o sinal voltar.</p>
      )}
      {isOnline && pending > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <span className="flex items-center gap-2"><SincronizarIcon className="h-5 w-5 shrink-0" />{pending} registro{pending === 1 ? '' : 's'} da recria para sincronizar</span>
          <button type="button" onClick={() => void load()} className="shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600">Sincronizar</button>
        </div>
      )}
      {list === null ? <p className="text-sm text-gray-400">Carregando...</p> : active.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-sky-200 bg-white p-5 text-sm text-gray-600">Nenhum animal acompanhado sozinho. Na ficha do bezerro, em Animais, ou em “Acompanhar um animal”, informe a desmama e o peso: o app passa a mostrar o ganho por dia{canBreed ? ' e, nas novilhas, a cobertura' : ''}.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {active.map((a) => <RearingCard key={a.id} animal={a} today={today} canEdit={canEdit} onOpen={() => setOpenId(a.id)} />)}
        </div>
      )}
      {ended.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-gray-600">Saíram da recria ({ended.length})</summary>
          <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white text-sm">
            {ended.map((a) => {
              const s = rearingSummary(a, today)
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                  <span><span className="font-semibold text-gray-900">{tag(a)}</span> <span className="text-gray-700">{a.name}</span> <span className="text-xs text-gray-500">{fmtDate(a.rearingStart)} a {fmtDate(a.rearingEnd)} · {s.days} dias{s.gainKg !== null ? ` · ganhou ${kg(s.gainKg)}` : ''}</span></span>
                  <button type="button" onClick={() => setOpenId(a.id)} className="text-sm font-semibold text-green-700 hover:underline">Abrir</button>
                </li>
              )
            })}
          </ul>
        </details>
      )}

      {adding && (
        <AddModal herd={herd} farmId={farmId ?? ''} isOnline={isOnline} today={today} onClose={() => setAdding(false)}
          onSaved={(saved) => {
            setAdding(false)
            if (saved) replace(saved as RearingRow)
            else void load()
            refreshPending()
            onHerdChanged()
          }} />
      )}
      {current && (
        <RearingDetail key={current.id} animal={current} farmId={farmId ?? ''} today={today} canEdit={canEdit} canBreed={canBreed} isOnline={isOnline}
          onClose={() => setOpenId(null)} onChanged={replace} onQueued={() => { void load(); refreshPending() }} onReload={() => void load()} />
      )}
    </section>
  )
}

// ── Cartão ──────────────────────────────────────────────────────────────

function RearingCard({ animal, today, canEdit, onOpen }: { animal: RearingRow; today: string; canEdit: boolean; onOpen: () => void }) {
  const s = rearingSummary(animal, today)
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button type="button" onClick={onOpen} className="flex w-full items-start justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 text-left hover:bg-sky-50">
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold text-gray-800">{tag(animal)} {animal.name}</span>
          <span className="block text-xs text-gray-500">{animal.species} · {s.months} meses · {s.days} dia{s.days === 1 ? '' : 's'} na recria</span>
        </span>
        <span className="shrink-0 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-800">Recria</span>
      </button>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat title="Último peso" value={s.last ? kg(s.last.weight) : '—'} />
          <Stat title="Ganho/dia" value={s.gmd !== null ? `${s.gmd >= 0 ? '+' : ''}${fmtNumber(s.gmd, 3)}` : '—'} tone="text-green-700" />
          <Stat title="Alvo" value={animal.rearingTarget ? kg(animal.rearingTarget) : '—'} />
        </div>
        {s.gainKg !== null && <p className="mt-3 text-sm text-gray-700">Ganhou <strong>{kg(s.gainKg)}</strong> desde a desmama.</p>}
        {s.projection && <p className="mt-1 text-sm text-gray-700">Chega a {kg(animal.rearingTarget!)} em <strong>{s.projection.days} dias</strong> ({fmtDate(s.projection.date)}).</p>}
        {!s.last && <p className="mt-3 text-sm text-gray-500">Sem pesagem ainda. Pese para o app calcular o ganho.</p>}
        {animal.gender === 'Fêmea' && <p className="mt-1 text-xs text-gray-600">{coverageLine(animal.reproductions[0])}</p>}
        {canEdit && (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <button type="button" onClick={onOpen} className="w-full rounded-lg border border-green-200 bg-green-50 py-2 text-sm font-semibold text-green-800 hover:bg-green-100">Pesar</button>
          </div>
        )}
      </div>
    </article>
  )
}

// ── Ficha da recria ─────────────────────────────────────────────────────

function RearingDetail({ animal, farmId, today, canEdit, canBreed, isOnline, onClose, onChanged, onQueued, onReload }: {
  animal: RearingRow
  farmId: string
  today: string
  canEdit: boolean
  canBreed: boolean
  isOnline: boolean
  onClose: () => void
  onChanged: (a: RearingRow) => void
  /** Ficou na fila do aparelho */
  onQueued: () => void
  onReload: () => void
}) {
  const { confirm } = useDialog()
  const s = rearingSummary(animal, today)
  const inRearing = isInRearing(animal)
  const [weighing, setWeighing] = useState({ date: today, weight: '' })
  const [target, setTarget] = useState(toField(animal.rearingTarget))
  const [endDate, setEndDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const weighings = [...animal.weighings].reverse()

  const run = async (action: () => Promise<RearingRow | null>) => {
    setBusy(true)
    setError('')
    try {
      const updated = await action()
      if (updated) onChanged(updated)
    } catch (err) {
      setError(offlineMessage(err))
    } finally {
      setBusy(false)
    }
  }

  const saveWeighing = (e: React.FormEvent) => {
    e.preventDefault()
    const weight = parseKg(weighing.weight)
    if (weight === null) return setError('Informe o peso em kg, por exemplo 180')
    if (!isOnline) {
      queueRearing({ _type: 'pesar', animalId: animal.id, farmId, date: weighing.date, weight })
      setWeighing({ date: today, weight: '' })
      onQueued()
      return
    }
    void run(async () => {
      const updated = await send(`/api/animals/${animal.id}/pesagens`, 'POST', weighing)
      setWeighing({ date: today, weight: '' })
      return updated
    })
  }
  const removeWeighing = async (w: { id?: string; date: string; weight: number }) => {
    if (!w.id || !(await confirm({ title: `Apagar a pesagem de ${fmtDate(w.date)} (${kg(w.weight)})?`, confirmLabel: 'Apagar', danger: true }))) return
    void run(() => send(`/api/animals/${animal.id}/pesagens`, 'DELETE', { weighingId: w.id }))
  }
  const saveTarget = () => void run(() => send(`/api/animals/${animal.id}/recria`, 'PATCH', { target }))
  const leave = async () => {
    if (!(await confirm({ title: `${animal.name} sai da recria?`, message: 'Use quando vendeu, foi para a engorda ou virou matriz. O histórico fica guardado.', confirmLabel: 'Sair da recria' }))) return
    if (!isOnline) {
      queueRearing({ _type: 'sair', animalId: animal.id, farmId, end: endDate })
      onQueued()
      onClose()
      return
    }
    void run(() => send(`/api/animals/${animal.id}/recria`, 'PATCH', { end: endDate }))
  }
  const reopen = () => void run(() => send(`/api/animals/${animal.id}/recria`, 'PATCH', { end: null }))

  return (
    <Modal title={`${tag(animal)} ${animal.name}`} subtitle={`${animal.species} · ${s.months} meses · desmama em ${fmtDate(animal.rearingStart)}${animal.rearingEnd ? ` · saiu em ${fmtDate(animal.rearingEnd)}` : ''}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat title="Na desmama" value={s.entry ? kg(s.entry.weight) : '—'} />
        <Stat title="Último peso" value={s.last ? kg(s.last.weight) : '—'} />
        <Stat title="Ganho" value={s.gainKg !== null ? kg(s.gainKg) : '—'} tone="text-green-700" />
        <Stat title="Ganho/dia" value={s.gmd !== null ? `${fmtNumber(s.gmd, 3)} kg` : '—'} tone="text-green-700" />
      </div>
      {s.projection && <p className="mt-2 text-sm text-gray-700">No ritmo atual chega a {kg(animal.rearingTarget!)} em <strong>{s.projection.days} dias</strong> ({fmtDate(s.projection.date)}).</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {canEdit && inRearing && (
        <form id="pesagem" onSubmit={saveWeighing} className="mt-4 rounded-xl bg-green-50 p-3">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Pesar</h3>
          <div className="grid grid-cols-2 gap-2">
            <label className={label}>Data
              <input type="date" required max={today} value={weighing.date} onChange={(e) => setWeighing({ ...weighing, date: e.target.value })} className={input} />
            </label>
            <label className={label}>Peso (kg)
              <input required inputMode="decimal" value={weighing.weight} onChange={(e) => setWeighing({ ...weighing, weight: decimal(e.target.value) })} placeholder={s.last ? `Antes: ${fmtNumber(s.last.weight, 0)}` : 'Ex.: 200'} className={input} />
            </label>
          </div>
          <button type="submit" disabled={busy} className="mt-2 w-full rounded-xl bg-green-700 py-3 font-semibold text-white disabled:bg-gray-300">{isOnline ? 'Salvar pesagem' : 'Guardar no aparelho'}</button>
        </form>
      )}

      {weighings.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-100 text-sm">
          {weighings.map((w, i) => {
            const before = weighings[i + 1]
            return (
              <li key={w.id ?? `${w.date}-${w.weight}`} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="text-gray-700">{fmtDate(w.date)}{!w.id ? <span className="ml-1.5 text-xs text-amber-700">na fila</span> : w.lotWeighingId ? <span className="ml-1.5 text-xs text-gray-500">lote</span> : null}</span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-gray-800">{kg(w.weight)}</span>
                  {before && <span className="text-xs text-gray-500">{w.weight - before.weight >= 0 ? '+' : ''}{fmtNumber(w.weight - before.weight)} kg</span>}
                  {canEdit && isOnline && w.id && !w.lotWeighingId && <button type="button" onClick={() => void removeWeighing(w)} className="text-xs font-semibold text-red-700 hover:underline">Apagar</button>}
                </span>
              </li>
            )
          })}
        </ul>
      )}

      {canEdit && inRearing && (
        <section className="mt-5">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">{animal.gender === 'Fêmea' ? 'Peso-alvo para a primeira cobertura' : 'Peso-alvo para sair da recria'}</h3>
          <div className="flex gap-2">
            <input inputMode="decimal" value={target} onChange={(e) => setTarget(decimal(e.target.value))} placeholder={animal.gender === 'Fêmea' ? 'Ex.: 320' : 'Ex.: 360'} aria-label="Peso-alvo em kg" className={`${input} mt-0 flex-1`} />
            <button type="button" onClick={saveTarget} disabled={busy || !isOnline} className="rounded-xl border border-gray-300 px-4 font-semibold text-gray-700 disabled:opacity-50">Salvar</button>
          </div>
          {!isOnline && <p className="mt-1 text-xs text-gray-500">O peso-alvo precisa de internet.</p>}
        </section>
      )}

      {canBreed && inRearing && animal.gender === 'Fêmea' && (isOnline
        ? <ReproductionSection females={[animal]} today={today} canEdit={canEdit} onSaved={onReload} />
        : <p className="mt-5 text-sm text-gray-600">Cobertura: {coverageLine(animal.reproductions[0])}. Sem internet, registre pela tela Reprodução, que guarda no aparelho.</p>)}

      {canEdit && (
        <div className="mt-6 border-t border-gray-100 pt-4">
          {inRearing ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <label className={`${label} flex-1`}>Data de saída
                <input type="date" max={today} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
              </label>
              <button type="button" onClick={() => void leave()} disabled={busy} className="rounded-xl border border-gray-300 px-4 py-2.5 font-semibold text-gray-700 disabled:opacity-50">Sair da recria</button>
            </div>
          ) : (
            <button type="button" onClick={reopen} disabled={busy || !isOnline} className="rounded-xl border border-gray-300 px-4 py-2.5 font-semibold text-gray-700 disabled:opacity-50">Voltar para a recria</button>
          )}
          <p className="mt-2 text-xs text-gray-500">Para engordar em grupo, crie um lote de engorda com este animal: ele sai da recria sozinho.</p>
        </div>
      )}
    </Modal>
  )
}

// ── Acompanhar um animal ────────────────────────────────────────────────

function AddModal({ herd, farmId, isOnline, today, onClose, onSaved }: {
  herd: HerdAnimal[]
  farmId: string
  isOnline: boolean
  today: string
  onClose: () => void
  onSaved: (saved: RearingAnimal | null) => void
}) {
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState<HerdAnimal | null>(null)
  const term = q.trim().toLowerCase()
  const eligible = herd.filter((a) => !!a.gender && !!a.birthDate && canEnterRearing({ ...a, gender: a.gender, birthDate: a.birthDate }, today))
  const list = eligible.filter((a) => !term || [a.code, a.customCode, a.name, a.species].some((v) => v?.toLowerCase().includes(term)))

  return (
    <Modal title="Acompanhar um animal na recria" subtitle="Bezerros, bezerras e bois jovens que não estão em lote" onClose={onClose}>
      {chosen ? (
        <RearingEntryForm animal={{ id: chosen.id, name: chosen.name, birthDate: chosen.birthDate!, gender: chosen.gender! }} farmId={farmId} isOnline={isOnline} onCancel={() => setChosen(null)} onSaved={onSaved} />
      ) : eligible.length === 0 ? (
        <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">Nenhum animal disponível: cadastre o bezerro em Animais (ou registre a cria na ficha da vaca) e volte aqui.</p>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por brinco, nome ou categoria" aria-label="Buscar animal" className={`${input} mt-0`} />
          <ul className="mt-2 max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
            {list.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => setChosen(a)} className="flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left hover:bg-sky-50">
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold text-gray-900">{tag(a)}</span> <span className="text-gray-700">{a.name}</span>
                    <span className="block text-xs text-gray-500">{a.species}</span>
                  </span>
                  <span className="text-sm font-semibold text-sky-700">Escolher</span>
                </button>
              </li>
            ))}
            {list.length === 0 && <li className="px-3 py-3 text-sm text-gray-500">Nenhum animal encontrado.</li>}
          </ul>
        </>
      )}
    </Modal>
  )
}
