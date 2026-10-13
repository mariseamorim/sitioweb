import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrganization } from '@/lib/auth'
import { COLLECTION_ORGS, todayStops } from '@/lib/laticinio'
import { todayUTC } from '@/lib/utils'

const isDay = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

// GET ?from&to: tudo o que o painel do laticínio precisa (cadastros, coletas e recebimentos do período e o dia de hoje)
export async function GET(request: NextRequest) {
  const auth = await requireOrganization(COLLECTION_ORGS)
  if ('error' in auth) return auth.error
  const { organization } = auth

  const today = todayUTC()
  const params = request.nextUrl.searchParams
  const to = isDay(params.get('to')) ? new Date(params.get('to')!) : today
  const from = isDay(params.get('from')) ? new Date(params.get('from')!) : new Date(to.getTime() - 6 * 864e5)

  const [drivers, points, routes, entries, receptions, stops] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: organization.id, role: 'motorista' },
      select: { id: true, name: true, email: true, phone: true, vehicle: true },
      orderBy: { name: 'asc' },
    }),
    prisma.milkPoint.findMany({
      where: { organizationId: organization.id },
      select: { id: true, name: true, kind: true, active: true, contactName: true, phone: true, address: true, tankLiters: true, accessNotes: true },
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    }),
    prisma.route.findMany({
      where: { organizationId: organization.id },
      select: { id: true, name: true, days: true, driverId: true, active: true, stops: { select: { pointId: true, position: true }, orderBy: { position: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
    prisma.milkEntry.findMany({
      where: { point: { organizationId: organization.id }, date: { gte: from, lte: to } },
      select: { pointId: true, date: true, liters: true, skipReason: true, note: true, collectedAt: true, collectedBy: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.milkReception.findMany({
      where: { organizationId: organization.id, date: { gte: from, lte: to } },
      select: { id: true, date: true, routeId: true, liters: true, note: true },
      orderBy: { date: 'desc' },
    }),
    todayStops(organization.id, today),
  ])

  return NextResponse.json({
    organization: { id: organization.id, name: organization.name, status: organization.status },
    period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    today: today.toISOString().slice(0, 10),
    drivers,
    points,
    routes,
    entries: entries.map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) })),
    receptions: receptions.map((r) => ({ ...r, date: r.date.toISOString().slice(0, 10) })),
    todayStops: stops,
  })
}
