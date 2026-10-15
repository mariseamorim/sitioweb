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
