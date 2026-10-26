import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFarmAccess } from '@/lib/auth'
import { REARING_SELECT, serializeRearing } from './shared'

// GET: animais acompanhados um a um na recria (em andamento e encerrados)
export async function GET() {
  const auth = await requireFarmAccess('animais', 'view')
  if (auth.error) return auth.error
  const list = await prisma.animal.findMany({
    where: { farmId: auth.farmId, rearingStart: { not: null } },
    select: REARING_SELECT,
    orderBy: [{ rearingEnd: 'asc' }, { code: 'asc' }],
  })
  return NextResponse.json(list.map(serializeRearing), { headers: { 'Cache-Control': 'no-store' } })
}
