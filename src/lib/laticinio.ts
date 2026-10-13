import { prisma } from '@/lib/prisma'

// Regras do laticínio: rotas do dia, pendências e acesso do motorista aos pontos da rota

/** Dia da semana de hoje no horário de Brasília (0 = domingo) */
export function todayWeekday(now = new Date()): number {
  const day = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Sao_Paulo', weekday: 'short' }).format(now)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(day)
}

/** Pontos de coleta que o motorista pode anotar: os das rotas ativas atribuídas a ele */
export async function driverRoutePointIds(driverId: string): Promise<Set<string>> {
  const stops = await prisma.routeStop.findMany({
    where: { route: { driverId, active: true }, point: { active: true } },
    select: { pointId: true },
  })
  return new Set(stops.map((s) => s.pointId))
}

export interface PendingStop {
  routeId: string
  routeName: string
  driverName: string | null
  pointId: string
  pointName: string
  position: number
  status: 'pendente' | 'coletado' | 'nao-coletado'
  liters: number | null
  skipReason: string | null
}

/** Situação de hoje: cada parada das rotas do dia, coletada, não coletada (com motivo) ou pendente */
export async function todayStops(organizationId: string, today: Date): Promise<PendingStop[]> {
  const weekday = todayWeekday()
  const routes = await prisma.route.findMany({
    where: { organizationId, active: true, days: { has: weekday } },
    include: {
      driver: { select: { name: true } },
      stops: { orderBy: { position: 'asc' }, include: { point: { select: { id: true, name: true, active: true } } } },
    },
    orderBy: { name: 'asc' },
  })
  const pointIds = routes.flatMap((r) => r.stops.map((s) => s.pointId))
  const entries = pointIds.length
    ? await prisma.milkEntry.findMany({ where: { pointId: { in: pointIds }, date: today }, select: { pointId: true, liters: true, skipReason: true } })
    : []
  const byPoint = new Map(entries.map((e) => [e.pointId, e]))
  return routes.flatMap((r) => r.stops.filter((s) => s.point.active).map((s) => {
    const entry = byPoint.get(s.pointId)
    return {
      routeId: r.id,
      routeName: r.name,
      driverName: r.driver?.name ?? null,
      pointId: s.pointId,
      pointName: s.point.name,
      position: s.position,
      status: !entry ? 'pendente' : entry.skipReason ? 'nao-coletado' : 'coletado',
      liters: entry && !entry.skipReason ? entry.liters : null,
      skipReason: entry?.skipReason ?? null,
    }
  }))
}

/**
 * Dados da rota enviados pelo painel: nome, dias (0-6), motorista e paradas em ordem.
 * Motorista e pontos precisam ser do próprio laticínio.
 */
export async function routeInput(organizationId: string, body: Record<string, unknown>) {
  const name = cleanText(body.name, 80)
  if (!name) return { error: 'Informe o nome da rota' } as const
  const days = [...new Set((Array.isArray(body.days) ? body.days : []).map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort()
  const driverId = typeof body.driverId === 'string' && body.driverId ? body.driverId : null
  if (driverId && !(await prisma.user.findFirst({ where: { id: driverId, organizationId, role: 'motorista' }, select: { id: true } }))) {
    return { error: 'Motorista não encontrado' } as const
  }
  const pointIds = [...new Set((Array.isArray(body.pointIds) ? body.pointIds : []).filter((p): p is string => typeof p === 'string'))]
  if (pointIds.length && (await prisma.milkPoint.count({ where: { id: { in: pointIds }, organizationId } })) !== pointIds.length) {
    return { error: 'Ponto de coleta não encontrado' } as const
  }
  return { data: { name, days, driverId, active: body.active !== false }, pointIds } as const
}

/** Campos do ponto de coleta enviados pelo painel */
export function pointData(body: Record<string, unknown>) {
  return {
    kind: body.kind === 'tanque' ? 'tanque' : 'sitio',
    contactName: cleanText(body.contactName, 80),
    phone: cleanText(body.phone, 30),
    address: cleanText(body.address, 300),
    tankLiters: cleanNumber(body.tankLiters),
    accessNotes: cleanText(body.accessNotes, 500),
  }
}

export const cleanText = (value: unknown, max = 200) => {
  const text = typeof value === 'string' ? value.trim().slice(0, max) : ''
  return text || null
}

export const cleanNumber = (value: unknown) => {
  if (value === null || value === undefined || value === '') return null
  // "1.250,5" (milhar com ponto) ou "12.5" / "12,5"
  const text = String(value).trim()
  const n = Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text)
  return Number.isFinite(n) && n >= 0 ? n : null
}
