import { prisma } from '@/lib/prisma'
import { FEEDING_WINDOW_DAYS, dailySupplyKg, daysLeftHint, daysOfStock, feedingDailyKg, stockKg } from '@/lib/lots'

// Consumo diário de cada insumo pelos lotes abertos. Com % do peso vivo e pesagem: peso médio × cabeças × %.
// Sem isso: média dos tratos anotados nos últimos 14 dias. A chave existe para todo insumo de lote aberto;
// o valor é null quando ainda não dá para estimar.

export async function supplyDailyUse(farmId: string): Promise<Map<string, number | null>> {
  const since = new Date(Date.now() - FEEDING_WINDOW_DAYS * 86_400_000)
  const lots = await prisma.lot.findMany({
    where: { farmId, endDate: null, supplies: { some: {} } },
    select: {
      supplies: { select: { supplyId: true, percent: true } },
      weighings: { select: { headCount: true, avgWeight: true, date: true }, orderBy: { date: 'desc' }, take: 1 },
      feedings: { where: { date: { gte: since } }, select: { supplyId: true, date: true, kg: true } },
    },
  })
  const use = new Map<string, number | null>()
  for (const lot of lots) {
    const last = lot.weighings[0]
    for (const item of lot.supplies) {
      const byPercent = dailySupplyKg(last ? { ...last, date: '' } : null, item.percent)
      const kg = byPercent ?? feedingDailyKg(
        lot.feedings.filter((f) => f.supplyId === item.supplyId).map((f) => ({ date: f.date.toISOString().slice(0, 10), kg: f.kg })),
      )
      const sum = (use.get(item.supplyId) ?? 0) + (kg ?? 0)
      use.set(item.supplyId, sum ? Math.round(sum * 10) / 10 : null)
    }
  }
  return use
}

/** Insumo com consumo dos lotes: kg por dia, em quantos dias acaba e, quando não dá para saber, o que falta */
export function withDailyUse<T extends { id: string; unit: string; currentQuantity: number; packageKg: number | null }>(supply: T, use: Map<string, number | null>) {
  const dailyUseKg = use.get(supply.id) ?? null
  const daysLeft = daysOfStock(stockKg(supply), dailyUseKg)
  return { ...supply, dailyUseKg, daysLeft, daysLeftHint: daysLeft === null ? daysLeftHint(supply, use.has(supply.id), dailyUseKg) : null }
}
