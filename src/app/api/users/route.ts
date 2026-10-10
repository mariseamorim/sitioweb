import { prisma } from '@/lib/prisma'
import { getSessionUser, hashPassword } from '@/lib/auth'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const me = await getSessionUser()
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
  const me = await getSessionUser()
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
        name, email, password: await hashPassword(password),
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
