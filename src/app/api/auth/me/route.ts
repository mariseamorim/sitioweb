import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value

  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, name: true, email: true, role: true, farmId: true, permissions: true,
      farm: { select: { name: true } },
    },
  })

  if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

  // For regular users: use their own farmId and farm name
  let effectiveFarmId: string | null = user.farmId
  let farmName: string | null = user.farm?.name ?? null

  // For admin: use the activeFarmId cookie as the effective farm
  if (user.role === 'admin') {
    const activeFarmId = cookieStore.get('activeFarmId')?.value ?? null
    effectiveFarmId = activeFarmId
    if (activeFarmId) {
      const activeFarm = await prisma.farm.findUnique({
        where: { id: activeFarmId },
        select: { name: true },
      })
      farmName = activeFarm?.name ?? null
    } else {
      farmName = null
    }
  }

  return NextResponse.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    farmId: effectiveFarmId,
    farmName,
    permissions: user.permissions,
  })
}
