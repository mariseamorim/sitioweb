import { prisma } from '@/lib/prisma'
import { todayUTC } from '@/lib/utils'

// Partes comuns das rotas de lotes (recria e engorda)

export const LOT_SELECT = {
  id: true, name: true, phase: true, startDate: true, endDate: true, supplyPercent: true, notes: true,
  supply: { select: { id: true, name: true, unit: true, currentQuantity: true, packageKg: true } },
  weighings: { select: { id: true, date: true, headCount: true, avgWeight: true }, orderBy: { date: 'asc' as const } },
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

export function serializeLot<T extends { startDate: Date; endDate: Date | null; weighings: { date: Date }[] }>(lot: T) {
  return {
    ...lot,
    startDate: isoDay(lot.startDate),
    endDate: lot.endDate ? isoDay(lot.endDate) : null,
    weighings: lot.weighings.map((w) => ({ ...w, date: isoDay(w.date) })),
  }
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

/** Suplemento do estoque desta propriedade; com sacos, guarda o peso do saco para o cálculo de dias */
export async function linkSupply(farmId: string, supplyId: unknown, packageKg: unknown): Promise<string | null | 'invalid'> {
  if (supplyId === null || supplyId === undefined || supplyId === '') return null
  const supply = await prisma.supply.findFirst({ where: { id: String(supplyId), farmId }, select: { id: true } })
  if (!supply) return 'invalid'
  if (packageKg !== undefined && packageKg !== null && packageKg !== '') {
    const kg = Number(String(packageKg).replace(',', '.'))
    if (!Number.isFinite(kg) || kg <= 0 || kg > 1000) return 'invalid'
    await prisma.supply.update({ where: { id: supply.id }, data: { packageKg: kg } })
  }
  return supply.id
}

export async function findLot(id: string, farmId: string) {
  return prisma.lot.findFirst({ where: { id, farmId }, select: { id: true } })
}
