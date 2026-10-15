import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ACTIVE_FARM_COOKIE, getSessionUser } from '@/lib/auth'
import { isFarmMember } from '@/lib/farms'

// POST { farmId }: abre outra propriedade.
// Admin do sistema escolhe qualquer uma (fica num cookie); o produtor escolhe entre as suas.
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { farmId } = await request.json()
  if (!farmId) return NextResponse.json({ error: 'farmId obrigatório' }, { status: 400 })

  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { id: true, name: true, isActive: true } })
  if (!farm) return NextResponse.json({ error: 'Propriedade não encontrada' }, { status: 404 })

  if (user.role !== 'admin') {
    if (!farm.isActive || !(await isFarmMember(user.id, farm.id))) {
      return NextResponse.json({ error: 'Você não tem acesso a esta propriedade' }, { status: 403 })
    }
    await prisma.user.update({ where: { id: user.id }, data: { farmId: farm.id } })
    return NextResponse.json({ ok: true, farmName: farm.name })
  }

  const response = NextResponse.json({ ok: true, farmName: farm.name })
  response.cookies.set(ACTIVE_FARM_COOKIE, farm.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return response
}

// DELETE: admin volta para a escolha de propriedade
export async function DELETE() {
  const user = await getSessionUser()
  if (user?.role !== 'admin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const response = NextResponse.json({ ok: true })
  response.cookies.delete(ACTIVE_FARM_COOKIE)
  return response
}
