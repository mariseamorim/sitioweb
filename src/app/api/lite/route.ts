import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { LITE_HISTORY_DAYS, LiteChange, LiteData, parseLiters } from '@/lib/lite'
import { todayUTC } from '@/lib/utils'

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

// GET: locais e anotações recentes, numa chamada só, para o app guardar no aparelho
export async function GET() {
  const auth = await requireUser()
  if ('error' in auth) return auth.error

  const since = todayUTC()
  since.setUTCDate(since.getUTCDate() - LITE_HISTORY_DAYS)

  const points = await prisma.milkPoint.findMany({
    where: { ownerId: auth.user.id },
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, kind: true, active: true },
  })
  const entries = await prisma.milkEntry.findMany({
    where: { point: { ownerId: auth.user.id }, date: { gte: since } },
    select: { pointId: true, date: true, liters: true },
    orderBy: { date: 'desc' },
  })

  const data: LiteData = {
    userName: auth.user.name,
    role: auth.user.role,
    points: points.map((p) => ({ ...p, kind: p.kind === 'tanque' ? 'tanque' : 'sitio' })),
    entries: entries.map((e) => ({ pointId: e.pointId, date: isoDay(e.date), liters: e.liters })),
  }
  return NextResponse.json(data)
}

// PUT: grava as anotações (um valor por local por dia). Reenviar o mesmo dado não duplica.
export async function PUT(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error

  const { changes } = (await request.json()) as { changes?: LiteChange[] }
  if (!Array.isArray(changes) || changes.length === 0) {
    return NextResponse.json({ error: 'Nada para salvar' }, { status: 400 })
  }

  const today = isoDay(todayUTC())
  const valid = changes.filter((c) => c?.pointId && /^\d{4}-\d{2}-\d{2}$/.test(c.date) && c.date <= today)
  if (valid.length !== changes.length) {
    return NextResponse.json({ error: 'Há anotações com data inválida' }, { status: 400 })
  }

  const ids = [...new Set(valid.map((c) => c.pointId))]
  const owned = await prisma.milkPoint.count({ where: { id: { in: ids }, ownerId: auth.user.id } })
  if (owned !== ids.length) return NextResponse.json({ error: 'Local não encontrado' }, { status: 404 })

  await prisma.$transaction(
    valid.map((c) => {
      const where = { pointId_date: { pointId: c.pointId, date: new Date(c.date) } }
      const liters = parseLiters(c.liters)
      return liters === null
        ? prisma.milkEntry.deleteMany({ where: { pointId: c.pointId, date: new Date(c.date) } })
        : prisma.milkEntry.upsert({ where, create: { pointId: c.pointId, date: new Date(c.date), liters }, update: { liters } })
    }),
  )
  return NextResponse.json({ saved: valid.length })
}
