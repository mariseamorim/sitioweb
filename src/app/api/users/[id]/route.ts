import { prisma } from '@/lib/prisma'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

async function getMe() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value
  if (!userId) return null
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, farmId: true, role: true } })
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
  if (!target || target.farmId !== me.farmId) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  // Cannot demote yourself
  if (id === me.id && role && role !== 'admin') {
    return NextResponse.json({ error: 'Você não pode alterar seu próprio perfil' }, { status: 400 })
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(role && { role }),
      permissions: role === 'admin' ? null : (permissions ?? null),
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
  if (!target || target.farmId !== me.farmId) {
    return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
  }

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
