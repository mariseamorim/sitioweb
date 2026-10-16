import { prisma } from '@/lib/prisma'

// Carência de medicamento: depois do tratamento, o leite não pode ir para o tanque e o animal não pode ir para o abate

/** Último dia da carência: fim do tratamento (ou o início, sem fim) mais os dias de carência */
export function withdrawalUntil(t: { startDate: Date; endDate: Date | null }, days: number | null): Date | null {
  if (!days || days <= 0) return null
  const until = new Date(t.endDate ?? t.startDate)
  until.setUTCDate(until.getUTCDate() + days)
  return until
}

export interface ActiveWithdrawal {
  animalName: string
  medicine: string
  /** yyyy-mm-dd: leite fora do tanque até este dia */
  milkUntil: string | null
  /** yyyy-mm-dd: fora do abate até este dia */
  meatUntil: string | null
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/** Animais em carência hoje na propriedade (leite ou carne) */
export async function activeWithdrawals(farmId: string, today: Date): Promise<ActiveWithdrawal[]> {
  // A carência mais longa possível é de um ano: olha os tratamentos desse período
  const since = new Date(today)
  since.setUTCDate(since.getUTCDate() - 400)
  const treatments = await prisma.veterinaryTreatment.findMany({
    where: { animal: { farmId, status: { notIn: ['Morto', 'Vendido'] } }, startDate: { gte: since }, OR: [{ milkWithdrawalDays: { gt: 0 } }, { meatWithdrawalDays: { gt: 0 } }] },
    select: { startDate: true, endDate: true, medicine: true, milkWithdrawalDays: true, meatWithdrawalDays: true, animal: { select: { name: true } } },
  })
  return treatments.flatMap((t) => {
    const milk = withdrawalUntil(t, t.milkWithdrawalDays)
    const meat = withdrawalUntil(t, t.meatWithdrawalDays)
    const milkUntil = milk && milk >= today ? isoDay(milk) : null
    const meatUntil = meat && meat >= today ? isoDay(meat) : null
    return milkUntil || meatUntil ? [{ animalName: t.animal.name, medicine: t.medicine, milkUntil, meatUntil }] : []
  })
}

/** Dias de carência informados: inteiro de 0 a 365; vazio = sem carência */
export function parseWithdrawalDays(value: unknown): number | null | 'invalid' {
  if (value === undefined || value === null || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) && n >= 0 && n <= 365 ? n : 'invalid'
}
