import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { ACTIVE_FARM_COOKIE, getSessionUser } from '@/lib/auth'

async function getAdmin() {
  const user = await getSessionUser()
  return user?.role === 'admin' ? user : null
}

// POST: select active farm
export async function POST(request: NextRequest) {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const { farmId } = await request.json()
  if (!farmId) return NextResponse.json({ error: 'farmId obrigatório' }, { status: 400 })

  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { id: true, name: true } })
  if (!farm) return NextResponse.json({ error: 'Propriedade não encontrada' }, { status: 404 })

  const response = NextResponse.json({ ok: true, farmName: farm.name })
  response.cookies.set(ACTIVE_FARM_COOKIE, farm.id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  })
  return response
}

// DELETE: clear active farm (go back to farm picker)
export async function DELETE() {
  const admin = await getAdmin()
  if (!admin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

  const response = NextResponse.json({ ok: true })
  response.cookies.delete(ACTIVE_FARM_COOKIE)
  return response
}
