import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'

const MAX_POINTS = 200

// POST: novo local (sítio ou tanque comunitário)
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error

  const { name, kind } = await request.json()
  const trimmed = String(name ?? '').trim()
  if (!trimmed) return NextResponse.json({ error: 'Informe o nome do local' }, { status: 400 })
  if ((await prisma.milkPoint.count({ where: { ownerId: auth.user.id } })) >= MAX_POINTS) {
    return NextResponse.json({ error: `Limite de ${MAX_POINTS} locais` }, { status: 400 })
  }

  const point = await prisma.milkPoint.create({
    data: { ownerId: auth.user.id, name: trimmed, kind: kind === 'tanque' ? 'tanque' : 'sitio' },
    select: { id: true, name: true, kind: true, active: true },
  })
  return NextResponse.json(point, { status: 201 })
}
