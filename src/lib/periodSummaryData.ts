import { prisma } from '@/lib/prisma'
import { summarizePeriod, yearBounds, type PeriodSummary } from '@/lib/periodSummary'

// Busca do banco o que o resumo por período do Painel precisa (o ano inteiro, de uma vez) e
// respeita os módulos que a pessoa pode ver.

export interface PeriodSummaryData {
  summary: PeriodSummary
  show: { milk: boolean; money: boolean; births: boolean }
}

export async function loadPeriodSummary(farmId: string, can: (module: string) => boolean, segments: string[], now = new Date()): Promise<PeriodSummaryData> {
  const { start, end } = yearBounds(now)
  const inYear = { gte: start, lte: end }
  const show = { milk: can('leite') && (!segments.length || segments.includes('leite')), money: can('financeiro'), births: can('reproducao') }
  const [transactions, milk, births, farm] = await Promise.all([
    show.money ? prisma.transaction.findMany({ where: { farmId, date: inYear }, select: { type: true, amount: true, date: true } }) : [],
    show.milk ? prisma.milkProduction.findMany({ where: { farmId, date: inYear }, select: { quantity: true, date: true } }) : [],
    show.births ? prisma.reproduction.findMany({ where: { farmId, actualBirthDate: inYear }, select: { actualBirthDate: true } }) : [],
    show.milk ? prisma.farm.findUnique({ where: { id: farmId }, select: { milkPrice: true } }) : null,
  ])
  return {
    summary: summarizePeriod({ transactions, milk, births: births.map((b) => ({ date: b.actualBirthDate! })), milkPrice: farm?.milkPrice ?? null }, now),
    show,
  }
}
