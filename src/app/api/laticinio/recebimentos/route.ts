import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrganization } from '@/lib/auth'
import { cleanNumber, cleanText } from '@/lib/laticinio'
import { todayUTC } from '@/lib/utils'

// POST: { date, routeId?, liters, note? } litros recebidos no laticínio (comparados com os coletados)
export async function POST(request: NextRequest) {
  const auth = await requireOrganization('laticinio')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? new Date(body.date) : null
  if (!date || date > todayUTC()) return NextResponse.json({ error: 'Informe uma data válida, que não seja futura' }, { status: 400 })
  const liters = cleanNumber(body.liters)
  if (liters === null) return NextResponse.json({ error: 'Informe os litros recebidos' }, { status: 400 })
  const routeId = typeof body.routeId === 'string' && body.routeId ? body.routeId : null
  if (routeId && !(await prisma.route.findFirst({ where: { id: routeId, organizationId: auth.organization.id }, select: { id: true } }))) {
    return NextResponse.json({ error: 'Rota não encontrada' }, { status: 400 })
  }

  const reception = await prisma.milkReception.create({
    data: { organizationId: auth.organization.id, date, routeId, liters, note: cleanText(body.note, 300) },
  })
  return NextResponse.json(reception, { status: 201 })
}
