import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canEdit, notFound, requireFarmAccess } from '@/lib/auth'

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

// GET: coletas que os motoristas anotaram nos sítios ligados a esta propriedade
export async function GET(request: NextRequest) {
  const auth = await requireFarmAccess('leite', 'view')
  if (auth.error) return auth.error

  const from = request.nextUrl.searchParams.get('from')
  const to = request.nextUrl.searchParams.get('to')
  const entries = await prisma.milkEntry.findMany({
    where: {
      point: { farmId: auth.farmId },
      ...(from || to ? { date: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } } : {}),
    },
    select: { date: true, liters: true, point: { select: { id: true, name: true, owner: { select: { name: true } } } } },
    orderBy: { date: 'desc' },
    take: 500,
  })
  const links = await prisma.milkPoint.findMany({
    where: { farmId: auth.farmId },
    select: { id: true, name: true, owner: { select: { name: true } } },
  })

  return NextResponse.json({
    links: links.map((l) => ({ pointId: l.id, pointName: l.name, driverName: l.owner.name })),
    collections: entries.map((e) => ({
      date: isoDay(e.date), liters: e.liters, pointId: e.point.id, pointName: e.point.name, driverName: e.point.owner.name,
    })),
  })
}

// DELETE ?pointId=...: o produtor desfaz o vínculo ("não é meu sítio")
export async function DELETE(request: NextRequest) {
  const auth = await requireFarmAccess('leite', 'edit')
  if (auth.error) return auth.error
  if (!canEdit(auth.user)) return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })

  const pointId = request.nextUrl.searchParams.get('pointId') ?? ''
  const point = await prisma.milkPoint.findFirst({ where: { id: pointId, farmId: auth.farmId }, select: { id: true } })
  if (!point) return notFound('Vínculo não encontrado')

  await prisma.milkPoint.update({ where: { id: point.id }, data: { farmId: null } })
  return NextResponse.json({ ok: true })
}
