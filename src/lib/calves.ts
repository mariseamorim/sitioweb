import { prisma } from '@/lib/prisma'
import { canAddCalf } from '@/lib/animalRules'

// Crias: cada vaca guarda as suas crias (Animal.motherId), e a cria é um animal do rebanho

/** A mãe precisa ser fêmea da mesma propriedade e não pode ser o próprio animal nem uma cria dele */
export async function findValidMother(motherId: string, farmId: string, childId?: string) {
  const mother = await prisma.animal.findFirst({
    where: { id: motherId, farmId, gender: 'Fêmea' },
    select: { id: true, motherId: true, species: true, gender: true, birthDate: true },
  })
  if (!mother || !canAddCalf(mother) || mother.id === childId || (childId && mother.motherId === childId)) return null
  return mother
}

/**
 * Cria anotada (nova, ou mãe informada depois): a vaca deixa de estar coberta/prenha.
 * Fecha como "Parida" todas as coberturas em aberto de antes do nascimento; a mais recente fica ligada à cria.
 */
export async function closeOpenPregnancy(motherId: string, calfId: string, birthDate: Date) {
  const open = await prisma.reproduction.findMany({
    where: { femaleId: motherId, actualBirthDate: null, status: { in: ['Coberta', 'Prenha'] }, coverageDate: { lte: birthDate } },
    orderBy: { coverageDate: 'desc' },
    select: { id: true },
  })
  if (!open.length) return
  await prisma.$transaction(open.map((r, i) => prisma.reproduction.update({
    where: { id: r.id },
    data: { actualBirthDate: birthDate, status: 'Parida', ...(i === 0 ? { calfId } : {}) },
  })))
}
