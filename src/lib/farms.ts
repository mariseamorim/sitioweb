import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export { FARM_SEGMENTS, parseSegments, type FarmSegment } from '@/lib/farmSegments'

// Várias propriedades por conta: FarmMember lista as propriedades de cada usuário;
// User.farmId é a que está aberta. Trocar de propriedade é mudar o farmId.

type Db = Prisma.TransactionClient | typeof prisma

/** Dá acesso à propriedade (não duplica). */
export function addFarmMember(db: Db, userId: string, farmId: string) {
  return db.farmMember.upsert({ where: { userId_farmId: { userId, farmId } }, create: { userId, farmId }, update: {} })
}

/** Propriedades ativas a que o usuário tem acesso, em ordem alfabética. */
export async function memberFarms(userId: string) {
  const rows = await prisma.farmMember.findMany({
    where: { userId, farm: { isActive: true } },
    select: { farm: { select: { id: true, name: true, segments: true } } },
    orderBy: { farm: { name: 'asc' } },
  })
  return rows.map((r) => r.farm)
}

export async function isFarmMember(userId: string, farmId: string) {
  return !!(await prisma.farmMember.findUnique({ where: { userId_farmId: { userId, farmId } }, select: { id: true } }))
}
