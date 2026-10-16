// Contas da recria e engorda (sem banco: usadas na tela e no servidor)

export const LOT_PHASES = [
  { key: 'recria', label: 'Recria' },
  { key: 'engorda', label: 'Engorda' },
] as const

export type LotPhase = (typeof LOT_PHASES)[number]['key']

export const isLotPhase = (v: unknown): v is LotPhase => v === 'recria' || v === 'engorda'

export interface Weighing {
  /** yyyy-mm-dd */
  date: string
  headCount: number
  /** kg por cabeça */
  avgWeight: number
}

export interface LotSummary {
  entry: Weighing | null
  last: Weighing | null
  days: number
  /** kg ganhos por cabeça desde a entrada */
  gainKg: number | null
  /** ganho médio diário (kg por cabeça por dia) */
  gmd: number | null
}

const DAY = 86_400_000
export const daysBetween = (from: string, to: string) => Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY)

/** Entrada, última pesagem, ganho e GMD. `today` conta os dias de um lote ainda aberto. */
export function lotSummary(weighings: Weighing[], today: string, endDate?: string | null): LotSummary {
  const sorted = [...weighings].sort((a, b) => a.date.localeCompare(b.date))
  const entry = sorted[0] ?? null
  const last = sorted[sorted.length - 1] ?? null
  const days = entry ? Math.max(daysBetween(entry.date, endDate ?? today), 0) : 0
  if (!entry || !last || last === entry) return { entry, last, days, gainKg: null, gmd: null }
  const gainKg = Math.round((last.avgWeight - entry.avgWeight) * 10) / 10
  const weighedDays = daysBetween(entry.date, last.date)
  const gmd = weighedDays > 0 ? Math.round((gainKg / weighedDays) * 1000) / 1000 : null
  return { entry, last, days, gainKg, gmd }
}

/** kg de suplemento por dia para o lote: peso médio × cabeças × % do peso vivo */
export function dailySupplyKg(last: Weighing | null, percent: number | null | undefined): number | null {
  if (!last || !percent) return null
  return Math.round(last.avgWeight * last.headCount * (percent / 100) * 10) / 10
}

/** Estoque do insumo em kg, quando dá para saber (kg, ou sacos com o peso do saco) */
export function stockKg(supply: { unit: string; currentQuantity: number; packageKg?: number | null }): number | null {
  if (supply.unit === 'kg') return supply.currentQuantity
  if (supply.unit === 'sacos' && supply.packageKg) return supply.currentQuantity * supply.packageKg
  return null
}

/** Em quantos dias o estoque acaba com esse consumo diário */
export function daysOfStock(stock: number | null, perDay: number | null): number | null {
  if (stock === null || !perDay) return null
  return Math.max(Math.floor(stock / perDay), 0)
}

/** Dias de estoque a partir dos quais o aviso aparece */
export const STOCK_WARNING_DAYS = 10

/** Quilos de peso vivo por arroba produzida: 15 kg de carcaça com rendimento de 50% */
export const LIVE_KG_PER_ARROBA = 30

/** Arrobas produzidas pelo lote: ganho por cabeça × cabeças ÷ 30 (estimativa pelo peso vivo) */
export function arrobasProduced(summary: LotSummary): number | null {
  if (summary.gainKg === null || !summary.last || summary.gainKg <= 0) return null
  return Math.round((summary.gainKg * summary.last.headCount / LIVE_KG_PER_ARROBA) * 10) / 10
}

export interface Projection {
  /** kg que faltam por cabeça */
  remainingKg: number
  days: number
  /** yyyy-mm-dd */
  date: string
}

/** Quando o lote chega ao peso-alvo, no ritmo de ganho atual. null se não dá para prever (sem ganho ou já chegou). */
export function projectTarget(summary: LotSummary, target: number | null | undefined): Projection | null {
  if (!target || !summary.last || !summary.gmd || summary.gmd <= 0) return null
  const remainingKg = Math.round((target - summary.last.avgWeight) * 10) / 10
  if (remainingKg <= 0) return null
  const days = Math.ceil(remainingKg / summary.gmd)
  const date = new Date(`${summary.last.date}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return { remainingKg, days, date: date.toISOString().slice(0, 10) }
}

/** Ganho de um animal pelas pesagens dele (a primeira é a entrada) */
export function animalGain(weighings: { date: string; weight: number }[]) {
  const sorted = [...weighings].sort((a, b) => a.date.localeCompare(b.date))
  const entry = sorted[0] ?? null
  const last = sorted[sorted.length - 1] ?? null
  if (!entry || !last || entry === last) return { entry, last, gainKg: null, gmd: null }
  const gainKg = Math.round((last.weight - entry.weight) * 10) / 10
  const days = daysBetween(entry.date, last.date)
  return { entry, last, gainKg, gmd: days > 0 ? Math.round((gainKg / days) * 1000) / 1000 : null }
}

type StockUnit = { unit: string; packageKg?: number | null; unitPrice?: number | null }

/** kg do trato na unidade do estoque (kg, ou sacos pelo peso do saco); null se não dá para converter */
export function kgInStockUnit(supply: StockUnit, kg: number): number | null {
  if (supply.unit === 'kg') return kg
  if (supply.unit === 'sacos' && supply.packageKg) return Math.round((kg / supply.packageKg) * 1000) / 1000
  return null
}

/** Preço por kg pelo preço da unidade do estoque; null sem preço */
export function pricePerKg(supply: StockUnit): number | null {
  if (!supply.unitPrice) return null
  if (supply.unit === 'kg') return supply.unitPrice
  if (supply.unit === 'sacos' && supply.packageKg) return supply.unitPrice / supply.packageKg
  return null
}

export interface Feeding { date: string; kg: number; suggestedKg: number | null; cost: number | null }

/** Trato do lote: total dado, previsto pelo % do peso vivo, custo total e por cabeça */
export function feedingSummary(feedings: Feeding[], heads: number) {
  const kg = feedings.reduce((s, f) => s + f.kg, 0)
  const withSuggestion = feedings.filter((f) => f.suggestedKg)
  const suggested = withSuggestion.reduce((s, f) => s + f.suggestedKg!, 0)
  const priced = feedings.filter((f) => f.cost !== null)
  const cost = priced.length ? priced.reduce((s, f) => s + f.cost!, 0) : null
  const days = new Set(feedings.map((f) => f.date)).size
  return {
    kg: Math.round(kg * 10) / 10,
    suggested: Math.round(suggested * 10) / 10,
    /** dado ÷ previsto, só nos dias com sugestão */
    percent: suggested ? Math.round((withSuggestion.reduce((s, f) => s + f.kg, 0) / suggested) * 1000) / 10 : null,
    cost,
    costPerHead: cost !== null && heads ? cost / heads : null,
    costPerHeadDay: cost !== null && heads && days ? cost / heads / days : null,
    /** custo sem preço em todos os tratos */
    partialCost: priced.length > 0 && priced.length < feedings.length,
    days,
  }
}
