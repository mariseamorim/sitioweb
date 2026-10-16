'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useDialog } from '@/components/DialogProvider'
import { useUser } from '@/contexts/UserContext'
import { FecharIcon } from '@/components/ModuleIcons'
import {
  Feeding, LOT_PHASES, LIVE_KG_PER_ARROBA, STOCK_WARNING_DAYS, Weighing, animalGain, arrobasProduced, dailySupplyKg, daysBetween, daysOfStock,
  feedingSummary, kgInStockUnit, lotSummary, pricePerKg, projectTarget, stockKg,
} from '@/lib/lots'
import { fmtDate, fmtMoney, fmtNumber } from '@/lib/reports'
import { todayISO } from '@/lib/utils'

interface SupplyRef { id: string; name: string; unit: string; currentQuantity: number; packageKg: number | null; unitPrice?: number | null }
interface LotAnimal { id: string; code: string; customCode: string | null; name: string; weighings: { date: string; weight: number }[] }
interface Lot {
  id: string
  name: string
  phase: string
  startDate: string
  endDate: string | null
  supplyPercent: number | null
  targetWeight: number | null
  notes: string | null
  supply: SupplyRef | null
  weighings: (Weighing & { id: string })[]
  feedings: (Feeding & { id: string })[]
  animals: LotAnimal[]
}
/** Animal do rebanho, para escolher quem entra no lote */
interface HerdAnimal { id: string; code: string; customCode: string | null; name: string; species: string; status: string; lotId: string | null }

const input = 'mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
const label = 'block text-sm font-medium text-gray-700'
const phaseLabel = (p: string) => LOT_PHASES.find((x) => x.key === p)?.label ?? p
const kg = (n: number) => `${fmtNumber(n)} kg`
const decimal = (v: string) => v.replace(/[^\d.,]/g, '')
const tag = (a: { code: string; customCode: string | null }) => `#${a.customCode || a.code}`
const lastWeight = (a: LotAnimal) => a.weighings[a.weighings.length - 1]?.weight ?? null
const parseKg = (v: string) => { const n = Number(v.replace(',', '.')); return v.trim() && Number.isFinite(n) && n > 0 ? n : null }

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Não foi possível salvar')
  return data
}

const offlineMessage = (err: unknown) => (navigator.onLine ? (err as Error).message : 'Sem internet. Os lotes precisam de conexão para salvar.')

export default function EngordaPage() {
  const { user, canAccess } = useUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const [lots, setLots] = useState<Lot[] | null>(null)
  const [herd, setHerd] = useState<HerdAnimal[]>([])
  const [supplies, setSupplies] = useState<SupplyRef[]>([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState<{ id: string; focus?: 'pesar' | 'animais' } | null>(null)
  const today = todayISO()

  const loadHerd = useCallback(() => {
    fetch('/api/animals').then((r) => (r.ok ? r.json() : [])).then((list: HerdAnimal[]) => setHerd(list.filter((a) => a.status === 'Vivo'))).catch(() => {})
  }, [])
  const load = useCallback(() => {
    fetch('/api/lotes').then((r) => (r.ok ? r.json() : Promise.reject())).then(setLots)
      .catch(() => setError('Não foi possível carregar os lotes. Confira a internet.'))
    loadHerd()
  }, [loadHerd])
  useEffect(() => {
    load()
    if (canAccess('estoque')) fetch('/api/estoque').then((r) => (r.ok ? r.json() : [])).then(setSupplies).catch(() => {})
  }, [load, canAccess])

  // Um animal muda de lote: o lote antigo também perde o animal na tela
  const replace = (lot: Lot) => {
    const moved = new Set(lot.animals.map((a) => a.id))
    setLots((list) => (list ?? []).map((l) => (l.id === lot.id ? lot : { ...l, animals: l.animals.filter((a) => !moved.has(a.id)) })))
    loadHerd()
  }
  const openLots = useMemo(() => lots?.filter((l) => !l.endDate) ?? [], [lots])
  const closed = lots?.filter((l) => l.endDate) ?? []
  const current = lots?.find((l) => l.id === open?.id) ?? null
  const lotNames = useMemo(() => new Map((lots ?? []).filter((l) => !l.endDate).map((l) => [l.id, l.name])), [lots])

  // Resumo de todos os lotes abertos
  const totals = useMemo(() => {
    const summaries = openLots.map((l) => lotSummary(l.weighings, today, l.endDate))
    const heads = summaries.reduce((s, x) => s + (x.last?.headCount ?? 0), 0)
    const weight = summaries.reduce((s, x) => s + (x.last ? x.last.avgWeight * x.last.headCount : 0), 0)
    const withGmd = summaries.filter((x) => x.gmd !== null && x.last)
    const gmdHeads = withGmd.reduce((s, x) => s + x.last!.headCount, 0)
    return {
      heads,
      avgWeight: heads ? weight / heads : null,
      gmd: gmdHeads ? withGmd.reduce((s, x) => s + x.gmd! * x.last!.headCount, 0) / gmdHeads : null,
    }
  }, [openLots, today])

  return (
    <PermissionGuard module="animais">
      <div>
        <div className="page-toolbar mb-2 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Recria e engorda</h1>
          {canEdit && <button type="button" onClick={() => setCreating(true)} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600">Novo lote</button>}
        </div>
        <p className="mb-5 text-sm text-gray-600">Junte os animais em lotes, pese e acompanhe o ganho por dia, o suplemento e quando o lote chega ao peso de saída.</p>

        {openLots.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Lotes abertos', String(openLots.length), 'text-gray-900'],
              ['Cabeças nos lotes', String(totals.heads), 'text-gray-900'],
              ['Peso médio', totals.avgWeight !== null ? kg(totals.avgWeight) : '—', 'text-gray-900'],
              ['Ganho por dia (média)', totals.gmd !== null ? `${fmtNumber(totals.gmd, 3)} kg` : '—', 'text-green-700'],
            ].map(([title, value, tone]) => (
              <div key={title} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
                <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
        {!lots ? <p className="text-sm text-gray-400">Carregando...</p> : lots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
            <p className="font-semibold text-gray-800">Nenhum lote ainda</p>
            <p className="mt-1 text-sm">Crie um lote com os animais cadastrados (ou só a quantidade e o peso médio). A cada pesagem, o app mostra quanto o lote ganhou.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {openLots.map((l) => <LotCard key={l.id} lot={l} today={today} canEdit={canEdit} onOpen={(focus) => setOpen({ id: l.id, focus })} />)}
            </div>
            {closed.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Encerrados</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {closed.map((l) => <LotCard key={l.id} lot={l} today={today} canEdit={false} onOpen={() => setOpen({ id: l.id })} />)}
                </div>
              </section>
            )}
          </>
        )}

        {creating && <LotForm supplies={supplies} herd={herd} lotNames={lotNames} onClose={() => setCreating(false)}
          onSaved={(lot) => { setCreating(false); setLots((list) => [lot, ...(list ?? [])]); replace(lot) }} />}
        {current && <LotDetail key={current.id} lot={current} supplies={supplies} herd={herd} lotNames={lotNames} canEdit={canEdit} today={today}
          focus={open?.focus} onClose={() => setOpen(null)} onChanged={replace}
          onDeleted={() => { setLots((list) => (list ?? []).filter((l) => l.id !== current.id)); setOpen(null); loadHerd() }} />}
      </div>
    </PermissionGuard>
  )
}

// ── Cartão do lote ──────────────────────────────────────────────────────

function supplyLine(lot: Lot) {
  const s = lotSummary(lot.weighings, todayISO(), lot.endDate)
  const perDay = dailySupplyKg(s.last, lot.supplyPercent)
  if (!lot.supply || !perDay) return null
  const days = lot.endDate ? null : daysOfStock(stockKg(lot.supply), perDay)
  return { perDay, perHead: s.last ? Math.round((perDay / s.last.headCount) * 1000) : null, days }
}

function Stat({ title, value, tone = 'text-gray-900' }: { title: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2.5 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <p className={`mt-1 text-base font-bold ${tone}`}>{value}</p>
    </div>
  )
}

function LotCard({ lot, today, canEdit, onOpen }: { lot: Lot; today: string; canEdit: boolean; onOpen: (focus?: 'pesar' | 'animais') => void }) {
  const s = lotSummary(lot.weighings, today, lot.endDate)
  const supply = supplyLine(lot)
  const projection = lot.endDate ? null : projectTarget(s, lot.targetWeight)
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button type="button" onClick={() => onOpen()} className="flex w-full items-start justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 text-left hover:bg-green-50">
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold text-gray-800">{lot.name}</span>
          <span className="block text-xs text-gray-500">{s.days} dia{s.days === 1 ? '' : 's'} no lote{lot.endDate ? ` · saiu em ${fmtDate(lot.endDate)}` : ''}</span>
        </span>
        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{phaseLabel(lot.phase)}</span>
      </button>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat title="Animais" value={String(lot.animals.length || s.last?.headCount || 0)} />
          <Stat title="Peso médio" value={s.last ? kg(s.last.avgWeight) : '—'} />
          <Stat title="Ganho/dia" value={s.gmd !== null ? `${s.gmd >= 0 ? '+' : ''}${fmtNumber(s.gmd, 3)}` : '—'} tone="text-green-700" />
        </div>
        {lot.animals.length > 0 && (
          <div className="mt-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">Animais no lote</p>
            <ul className="flex flex-wrap gap-1.5">
              {lot.animals.slice(0, 8).map((a) => {
                const w = lastWeight(a)
                return <li key={a.id} className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-700">{tag(a)}{w !== null ? ` (${fmtNumber(w, 0)} kg)` : ''}</li>
              })}
              {lot.animals.length > 8 && <li className="px-1 py-0.5 text-xs text-gray-500">e mais {lot.animals.length - 8}</li>}
            </ul>
          </div>
        )}
        {s.gainKg !== null && <p className="mt-3 text-sm text-gray-700">Ganhou <strong>{kg(s.gainKg)}</strong> por cabeça desde a entrada.</p>}
        {projection && <p className="mt-1 text-sm text-gray-700">Chega a {kg(lot.targetWeight!)} em <strong>{projection.days} dias</strong> ({fmtDate(projection.date)}).</p>}
        {supply && (
          <p className={`mt-1 text-xs ${supply.days !== null && supply.days <= STOCK_WARNING_DAYS ? 'font-semibold text-amber-700' : 'text-gray-500'}`}>
            {lot.supply!.name}: {kg(supply.perDay)}/dia{supply.days !== null ? ` · estoque para ${supply.days} dia${supply.days === 1 ? '' : 's'}` : ''}
          </p>
        )}
        {canEdit && (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
            <button type="button" onClick={() => onOpen('animais')} className="rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">+ Animais</button>
            <button type="button" onClick={() => onOpen('pesar')} className="rounded-lg border border-green-200 bg-green-50 py-2 text-sm font-semibold text-green-800 hover:bg-green-100">Pesar</button>
          </div>
        )}
      </div>
    </article>
  )
}

// ── Escolher animais do rebanho ─────────────────────────────────────────

function AnimalPicker({ herd, lotNames, exclude = [], selected, onChange }: {
  herd: HerdAnimal[]
  lotNames: Map<string, string>
  /** Animais que já estão no lote (não aparecem) */
  exclude?: string[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const list = herd.filter((a) => !exclude.includes(a.id))
    .filter((a) => !term || [a.code, a.customCode, a.name, a.species].some((v) => v?.toLowerCase().includes(term)))
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  const allIds = list.map((a) => a.id)
  const allOn = allIds.length > 0 && allIds.every((id) => selected.includes(id))

  if (herd.filter((a) => !exclude.includes(a.id)).length === 0) {
    return <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">Nenhum animal disponível. Cadastre os animais na tela Animais.</p>
  }
  return (
    <div>
      <div className="flex gap-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por brinco, nome ou categoria" aria-label="Buscar animal" className={`${input} mt-0`} />
        <button type="button" onClick={() => onChange(allOn ? selected.filter((id) => !allIds.includes(id)) : [...new Set([...selected, ...allIds])])}
          className="shrink-0 rounded-xl border border-gray-300 px-3 text-sm font-semibold text-gray-700">{allOn ? 'Desmarcar' : 'Marcar todos'}</button>
      </div>
      <ul className="mt-2 max-h-64 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
        {list.map((a) => (
          <li key={a.id}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 hover:bg-green-50">
              <input type="checkbox" checked={selected.includes(a.id)} onChange={() => toggle(a.id)} className="h-5 w-5 accent-green-700" />
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-gray-900">{tag(a)}</span> <span className="text-gray-700">{a.name}</span>
                <span className="block text-xs text-gray-500">{a.species}{a.lotId && lotNames.get(a.lotId) ? ` · está no lote ${lotNames.get(a.lotId)} (muda para este)` : ''}</span>
              </span>
            </label>
          </li>
        ))}
        {list.length === 0 && <li className="px-3 py-3 text-sm text-gray-500">Nenhum animal encontrado.</li>}
      </ul>
      <p className="mt-1 text-xs text-gray-500">{selected.length} selecionado{selected.length === 1 ? '' : 's'}</p>
    </div>
  )
}

/** Pesos de cada animal (pesagem do lote ou de entrada) */
function WeightList({ animals, weights, onChange, previous }: {
  animals: { id: string; code: string; customCode: string | null; name: string }[]
  weights: Record<string, string>
  onChange: (w: Record<string, string>) => void
  previous?: Map<string, number>
}) {
  const done = animals.filter((a) => parseKg(weights[a.id] ?? '') !== null).length
  return (
    <div>
      <p className="mb-2 text-sm text-gray-600"><strong className="text-green-800">{done} de {animals.length}</strong> pesados{done < animals.length ? ` · ${animals.length - done} pendente${animals.length - done === 1 ? '' : 's'}` : ''}</p>
      <ul className="max-h-80 divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200">
        {animals.map((a) => {
          const before = previous?.get(a.id)
          const now = parseKg(weights[a.id] ?? '')
          return (
            <li key={a.id} className={`flex items-center gap-3 px-3 py-2 ${now !== null ? 'bg-green-50/60' : ''}`}>
              <span className="min-w-0 flex-1">
                <span className="font-semibold text-gray-900">{tag(a)}</span> <span className="text-gray-700">{a.name}</span>
                {before !== undefined && <span className="block text-xs text-gray-500">Antes: {kg(before)}{now !== null ? ` · ${now - before >= 0 ? '+' : ''}${fmtNumber(now - before)} kg` : ''}</span>}
              </span>
              <label className="flex shrink-0 items-center gap-1.5">
                <span className="sr-only">Peso de {a.name}</span>
                <input inputMode="decimal" value={weights[a.id] ?? ''} onChange={(e) => onChange({ ...weights, [a.id]: decimal(e.target.value) })} placeholder="0"
                  className="w-24 rounded-lg border border-gray-300 px-2 py-2 text-right text-base font-semibold focus:outline-none focus:ring-2 focus:ring-green-600" />
                <span className="text-sm text-gray-500">kg</span>
              </label>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

const averageOf = (weights: Record<string, string>) => {
  const values = Object.values(weights).map(parseKg).filter((v): v is number => v !== null)
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
}

// ── Novo lote ───────────────────────────────────────────────────────────

type SupplyForm = { supplyId: string; supplyPercent: string; packageKg: string; unitPrice: string }
const EMPTY_SUPPLY: SupplyForm = { supplyId: '', supplyPercent: '', packageKg: '', unitPrice: '' }

function SupplyFields({ supplies, value, onChange }: {
  supplies: SupplyRef[]
  value: SupplyForm
  onChange: (v: SupplyForm) => void
}) {
  const chosen = supplies.find((s) => s.id === value.supplyId)
  return (
    <fieldset className="rounded-xl border border-gray-200 p-3">
      <legend className="px-1 text-sm font-medium text-gray-700">Suplemento (opcional)</legend>
      {supplies.length === 0 ? (
        <p className="text-sm text-gray-500">Cadastre o suplemento no Estoque para o app calcular o consumo e avisar antes de acabar.</p>
      ) : (
        <>
          <label className={label}>Produto do estoque
            <select value={value.supplyId} onChange={(e) => onChange({ ...value, supplyId: e.target.value, packageKg: '', unitPrice: '' })} className={`${input} bg-white`}>
              <option value="">Nenhum</option>
              {supplies.map((s) => <option key={s.id} value={s.id}>{s.name} ({fmtNumber(s.currentQuantity, 0)} {s.unit})</option>)}
            </select>
          </label>
          {value.supplyId && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className={label}>Consumo (% do peso vivo)
                <input inputMode="decimal" value={value.supplyPercent} onChange={(e) => onChange({ ...value, supplyPercent: decimal(e.target.value) })} placeholder="Ex.: 0,1" className={input} />
              </label>
              {chosen?.unit === 'sacos' && (
                <label className={label}>Peso do saco (kg)
                  <input inputMode="decimal" value={value.packageKg} onChange={(e) => onChange({ ...value, packageKg: decimal(e.target.value) })} placeholder={chosen.packageKg ? fmtNumber(chosen.packageKg, 0) : 'Ex.: 25'} className={input} />
                </label>
              )}
              <label className={label}>Preço por {chosen?.unit === 'sacos' ? 'saco' : chosen?.unit ?? 'unidade'} (R$, opcional)
                <input inputMode="decimal" value={value.unitPrice} onChange={(e) => onChange({ ...value, unitPrice: decimal(e.target.value) })} placeholder={chosen?.unitPrice ? fmtNumber(chosen.unitPrice, 2) : 'Ex.: 85,00'} className={input} />
              </label>
            </div>
          )}
          {value.supplyId && <p className="mt-2 text-xs text-gray-500">Exemplo: a 0,1% do peso vivo, um animal de 300 kg come 300 g por dia. O preço serve para mostrar o custo do trato por animal.</p>}
        </>
      )}
    </fieldset>
  )
}

function LotForm({ supplies, herd, lotNames, onClose, onSaved }: {
  supplies: SupplyRef[]
  herd: HerdAnimal[]
  lotNames: Map<string, string>
  onClose: () => void
  onSaved: (lot: Lot) => void
}) {
  const [mode, setMode] = useState<'animais' | 'quantidade'>(herd.length ? 'animais' : 'quantidade')
  const [form, setForm] = useState({ name: '', phase: 'engorda', startDate: todayISO(), headCount: '', avgWeight: '', targetWeight: '' })
  const [animalIds, setAnimalIds] = useState<string[]>([])
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [supply, setSupply] = useState<SupplyForm>(EMPTY_SUPPLY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const chosen = herd.filter((a) => animalIds.includes(a.id))
  const avg = averageOf(Object.fromEntries(animalIds.map((id) => [id, weights[id] ?? ''])))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'animais' && !animalIds.length) return setError('Escolha os animais do lote')
    if (mode === 'animais' && avg === null && !parseKg(form.avgWeight)) return setError('Informe o peso de entrada dos animais ou o peso médio do lote')
    setSaving(true)
    setError('')
    try {
      const body = mode === 'animais'
        ? { ...form, ...supply, animalIds, weights: Object.fromEntries(animalIds.map((id) => [id, weights[id] ?? ''])), headCount: animalIds.length }
        : { ...form, ...supply }
      onSaved(await send('/api/lotes', 'POST', body))
    } catch (err) {
      setError(offlineMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Novo lote" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className={label}>Nome do lote
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Garrotes de julho" className={input} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          {LOT_PHASES.map((p) => (
            <button key={p.key} type="button" aria-pressed={form.phase === p.key} onClick={() => setForm({ ...form, phase: p.key })}
              className={`rounded-xl border-2 py-2.5 text-sm font-semibold ${form.phase === p.key ? 'border-green-700 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>{p.label}</button>
          ))}
        </div>
        <label className={label}>Data de entrada
          <input type="date" required max={todayISO()} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={input} />
        </label>

        <fieldset>
          <legend className={label}>Como você acompanha este lote?</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {([['animais', 'Animais cadastrados', 'Peso de cada um'], ['quantidade', 'Só a quantidade', 'Peso médio do lote']] as const).map(([key, title, hint]) => (
              <button key={key} type="button" aria-pressed={mode === key} onClick={() => setMode(key)}
                className={`rounded-xl border-2 px-3 py-2 text-left ${mode === key ? 'border-green-700 bg-green-50' : 'border-gray-200'}`}>
                <span className={`block text-sm font-semibold ${mode === key ? 'text-green-800' : 'text-gray-700'}`}>{title}</span>
                <span className="block text-xs text-gray-500">{hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {mode === 'animais' ? (
          <>
            <AnimalPicker herd={herd} lotNames={lotNames} selected={animalIds} onChange={setAnimalIds} />
            {chosen.length > 0 && (
              <div>
                <p className={label}>Peso de entrada (opcional, mas é com ele que o app calcula o ganho de cada animal)</p>
                <div className="mt-1"><WeightList animals={chosen} weights={weights} onChange={setWeights} /></div>
                {avg !== null
                  ? <p className="mt-1 text-sm text-gray-700">Peso médio de entrada: <strong>{kg(avg)}</strong></p>
                  : <label className={`${label} mt-2`}>Sem pesar agora? Informe o peso médio estimado (kg)
                      <input inputMode="decimal" value={form.avgWeight} onChange={(e) => setForm({ ...form, avgWeight: decimal(e.target.value) })} placeholder="Ex.: 250" className={input} />
                    </label>}
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>Cabeças
              <input required inputMode="numeric" value={form.headCount} onChange={(e) => setForm({ ...form, headCount: e.target.value.replace(/\D/g, '') })} className={input} />
            </label>
            <label className={label}>Peso médio de entrada (kg)
              <input required inputMode="decimal" value={form.avgWeight} onChange={(e) => setForm({ ...form, avgWeight: decimal(e.target.value) })} placeholder="Ex.: 300" className={input} />
            </label>
          </div>
        )}

        <label className={label}>Peso de saída desejado por cabeça (kg, opcional)
          <input inputMode="decimal" value={form.targetWeight} onChange={(e) => setForm({ ...form, targetWeight: decimal(e.target.value) })} placeholder="Ex.: 540" className={input} />
        </label>
        <SupplyFields supplies={supplies} value={supply} onChange={setSupply} />
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700">Cancelar</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-green-700 py-3 font-semibold text-white disabled:bg-gray-300">{saving ? 'Salvando...' : 'Criar lote'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Detalhe: pesagem, animais, previsão, suplemento, saída ──────────────

function ProjectionChart({ weighings, projection, target }: { weighings: Weighing[]; projection: { date: string } | null; target: number | null }) {
  if (weighings.length < 1) return null
  const points = weighings.map((w) => ({ date: w.date, value: w.avgWeight }))
  const end = projection && target ? { date: projection.date, value: target } : null
  const all = end ? [...points, end] : points
  const t0 = Date.parse(all[0].date)
  const t1 = Math.max(Date.parse(all[all.length - 1].date), t0 + 86_400_000)
  const values = all.map((p) => p.value)
  const min = Math.floor(Math.min(...values) / 20) * 20 - 20
  const max = Math.ceil(Math.max(...values) / 20) * 20 + 20
  const W = 600, H = 200, L = 44, B = 24, T = 10, R = 12
  const x = (d: string) => L + ((Date.parse(d) - t0) / (t1 - t0)) * (W - L - R)
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const ticks = [min, (min + max) / 2, max]
  const label = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  return (
    <figure className="rounded-xl border border-gray-100 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Peso médio do lote ao longo do tempo e projeção até o peso de saída">
        {ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e5e7eb" strokeDasharray="3 3" /><text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#6b7280">{Math.round(v)}</text></g>)}
        <path d={path} fill="none" stroke="#15803d" strokeWidth="2.5" />
        {points.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r="4" fill="#fff" stroke="#15803d" strokeWidth="2" />)}
        {end && <><line x1={x(last.date)} y1={y(last.value)} x2={x(end.date)} y2={y(end.value)} stroke="#d97706" strokeWidth="2.5" strokeDasharray="6 5" /><circle cx={x(end.date)} cy={y(end.value)} r="4" fill="#d97706" /></>}
        <text x={L} y={H - 6} fontSize="11" fill="#6b7280">{label(all[0].date)}</text>
        <text x={W - R} y={H - 6} fontSize="11" fill="#6b7280" textAnchor="end">{label(all[all.length - 1].date)}</text>
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-gray-600">
        <span><span className="mr-1 inline-block h-0.5 w-4 bg-green-700 align-middle" />Pesagens</span>
        {end && <span><span className="mr-1 inline-block h-0.5 w-4 border-t-2 border-dashed border-amber-600 align-middle" />Previsão</span>}
      </figcaption>
    </figure>
  )
}

function LotDetail({ lot, supplies, herd, lotNames, canEdit, today, focus, onClose, onChanged, onDeleted }: {
  lot: Lot
  supplies: SupplyRef[]
  herd: HerdAnimal[]
  lotNames: Map<string, string>
  canEdit: boolean
  today: string
  focus?: 'pesar' | 'animais'
  onClose: () => void
  onChanged: (lot: Lot) => void
  onDeleted: () => void
}) {
  const { confirm } = useDialog()
  const s = lotSummary(lot.weighings, today, lot.endDate)
  const supply = supplyLine(lot)
  const arrobas = arrobasProduced(s)
  const projection = lot.endDate ? null : projectTarget(s, lot.targetWeight)
  const hasAnimals = lot.animals.length > 0
  const [weighing, setWeighing] = useState({ date: today, headCount: String(s.last?.headCount ?? ''), avgWeight: '' })
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState<string[] | null>(focus === 'animais' ? [] : null)
  const [editingSupply, setEditingSupply] = useState(false)
  const [supplyForm, setSupplyForm] = useState<SupplyForm>({ ...EMPTY_SUPPLY, supplyId: lot.supply?.id ?? '', supplyPercent: lot.supplyPercent ? String(lot.supplyPercent).replace('.', ',') : '' })
  const [target, setTarget] = useState(lot.targetWeight ? String(lot.targetWeight).replace('.', ',') : '')
  const [endDate, setEndDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const previous = useMemo(() => new Map(lot.animals.flatMap((a) => { const w = lastWeight(a); return w === null ? [] : [[a.id, w] as const] })), [lot.animals])
  const rows = useMemo(() => lot.weighings.map((w, i) => {
    const prev = lot.weighings[i - 1]
    const days = prev ? daysBetween(prev.date, w.date) : 0
    return { ...w, gmd: prev && days > 0 ? (w.avgWeight - prev.avgWeight) / days : null }
  }).reverse(), [lot.weighings])

  useEffect(() => {
    if (focus === 'pesar') document.getElementById('pesagem')?.scrollIntoView({ block: 'start' })
  }, [focus])

  async function run(action: () => Promise<Lot | null>) {
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
    void run(async () => {
      const updated = await send(`/api/lotes/${lot.id}/pesagens`, 'POST', hasAnimals ? { date: weighing.date, weights } : weighing)
      setWeights({})
      setWeighing({ ...weighing, avgWeight: '' })
      return updated
    })
  }
  const removeWeighing = async (id: string) => {
    if (!(await confirm({ title: 'Apagar esta pesagem?', message: hasAnimals ? 'Os pesos de cada animal nesse dia também serão apagados.' : undefined, confirmLabel: 'Apagar', danger: true }))) return
    void run(() => send(`/api/lotes/${lot.id}/pesagens`, 'DELETE', { weighingId: id }))
  }
  const addAnimals = () => void run(async () => {
    const updated = await send(`/api/lotes/${lot.id}`, 'PATCH', { addAnimalIds: adding })
    setAdding(null)
    return updated
  })
  const removeAnimal = async (a: LotAnimal) => {
    if (!(await confirm({ title: `Tirar ${tag(a)} ${a.name} do lote?`, message: 'As pesagens dele continuam guardadas.', confirmLabel: 'Tirar do lote' }))) return
    void run(() => send(`/api/lotes/${lot.id}`, 'PATCH', { removeAnimalIds: [a.id] }))
  }
  const saveTarget = () => void run(() => send(`/api/lotes/${lot.id}`, 'PATCH', { targetWeight: target }))
  const saveSupply = () => void run(async () => {
    const updated = await send(`/api/lotes/${lot.id}`, 'PATCH', supplyForm)
    setEditingSupply(false)
    return updated
  })
  const close = async () => {
    if (!(await confirm({ title: `Encerrar o lote ${lot.name}?`, message: 'Use quando o lote sair: vendido, abatido ou mudou de fase. Ele fica guardado em Encerrados.', confirmLabel: 'Encerrar' }))) return
    void run(() => send(`/api/lotes/${lot.id}`, 'PATCH', { endDate }))
  }
  const reopen = () => void run(() => send(`/api/lotes/${lot.id}`, 'PATCH', { endDate: null }))
  const remove = async () => {
    if (!(await confirm({ title: `Excluir o lote ${lot.name}?`, message: 'As pesagens também serão apagadas e os animais saem do lote. Para guardar o histórico, prefira encerrar o lote.', confirmLabel: 'Excluir', danger: true }))) return
    setBusy(true)
    try { await send(`/api/lotes/${lot.id}`, 'DELETE', {}); onDeleted() } catch (err) { setError((err as Error).message); setBusy(false) }
  }

  return (
    <Modal title={lot.name} subtitle={`${phaseLabel(lot.phase)} · entrada em ${fmtDate(lot.startDate)}${lot.endDate ? ` · saiu em ${fmtDate(lot.endDate)}` : ''}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
        {[
          ['Entrada', s.entry ? kg(s.entry.avgWeight) : '—'],
          ['Última pesagem', s.last ? kg(s.last.avgWeight) : '—'],
          ['Ganho por cabeça', s.gainKg !== null ? kg(s.gainKg) : '—'],
          ['Ganho por dia', s.gmd !== null ? `${fmtNumber(s.gmd, 3)} kg` : '—'],
          ['@ produzidas', arrobas !== null ? fmtNumber(arrobas) : '—'],
        ].map(([title, value]) => (
          <div key={title} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">{title}</p>
            <p className="text-lg font-bold text-gray-800">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-gray-600">
        {hasAnimals ? lot.animals.length : s.last?.headCount ?? 0} cabeças · {s.days} dia{s.days === 1 ? '' : 's'} no lote
        {arrobas !== null && <span className="text-gray-500"> · arrobas estimadas pelo peso vivo ({LIVE_KG_PER_ARROBA} kg = 1 @, rendimento de 50%)</span>}
      </p>

      {/* Previsão de abate */}
      <section className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Previsão de saída</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium text-gray-700">Peso de saída desejado (kg)
            <input inputMode="decimal" value={target} onChange={(e) => setTarget(decimal(e.target.value))} placeholder="Ex.: 540" disabled={!canEdit} className={`${input} w-40`} />
          </label>
          {canEdit && target !== (lot.targetWeight ? String(lot.targetWeight).replace('.', ',') : '') && (
            <button type="button" onClick={saveTarget} disabled={busy} className="rounded-xl bg-green-700 px-4 py-2.5 font-semibold text-white disabled:bg-gray-300">Salvar</button>
          )}
        </div>
        {lot.targetWeight && s.last && (
          s.last.avgWeight >= lot.targetWeight
            ? <p className="mt-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800">O lote já chegou ao peso de saída ({kg(s.last.avgWeight)}).</p>
            : projection
              ? <div className="mt-3 grid grid-cols-3 gap-2">
                  {[['Faltam', kg(projection.remainingKg)], ['Dias restantes', String(projection.days)], ['Previsão de saída', fmtDate(projection.date)]].map(([title, value]) => (
                    <div key={title} className="rounded-lg border border-amber-100 bg-amber-50 p-3"><p className="text-xs text-amber-900">{title}</p><p className="whitespace-nowrap text-base font-bold text-amber-900 sm:text-lg">{value}</p></div>
                  ))}
                </div>
              : <p className="mt-2 text-sm text-gray-500">Faça mais uma pesagem para o app calcular o ganho por dia e prever a saída.</p>
        )}
        {lot.weighings.length > 0 && <div className="mt-3"><ProjectionChart weighings={lot.weighings} projection={projection} target={lot.targetWeight} /></div>}
      </section>

      {/* Pesagem */}
      {canEdit && !lot.endDate && (
        <section id="pesagem" className="mt-5 scroll-mt-4">
          <h3 className="mb-2 text-sm font-semibold text-gray-700">Nova pesagem</h3>
          <form onSubmit={saveWeighing} className="rounded-xl bg-green-50 p-3">
            <label className="text-sm font-medium text-gray-700">Data
              <input type="date" required max={today} value={weighing.date} onChange={(e) => setWeighing({ ...weighing, date: e.target.value })} className={`${input} sm:w-56`} />
            </label>
            {hasAnimals ? (
              <div className="mt-3">
                <WeightList animals={lot.animals} weights={weights} onChange={setWeights} previous={previous} />
                {averageOf(weights) !== null && <p className="mt-2 text-sm text-gray-700">Peso médio desta pesagem: <strong>{kg(averageOf(weights)!)}</strong></p>}
              </div>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="text-sm font-medium text-gray-700">Cabeças
                  <input required inputMode="numeric" value={weighing.headCount} onChange={(e) => setWeighing({ ...weighing, headCount: e.target.value.replace(/\D/g, '') })} className={input} />
                </label>
                <label className="text-sm font-medium text-gray-700">Peso médio (kg)
                  <input required inputMode="decimal" value={weighing.avgWeight} onChange={(e) => setWeighing({ ...weighing, avgWeight: decimal(e.target.value) })} className={input} />
                </label>
              </div>
            )}
            <button type="submit" disabled={busy || (hasAnimals && averageOf(weights) === null)} className="mt-3 w-full rounded-xl bg-green-700 py-3 font-semibold text-white disabled:bg-gray-300">Salvar pesagem</button>
          </form>
        </section>
      )}

      {/* Animais do lote */}
      {(hasAnimals || canEdit) && (
        <section className="mt-5">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Animais do lote</h3>
            {canEdit && !lot.endDate && adding === null && <button type="button" onClick={() => setAdding([])} className="text-sm font-semibold text-green-700 hover:underline">+ Animais</button>}
          </div>
          {adding !== null && (
            <div className="mb-3 rounded-xl border border-gray-200 p-3">
              <AnimalPicker herd={herd} lotNames={lotNames} exclude={lot.animals.map((a) => a.id)} selected={adding} onChange={setAdding} />
              <div className="mt-2 flex gap-2">
                <button type="button" onClick={() => setAdding(null)} className="flex-1 rounded-xl border border-gray-300 py-2.5 font-semibold text-gray-700">Cancelar</button>
                <button type="button" onClick={addAnimals} disabled={busy || adding.length === 0} className="flex-1 rounded-xl bg-green-700 py-2.5 font-semibold text-white disabled:bg-gray-300">Pôr no lote</button>
              </div>
            </div>
          )}
          {hasAnimals ? (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 whitespace-nowrap">
                  <tr><th className="px-3 py-2 text-left">Animal</th><th className="px-3 py-2 text-right">Entrada</th><th className="px-3 py-2 text-right">Último</th><th className="px-3 py-2 text-right whitespace-nowrap">Por dia</th>{canEdit && !lot.endDate && <th className="px-3 py-2" />}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {lot.animals.map((a) => {
                    // Ganho só desde a entrada neste lote (o animal pode ter vindo de outro)
                    const g = animalGain(a.weighings.filter((w) => w.date >= lot.startDate))
                    return (
                      <tr key={a.id}>
                        <td className="px-3 py-2"><span className="font-semibold text-gray-900">{tag(a)}</span> <span className="text-gray-600">{a.name}</span></td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-gray-600">{g.entry ? kg(g.entry.weight) : '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-gray-800">{g.last ? kg(g.last.weight) : '—'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right text-green-700">{g.gmd !== null ? `${fmtNumber(g.gmd, 3)} kg` : '—'}</td>
                        {canEdit && !lot.endDate && <td className="px-3 py-2 text-right"><button type="button" onClick={() => void removeAnimal(a)} className="text-xs font-semibold text-gray-600 hover:underline">Tirar</button></td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : adding === null && <p className="text-sm text-gray-500">Este lote acompanha só a quantidade e o peso médio. Para pesar cada animal, ponha os animais cadastrados no lote.</p>}
        </section>
      )}

      {/* Suplemento */}
      <section className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Suplemento</h3>
        {editingSupply ? (
          <div className="flex flex-col gap-2">
            <SupplyFields supplies={supplies} value={supplyForm} onChange={setSupplyForm} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditingSupply(false)} className="flex-1 rounded-xl border border-gray-300 py-2.5 font-semibold text-gray-700">Cancelar</button>
              <button type="button" onClick={saveSupply} disabled={busy} className="flex-1 rounded-xl bg-green-700 py-2.5 font-semibold text-white disabled:bg-gray-300">Salvar</button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-100 p-3 text-sm text-gray-700">
            {lot.supply ? (
              <>
                <p><strong>{lot.supply.name}</strong>{lot.supplyPercent ? ` a ${fmtNumber(lot.supplyPercent, 2)}% do peso vivo` : ''}</p>
                {supply ? (
                  <p className="mt-1">
                    {kg(supply.perDay)} por dia para o lote{supply.perHead !== null ? ` (${fmtNumber(supply.perHead, 0)} g por cabeça)` : ''}.
                    {supply.days !== null && <span className={supply.days <= STOCK_WARNING_DAYS ? ' font-semibold text-amber-700' : ''}> O estoque dá para {supply.days} dia{supply.days === 1 ? '' : 's'}.</span>}
                  </p>
                ) : <p className="mt-1 text-gray-500">Informe o consumo em % do peso vivo para calcular quanto o lote come.</p>}
              </>
            ) : <p className="text-gray-500">Nenhum suplemento ligado a este lote.</p>}
            {canEdit && <button type="button" onClick={() => setEditingSupply(true)} className="mt-2 font-semibold text-green-700 hover:underline">{lot.supply ? 'Alterar' : 'Ligar suplemento'}</button>}
          </div>
        )}
      </section>

      {/* Trato no cocho */}
      {lot.supply && <FeedingSection lot={lot} canEdit={canEdit} today={today} busy={busy} run={run} />}

      {/* Histórico de pesagens */}
      <section className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Pesagens</h3>
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500 whitespace-nowrap">
              <tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-right">Cab.</th><th className="px-3 py-2 text-right">Peso médio</th><th className="px-3 py-2 text-right whitespace-nowrap">Por dia</th>{canEdit && <th className="px-3 py-2" />}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((w, i) => (
                <tr key={w.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-700">{fmtDate(w.date)}{i === rows.length - 1 && <span className="ml-1.5 text-xs text-gray-400">entrada</span>}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{w.headCount}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-gray-800">{kg(w.avgWeight)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-green-700">{w.gmd !== null ? `${fmtNumber(w.gmd, 3)} kg` : '—'}</td>
                  {canEdit && <td className="px-3 py-2 text-right">{i < rows.length - 1 && <button type="button" onClick={() => void removeWeighing(w.id)} className="text-xs font-semibold text-red-700 hover:underline">Apagar</button>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {canEdit && (
        <section className="mt-6 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
          {lot.endDate ? (
            <button type="button" onClick={reopen} disabled={busy} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">Reabrir lote</button>
          ) : (
            <>
              <label className="text-sm font-medium text-gray-700">Data de saída
                <input type="date" max={today} min={lot.startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
              </label>
              <button type="button" onClick={() => void close()} disabled={busy} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">Encerrar lote</button>
            </>
          )}
          <button type="button" onClick={() => void remove()} disabled={busy} className="ml-auto text-sm font-semibold text-red-700 hover:underline">Excluir lote</button>
        </section>
      )}
    </Modal>
  )
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-800">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1 text-gray-400 hover:text-gray-600"><FecharIcon /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── Trato no cocho: lançar o que foi dado, baixa no estoque e custo ─────

function FeedingSection({ lot, canEdit, today, busy, run }: {
  lot: Lot
  canEdit: boolean
  today: string
  busy: boolean
  run: (action: () => Promise<Lot | null>) => Promise<void>
}) {
  const { confirm } = useDialog()
  const s = lotSummary(lot.weighings, today, lot.endDate)
  const suggestion = dailySupplyKg(s.last, lot.supplyPercent)
  const heads = lot.animals.length || s.last?.headCount || 0
  const summary = feedingSummary(lot.feedings, heads)
  const supply = lot.supply!
  const [form, setForm] = useState({ date: today, kg: suggestion ? String(suggestion).replace('.', ',') : '' })
  const kgValue = parseKg(form.kg)
  const inStock = kgValue !== null ? kgInStockUnit(supply, kgValue) : null
  const perKg = pricePerKg(supply)
  const recent = [...lot.feedings].reverse().slice(0, 7)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    void run(async () => send(`/api/lotes/${lot.id}/tratos`, 'POST', form))
  }
  const remove = async (id: string) => {
    if (!(await confirm({ title: 'Apagar este trato?', message: 'A quantidade volta para o estoque.', confirmLabel: 'Apagar', danger: true }))) return
    void run(() => send(`/api/lotes/${lot.id}/tratos`, 'DELETE', { feedingId: id }))
  }

  return (
    <section className="mt-5">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">Trato no cocho</h3>
      {lot.feedings.length > 0 && (
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ['Dado no total', kg(summary.kg)],
            ['Previsto x dado', summary.percent !== null ? `${fmtNumber(summary.percent, 0)}%` : '—'],
            ['Custo total', summary.cost !== null ? fmtMoney(summary.cost) : '—'],
            ['Custo por cabeça', summary.costPerHead !== null ? fmtMoney(summary.costPerHead) : '—'],
          ].map(([title, value]) => (
            <div key={title} className="rounded-lg border border-gray-100 bg-gray-50 p-3"><p className="text-xs text-gray-500">{title}</p><p className="text-base font-bold text-gray-800">{value}</p></div>
          ))}
        </div>
      )}
      {lot.feedings.length > 0 && (
        <p className="mb-2 text-xs text-gray-500">
          {summary.days} dia{summary.days === 1 ? '' : 's'} de trato
          {summary.costPerHeadDay !== null ? ` · ${fmtMoney(summary.costPerHeadDay)} por cabeça por dia` : ''}
          {summary.cost === null ? ' · informe o preço do produto no Estoque ou no suplemento do lote para ver o custo' : ''}
          {summary.partialCost ? ' · alguns tratos foram lançados antes do preço e ficaram sem custo' : ''}
        </p>
      )}
      {canEdit && !lot.endDate && (
        <form onSubmit={save} className="rounded-xl bg-amber-50 p-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-sm font-medium text-gray-700">Data
              <input type="date" required max={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} />
            </label>
            <label className="text-sm font-medium text-gray-700">Quanto foi dado (kg)
              <input required inputMode="decimal" value={form.kg} onChange={(e) => setForm({ ...form, kg: decimal(e.target.value) })} className={input} />
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-700">
            {suggestion ? `Sugestão pelo % do peso vivo: ${kg(suggestion)} por dia. ` : ''}
            {kgValue !== null && inStock !== null && supply.unit === 'sacos' ? `Sai do estoque: ${fmtNumber(inStock, 2)} saco${inStock === 1 ? '' : 's'}. ` : ''}
            {kgValue !== null && perKg !== null ? `Custo: ${fmtMoney(kgValue * perKg)}.` : ''}
            {supply.unit === 'sacos' && !supply.packageKg ? 'Informe o peso do saco no suplemento do lote para dar baixa no estoque.' : ''}
          </p>
          <button type="submit" disabled={busy || kgValue === null} className="mt-2 w-full rounded-xl bg-amber-600 py-3 font-semibold text-white disabled:bg-gray-300">Lançar trato e dar baixa no estoque</button>
        </form>
      )}
      {recent.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-100 text-sm">
          {recent.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="text-gray-700">{fmtDate(f.date)}</span>
              <span className="flex items-center gap-3">
                <span className="font-semibold text-gray-800">{kg(f.kg)}</span>
                {f.cost !== null && <span className="text-gray-500">{fmtMoney(f.cost)}</span>}
                {canEdit && <button type="button" onClick={() => void remove(f.id)} className="text-xs font-semibold text-red-700 hover:underline">Apagar</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
