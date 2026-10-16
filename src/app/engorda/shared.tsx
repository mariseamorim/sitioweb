'use client'

// Peças comuns da tela de Recria e engorda: tipos, contas da tela e componentes pequenos

import { useState } from 'react'
import { FecharIcon } from '@/components/ModuleIcons'
import { Feeding, LOT_PHASES, Weighing, dailySupplyKg, daysOfStock, lotSummary, stockKg } from '@/lib/lots'
import { fmtNumber } from '@/lib/reports'
import { todayISO } from '@/lib/utils'

export interface SupplyRef { id: string; name: string; unit: string; currentQuantity: number; packageKg: number | null; unitPrice?: number | null }
export interface Coverage {
  id: string
  heatDate: string | null
  method: string | null
  coverageDate: string
  expectedBirthDate: string | null
  semenBatch: string | null
  bullRegistry: string | null
  maleName: string | null
  status: string
}
export interface LotAnimal {
  id: string
  code: string
  customCode: string | null
  name: string
  gender: string
  birthDate: string
  weighings: { date: string; weight: number }[]
  reproductions: Coverage[]
}
export interface Lot {
  id: string
  name: string
  phase: string
  startDate: string
  endDate: string | null
  targetWeight: number | null
  notes: string | null
  supplies: { id: string; percent: number | null; supply: SupplyRef }[]
  weighings: (Weighing & { id: string })[]
  feedings: (Feeding & { id: string; supplyId: string | null })[]
  animals: LotAnimal[]
}
/** Animal do rebanho, para escolher quem entra no lote */
export interface HerdAnimal { id: string; code: string; customCode: string | null; name: string; species: string; status: string; lotId: string | null }

export const input = 'mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
export const label = 'block text-sm font-medium text-gray-700'
export const phaseLabel = (p: string) => LOT_PHASES.find((x) => x.key === p)?.label ?? p
export const kg = (n: number) => `${fmtNumber(n)} kg`
export const decimal = (v: string) => v.replace(/[^\d.,]/g, '')
export const tag = (a: { code: string; customCode: string | null }) => `#${a.customCode || a.code}`
export const lastWeight = (a: LotAnimal) => a.weighings[a.weighings.length - 1]?.weight ?? null
export const parseKg = (v: string) => { const n = Number(v.replace(',', '.')); return v.trim() && Number.isFinite(n) && n > 0 ? n : null }
export const toField = (n: number | null | undefined) => (n ? String(n).replace('.', ',') : '')

export async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Não foi possível salvar')
  return data
}

export const offlineMessage = (err: unknown) => (navigator.onLine ? (err as Error).message : 'Sem internet. Os lotes precisam de conexão para salvar.')

/** Consumo de cada produto do lote por dia e para quantos dias o estoque dá */
export function productLines(lot: Lot) {
  const s = lotSummary(lot.weighings, todayISO(), lot.endDate)
  return lot.supplies.map((item) => {
    const perDay = dailySupplyKg(s.last, item.percent)
    return {
      ...item,
      perDay,
      perHead: perDay && s.last ? Math.round((perDay / s.last.headCount) * 1000) : null,
      days: perDay && !lot.endDate ? daysOfStock(stockKg(item.supply), perDay) : null,
    }
  })
}

export function Stat({ title, value, tone = 'text-gray-900' }: { title: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50 px-2 py-2.5 text-center">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{title}</p>
      <p className={`mt-1 text-base font-bold ${tone}`}>{value}</p>
    </div>
  )
}

export function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
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

// ── Escolher animais do rebanho ─────────────────────────────────────────

export function AnimalPicker({ herd, lotNames, exclude = [], selected, onChange }: {
  herd: HerdAnimal[]
  lotNames: Map<string, string>
  /** Animais que já estão no lote (não aparecem) */
  exclude?: string[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [q, setQ] = useState('')
  const term = q.trim().toLowerCase()
  const available = herd.filter((a) => !exclude.includes(a.id))
  const list = available.filter((a) => !term || [a.code, a.customCode, a.name, a.species].some((v) => v?.toLowerCase().includes(term)))
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  const allIds = list.map((a) => a.id)
  const allOn = allIds.length > 0 && allIds.every((id) => selected.includes(id))

  if (available.length === 0) return <p className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600">Nenhum animal disponível. Cadastre os animais na tela Animais.</p>
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
export function WeightList({ animals, weights, onChange, previous }: {
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

export const averageOf = (weights: Record<string, string>) => {
  const values = Object.values(weights).map(parseKg).filter((v): v is number => v !== null)
  return values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
}

// ── Produtos do lote (vários) ───────────────────────────────────────────

export interface ProductForm { supplyId: string; percent: string; packageKg: string; unitPrice: string }

export const productsFromLot = (lot: Lot): ProductForm[] =>
  lot.supplies.map((s) => ({ supplyId: s.supply.id, percent: toField(s.percent), packageKg: '', unitPrice: '' }))

/** Escolher os produtos que o lote recebe, cada um com o consumo em % do peso vivo */
export function ProductsEditor({ supplies, value, onChange }: { supplies: SupplyRef[]; value: ProductForm[]; onChange: (v: ProductForm[]) => void }) {
  const chosen = new Set(value.map((p) => p.supplyId))
  const free = supplies.filter((s) => !chosen.has(s.id))
  const set = (i: number, patch: Partial<ProductForm>) => onChange(value.map((p, j) => (j === i ? { ...p, ...patch } : p)))

  if (supplies.length === 0) {
    return <p className="rounded-xl border border-gray-200 p-3 text-sm text-gray-500">Cadastre os produtos (suplemento, sal, ração) no Estoque para o app calcular o consumo, dar baixa no trato e avisar antes de acabar.</p>
  }
  return (
    <fieldset className="rounded-xl border border-gray-200 p-3">
      <legend className="px-1 text-sm font-medium text-gray-700">Produtos do lote (opcional)</legend>
      {value.length === 0 && <p className="text-sm text-gray-500">Nenhum produto. Adicione o que o lote recebe no cocho.</p>}
      <ul className="space-y-3">
        {value.map((p, i) => {
          const supply = supplies.find((s) => s.id === p.supplyId)
          const unit = supply?.unit === 'sacos' ? 'saco' : supply?.unit ?? 'unidade'
          return (
            <li key={p.supplyId} className="rounded-lg bg-gray-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-900">{supply?.name ?? 'Produto'} <span className="text-xs font-normal text-gray-500">({fmtNumber(supply?.currentQuantity ?? 0, 0)} {supply?.unit} no estoque)</span></p>
                <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} className="text-xs font-semibold text-red-700 hover:underline">Tirar</button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                <label className="text-xs font-medium text-gray-600">Consumo (% do peso vivo)
                  <input inputMode="decimal" value={p.percent} onChange={(e) => set(i, { percent: decimal(e.target.value) })} placeholder="Ex.: 0,1" className={input} />
                </label>
                {supply?.unit === 'sacos' && (
                  <label className="text-xs font-medium text-gray-600">Peso do saco (kg)
                    <input inputMode="decimal" value={p.packageKg} onChange={(e) => set(i, { packageKg: decimal(e.target.value) })} placeholder={supply.packageKg ? fmtNumber(supply.packageKg, 0) : 'Ex.: 25'} className={input} />
                  </label>
                )}
                <label className="text-xs font-medium text-gray-600">Preço por {unit} (R$, opcional)
                  <input inputMode="decimal" value={p.unitPrice} onChange={(e) => set(i, { unitPrice: decimal(e.target.value) })} placeholder={supply?.unitPrice ? fmtNumber(supply.unitPrice, 2) : 'Ex.: 85,00'} className={input} />
                </label>
              </div>
            </li>
          )
        })}
      </ul>
      {free.length > 0 && (
        <label className="mt-3 block text-sm font-medium text-gray-700">+ Adicionar produto
          <select value="" onChange={(e) => e.target.value && onChange([...value, { supplyId: e.target.value, percent: '', packageKg: '', unitPrice: '' }])} className={`${input} bg-white`}>
            <option value="">Escolha um produto do estoque</option>
            {free.map((s) => <option key={s.id} value={s.id}>{s.name} ({fmtNumber(s.currentQuantity, 0)} {s.unit})</option>)}
          </select>
        </label>
      )}
      <p className="mt-2 text-xs text-gray-500">Exemplo: a 0,1% do peso vivo, um animal de 300 kg come 300 g por dia. O preço serve para mostrar o custo por animal.</p>
    </fieldset>
  )
}

/** Payload dos produtos para a API (manda peso do saco e preço só se foram digitados) */
export const productsPayload = (value: ProductForm[]) => value.map((p) => ({ supplyId: p.supplyId, percent: p.percent, packageKg: p.packageKg, unitPrice: p.unitPrice }))
