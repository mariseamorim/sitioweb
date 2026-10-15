import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, renewSession } from '@/lib/auth'
import { memberFarms } from '@/lib/farms'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const farm = user.effectiveFarmId
    ? await prisma.farm.findUnique({ where: { id: user.effectiveFarmId }, select: { name: true, segments: true } })
    : null
  // Produtor com mais de uma propriedade troca pelo topo da tela (admin usa o seletor próprio)
  const farms = user.role === 'admin' || !user.farmId ? [] : await memberFarms(user.id)

  return renewSession(NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    farmId: user.effectiveFarmId,
    farmName: farm?.name ?? null,
    farmSegments: farm?.segments ?? [],
    farms: farms.map((f) => ({ id: f.id, name: f.name })),
    permissions: user.permissions,
  }))
}
