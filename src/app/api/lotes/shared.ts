import { prisma } from '@/lib/prisma'
import { todayUTC } from '@/lib/utils'

// Partes comuns das rotas de lotes (recria e engorda)

export const LOT_SELECT = {
  id: true, name: true, phase: true, startDate: true, endDate: true, targetWeight: true, notes: true,
  supplies: { select: { id: true, percent: true, supply: { select: { id: true, name: true, unit: true, currentQuantity: true, packageKg: true, unitPrice: true } } }, orderBy: { supply: { name: 'asc' as const } } },
  feedings: { select: { id: true, date: true, kg: true, suggestedKg: true, cost: true, supplyId: true }, orderBy: { date: 'asc' as const } },
  weighings: { select: { id: true, date: true, headCount: true, avgWeight: true }, orderBy: { date: 'asc' as const } },
  animals: {
    select: {
      id: true, code: true, customCode: true, name: true, gender: true, birthDate: true,
      weighings: { select: { date: true, weight: true }, orderBy: { date: 'asc' as const } },
      reproductions: {
        select: { id: true, heatDate: true, method: true, coverageDate: true, expectedBirthDate: true, semenBatch: true, bullRegistry: true, inseminator: true, maleName: true, status: true },
        orderBy: { coverageDate: 'desc' as const }, take: 1,
      },
    },
    orderBy: { code: 'asc' as const },
  },
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

type DayOrNull = Date | null
export function serializeLot<T extends { startDate: Date; endDate: Date | null; weighings: { date: Date }[]; feedings: { date: Date }[]; animals: { birthDate: Date; weighings: { date: Date; weight: number }[]; reproductions: { heatDate: DayOrNull; coverageDate: Date; expectedBirthDate: DayOrNull }[] }[] }>(lot: T) {
  return {
    ...lot,
    startDate: isoDay(lot.startDate),
    endDate: lot.endDate ? isoDay(lot.endDate) : null,
    weighings: lot.weighings.map((w) => ({ ...w, date: isoDay(w.date) })),
    feedings: lot.feedings.map((f) => ({ ...f, date: isoDay(f.date) })),
    animals: lot.animals.map((a) => ({
      ...a,
      birthDate: isoDay(a.birthDate),
      weighings: a.weighings.map((w) => ({ ...w, date: isoDay(w.date) })),
      reproductions: a.reproductions.map((r) => ({
        ...r, heatDate: r.heatDate ? isoDay(r.heatDate) : null, coverageDate: isoDay(r.coverageDate), expectedBirthDate: r.expectedBirthDate ? isoDay(r.expectedBirthDate) : null,
      })),
    })),
  }
}

/** Animais vivos desta propriedade; null se algum não for */
export async function farmAnimals(farmId: string, ids: unknown): Promise<string[] | null> {
  if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) return null
  const unique = [...new Set(ids as string[])]
  if (!unique.length) return []
  const found = await prisma.animal.count({ where: { id: { in: unique }, farmId, status: 'Vivo' } })
  return found === unique.length ? unique : null
}

/** Pesos por animal { animalId: kg } só dos animais informados; null se algum peso for inválido */
export function parseAnimalWeights(value: unknown, animalIds: string[]): Map<string, number> | null {
  const weights = new Map<string, number>()
  if (value === undefined || value === null) return weights
  if (typeof value !== 'object' || Array.isArray(value)) return null
  for (const [id, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw === '' || raw === null || raw === undefined) continue
    const kg = Number(String(raw).replace(',', '.'))
    if (!animalIds.includes(id) || !Number.isFinite(kg) || kg <= 0 || kg > 2000) return null
    weights.set(id, Math.round(kg * 10) / 10)
  }
  return weights
}

export const average = (values: number[]) => Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 10) / 10

/** Peso-alvo por cabeça: vazio = sem previsão */
export function parseTarget(value: unknown): number | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n > 0 && n <= 2000 ? Math.round(n * 10) / 10 : 'invalid'
}

/** Data yyyy-mm-dd até hoje; null se inválida */
export function parseDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) || date > todayUTC() ? null : date
}

/** Pesagem: cabeças e peso médio por cabeça */
export function parseWeighing(body: { headCount?: unknown; avgWeight?: unknown }): { headCount: number; avgWeight: number } | string {
  const headCount = Number(body.headCount)
  const avgWeight = Number(String(body.avgWeight ?? '').replace(',', '.'))
  if (!Number.isInteger(headCount) || headCount < 1 || headCount > 100000) return 'Informe quantas cabeças tem o lote'
  if (!Number.isFinite(avgWeight) || avgWeight <= 0 || avgWeight > 2000) return 'Informe o peso médio por cabeça, em kg'
  return { headCount, avgWeight: Math.round(avgWeight * 10) / 10 }
}

/** % do peso vivo: vazio = sem suplemento calculado */
export function parsePercent(value: unknown): number | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n > 0 && n <= 5 ? n : 'invalid'
}

/** Número positivo opcional (vírgula ou ponto); undefined se vazio, null se inválido */
export function optionalPositive(value: unknown, max: number): number | undefined | null {
  if (value === undefined || value === null || value === '') return undefined
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n > 0 && n <= max ? Math.round(n * 100) / 100 : null
}

export interface LotSupplyInput { supplyId: string; percent: number | null; packageKg?: number; unitPrice?: number }

/** Produtos do lote: [{ supplyId, percent, packageKg?, unitPrice? }] do estoque desta propriedade; string com o erro se inválido */
export async function parseLotSupplies(farmId: string, value: unknown): Promise<LotSupplyInput[] | string> {
  if (!Array.isArray(value)) return 'Produtos do lote inválidos'
  const items: LotSupplyInput[] = []
  for (const raw of value as Record<string, unknown>[]) {
    if (!raw || typeof raw !== 'object' || !raw.supplyId) continue
    const percent = parsePercent(raw.percent)
    if (percent === 'invalid') return 'O consumo deve ser uma % do peso vivo, por exemplo 0,1'
    const packageKg = optionalPositive(raw.packageKg, 1000)
    const unitPrice = optionalPositive(raw.unitPrice, 100000)
    if (packageKg === null) return 'Peso do saco inválido'
    if (unitPrice === null) return 'Preço inválido'
    if (items.some((i) => i.supplyId === String(raw.supplyId))) return 'O mesmo produto aparece duas vezes'
    items.push({ supplyId: String(raw.supplyId), percent, packageKg, unitPrice })
  }
  const found = await prisma.supply.count({ where: { id: { in: items.map((i) => i.supplyId) }, farmId } })
  return found === items.length ? items : 'Produto do estoque não encontrado'
}

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** Troca a lista de produtos do lote e guarda o peso do saco e o preço que vieram junto */
export async function setLotSupplies(tx: Tx, lotId: string, items: LotSupplyInput[]) {
  await tx.lotSupply.deleteMany({ where: { lotId, supplyId: { notIn: items.map((i) => i.supplyId) } } })
  for (const item of items) {
    await tx.lotSupply.upsert({
      where: { lotId_supplyId: { lotId, supplyId: item.supplyId } },
      create: { lotId, supplyId: item.supplyId, percent: item.percent },
      update: { percent: item.percent },
    })
    if (item.packageKg !== undefined || item.unitPrice !== undefined) {
      await tx.supply.update({ where: { id: item.supplyId }, data: { ...(item.packageKg !== undefined && { packageKg: item.packageKg }), ...(item.unitPrice !== undefined && { unitPrice: item.unitPrice }) } })
    }
  }
}

export async function findLot(id: string, farmId: string) {
  return prisma.lot.findFirst({ where: { id, farmId }, select: { id: true } })
}
