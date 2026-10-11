import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireUser } from '@/lib/auth'

// PATCH: renomear, trocar o tipo ou arquivar/reativar (active). Arquivar mantém o histórico.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error

  const { id } = await params
  if (!(await prisma.milkPoint.findFirst({ where: { id, ownerId: auth.user.id }, select: { id: true } }))) {
    return notFound('Local não encontrado')
  }

  const body = await request.json()
  const data: { name?: string; kind?: string; active?: boolean } = {}
  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return NextResponse.json({ error: 'Informe o nome do local' }, { status: 400 })
    data.name = name
  }
  if (body.kind !== undefined) data.kind = body.kind === 'tanque' ? 'tanque' : 'sitio'
  if (typeof body.active === 'boolean') data.active = body.active

  const point = await prisma.milkPoint.update({ where: { id }, data, select: { id: true, name: true, kind: true, active: true } })
  return NextResponse.json(point)
}
