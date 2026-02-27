import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

async function getMe() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value
  if (!userId) return null
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, farmId: true, role: true } })
  if (!user) return null

  let effectiveFarmId: string | null = user.farmId
  if (user.role === 'admin') {
    const activeFarmId = cookieStore.get('activeFarmId')?.value ?? null
    effectiveFarmId = activeFarmId
  }

  return { ...user, effectiveFarmId }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getMe()
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem editar usuários' }, { status: 403 })
  }

  const { id } = await params
  const body = await request.json()
  const { name, role, permissions } = body

  // Cannot edit a user from another farm
  const target = await prisma.user.findUnique({ where: { id }, select: { farmId: true } })
  if (!target || target.farmId !== me.effectiveFarmId) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  // Cannot promote to admin
  if (role === 'admin') {
    return NextResponse.json({ error: 'Não é possível promover usuários a administrador por aqui' }, { status: 400 })
  }

  // Cannot change your own role
  if (id === me.id && role) {
    return NextResponse.json({ error: 'Você não pode alterar seu próprio perfil' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(role && { role }),
      permissions: permissions ?? null,
    },
    select: { id: true, name: true, email: true, role: true, permissions: true, farmId: true },
  })
  return NextResponse.json(user)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const me = await getMe()
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ error: 'Apenas administradores podem excluir usuários' }, { status: 403 })
  }

  const { id } = await params

  if (id === me.id) {
    return NextResponse.json({ error: 'Você não pode excluir sua própria conta' }, { status: 400 })
  }

  const target = await prisma.user.findUnique({ where: { id }, select: { farmId: true } })
  if (!target || target.farmId !== me.effectiveFarmId) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
