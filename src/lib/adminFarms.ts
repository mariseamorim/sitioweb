import { prisma } from '@/lib/prisma'
import type { AdminFarmSummary } from '@/lib/ownerGroups'

// Resumo de todas as propriedades para o administrador: animais vivos, pessoas com acesso e último lançamento.
// Uma consulta por tabela, agrupada por propriedade, em vez de uma por propriedade.

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null)
const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : a >= b ? a : b)

export async function adminFarmSummaries(): Promise<AdminFarmSummary[]> {
  const [farms, animals, members, milk, transactions, reproductions, animalChanges, lots] = await Promise.all([
    prisma.farm.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true, name: true, propertyType: true, documentType: true, documentNumber: true, owner: true,
        phone: true, address: true, city: true, state: true, isActive: true, segments: true, createdAt: true,
      },
    }),
    prisma.animal.groupBy({ by: ['farmId'], where: { status: 'Vivo' }, _count: { _all: true } }),
    prisma.farmMember.groupBy({ by: ['farmId'], _count: { _all: true } }),
    prisma.milkProduction.groupBy({ by: ['farmId'], _max: { createdAt: true } }),
    prisma.transaction.groupBy({ by: ['farmId'], _max: { createdAt: true } }),
    prisma.reproduction.groupBy({ by: ['farmId'], _max: { createdAt: true } }),
    prisma.animal.groupBy({ by: ['farmId'], _max: { updatedAt: true } }),
    prisma.lot.groupBy({ by: ['farmId'], _max: { updatedAt: true } }),
  ])

  const count = (rows: { farmId: string; _count: { _all: number } }[]) => new Map(rows.map((r) => [r.farmId, r._count._all]))
  const animalCount = count(animals)
  const memberCount = count(members)

  const last = new Map<string, string | null>()
  const note = (farmId: string, d: Date | null) => last.set(farmId, later(last.get(farmId) ?? null, iso(d)))
  for (const r of milk) note(r.farmId, r._max.createdAt)
  for (const r of transactions) note(r.farmId, r._max.createdAt)
  for (const r of reproductions) note(r.farmId, r._max.createdAt)
  for (const r of animalChanges) note(r.farmId, r._max.updatedAt)
  for (const r of lots) note(r.farmId, r._max.updatedAt)

  return farms.map((f) => ({
    id: f.id,
    name: f.name,
    propertyType: f.propertyType,
    documentType: f.documentType,
    documentNumber: f.documentNumber,
    owner: f.owner,
    phone: f.phone,
    address: f.address,
    city: f.city,
    state: f.state,
    isActive: f.isActive,
    segments: f.segments,
    animals: animalCount.get(f.id) ?? 0,
    members: memberCount.get(f.id) ?? 0,
    lastActivity: last.get(f.id) ?? null,
    createdAt: f.createdAt.toISOString(),
  }))
}
