import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const farm = user.effectiveFarmId
    ? await prisma.farm.findUnique({ where: { id: user.effectiveFarmId }, select: { name: true } })
    : null

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    farmId: user.effectiveFarmId,
    farmName: farm?.name ?? null,
    permissions: user.permissions,
  })
}
