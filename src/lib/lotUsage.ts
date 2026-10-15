import { prisma } from '@/lib/prisma'
import { dailySupplyKg, daysOfStock, stockKg } from '@/lib/lots'

// Consumo diário de cada insumo pelos lotes abertos (peso médio da última pesagem × cabeças × % do peso vivo)

export async function supplyDailyUse(farmId: string): Promise<Map<string, number>> {
  const lots = await prisma.lot.findMany({
    where: { farmId, endDate: null, supplyId: { not: null }, supplyPercent: { not: null } },
    select: { supplyId: true, supplyPercent: true, weighings: { select: { headCount: true, avgWeight: true, date: true }, orderBy: { date: 'desc' }, take: 1 } },
  })
  const use = new Map<string, number>()
  for (const lot of lots) {
    const last = lot.weighings[0]
    const kg = dailySupplyKg(last ? { ...last, date: '' } : null, lot.supplyPercent)
    if (kg) use.set(lot.supplyId!, Math.round(((use.get(lot.supplyId!) ?? 0) + kg) * 10) / 10)
  }
  return use
}

/** Insumo com consumo dos lotes: kg por dia e em quantos dias acaba (null se a unidade não permite calcular) */
export function withDailyUse<T extends { id: string; unit: string; currentQuantity: number; packageKg: number | null }>(supply: T, use: Map<string, number>) {
  const dailyUseKg = use.get(supply.id) ?? null
  return { ...supply, dailyUseKg, daysLeft: daysOfStock(stockKg(supply), dailyUseKg) }
}
