import { prisma } from '@/lib/prisma'
import { inbreedingConflict, inbreedingMessage, type BullInfo } from '@/lib/inbreeding'

/** Mensagem de bloqueio quando o touro é pai ou avô da fêmea (regra em src/lib/inbreeding.ts); null = pode cobrir */
export async function inbreedingError(farmId: string, femaleId: string, bull: BullInfo) {
  if (!bull.maleName?.trim() && !bull.bullRegistry?.trim()) return null
  const [animals, births] = await Promise.all([
    prisma.animal.findMany({ where: { farmId }, select: { id: true, name: true, code: true, customCode: true, gender: true, motherId: true, fatherName: true } }),
    prisma.reproduction.findMany({ where: { farmId, calfId: { not: null } }, select: { calfId: true, maleName: true, bullRegistry: true } }),
  ])
  const conflict = inbreedingConflict(femaleId, bull, animals, births)
  return conflict ? inbreedingMessage(conflict) : null
}
