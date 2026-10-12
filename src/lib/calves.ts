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

/** Ao registrar o parto, fecha a cobertura em aberto da mãe (a mais recente antes do nascimento) */
export async function closeOpenPregnancy(motherId: string, calfId: string, birthDate: Date) {
  const open = await prisma.reproduction.findFirst({
    where: { femaleId: motherId, actualBirthDate: null, status: { in: ['Coberta', 'Prenha'] }, coverageDate: { lte: birthDate } },
    orderBy: { coverageDate: 'desc' },
    select: { id: true },
  })
  if (!open) return
  await prisma.reproduction.update({ where: { id: open.id }, data: { actualBirthDate: birthDate, calfId, status: 'Parida' } })
}
