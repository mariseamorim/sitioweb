import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

async function getMe() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value
  if (!userId) return null
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, farmId: true, role: true } })
  if (!user) return null

  // Admin uses the activeFarmId cookie as their effective farm
  let effectiveFarmId: string | null = user.farmId
  if (user.role === 'admin') {
    const activeFarmId = cookieStore.get('activeFarmId')?.value ?? null
    effectiveFarmId = activeFarmId
  }

  return { ...user, effectiveFarmId }
}

export async function GET() {
  const me = await getMe()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const users = await prisma.user.findMany({
    where: me.effectiveFarmId ? { farmId: me.effectiveFarmId } : { farmId: null },
    select: {
      id: true, name: true, email: true, role: true, permissions: true,
      farmId: true, farm: { select: { name: true } }, createdAt: true,
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const me = await getMe()
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem criar usuários' }, { status: 403 })
  }
  if (!me.effectiveFarmId) {
    return NextResponse.json({ error: 'Selecione uma propriedade antes de criar usuários' }, { status: 400 })
  }

  const { name, email, password, role, permissions } = await request.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 })
  }
  if (role === 'admin') {
    return NextResponse.json({ error: 'Não é possível criar usuários administradores por aqui' }, { status: 400 })
  }

  try {
    const user = await prisma.user.create({
      data: {
        name, email, password,
        role: role || 'viewer',
        permissions: permissions ?? null,
        farmId: me.effectiveFarmId,
      },
      select: { id: true, name: true, email: true, role: true, permissions: true, farmId: true },
    })
    return NextResponse.json(user, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
  }
}
