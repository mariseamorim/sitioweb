import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { usesFarmMode } from '@/lib/lite'

const MAX_POINTS = 200
// O aparelho gera o id para poder cadastrar locais sem internet
const CLIENT_ID = /^[A-Za-z0-9_-]{10,40}$/
const SELECT = { id: true, name: true, kind: true, active: true, farm: { select: { id: true, name: true, city: true, state: true } } } as const

// POST: novo local (sítio ou tanque comunitário). Reenviar o mesmo id não duplica.
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  if (usesFarmMode(auth.user)) {
    return NextResponse.json({ error: 'Na versão completa o leite é anotado direto na propriedade' }, { status: 400 })
  }

  const { id, name, kind, active } = await request.json()
  const trimmed = String(name ?? '').trim()
  if (!trimmed) return NextResponse.json({ error: 'Informe o nome do local' }, { status: 400 })
  if (id !== undefined && !CLIENT_ID.test(String(id))) {
    return NextResponse.json({ error: 'Identificador inválido' }, { status: 400 })
  }

  if (id) {
    const existing = await prisma.milkPoint.findUnique({ where: { id }, select: { ownerId: true } })
    if (existing && existing.ownerId !== auth.user.id) {
      return NextResponse.json({ error: 'Identificador em uso' }, { status: 409 })
    }
    if (existing) {
      return NextResponse.json(await prisma.milkPoint.findUnique({ where: { id }, select: SELECT }))
    }
  }
  if ((await prisma.milkPoint.count({ where: { ownerId: auth.user.id } })) >= MAX_POINTS) {
    return NextResponse.json({ error: `Limite de ${MAX_POINTS} locais` }, { status: 400 })
  }

  const point = await prisma.milkPoint.create({
    data: {
      ...(id ? { id } : {}),
      ownerId: auth.user.id,
      name: trimmed,
      kind: kind === 'tanque' ? 'tanque' : 'sitio',
      active: active !== false,
    },
    select: SELECT,
  })
  return NextResponse.json(point, { status: 201 })
}
