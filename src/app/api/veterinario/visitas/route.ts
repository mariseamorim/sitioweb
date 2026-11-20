import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { animalToday } from '@/lib/animalRules'
import { requireVet } from '@/lib/vets'
import { day, hour, text } from '@/lib/vetInput'

// GET: agenda do veterinário — as visitas marcadas (da mais próxima para a mais distante) e as 20 últimas já passadas
export async function GET() {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const today = new Date(`${animalToday()}T00:00:00.000Z`)
  const [upcoming, past] = await Promise.all([
    prisma.vetVisit.findMany({ where: { vetId: auth.vet.id, status: 'agendada' }, orderBy: [{ date: 'asc' }, { time: 'asc' }] }),
    prisma.vetVisit.findMany({ where: { vetId: auth.vet.id, status: { not: 'agendada' }, date: { lte: today } }, orderBy: { date: 'desc' }, take: 20 }),
  ])
  return NextResponse.json({ upcoming, past })
}

// POST: marca uma visita. Body: { clientId, date: "AAAA-MM-DD", time?: "HH:MM", purpose? }
export async function POST(request: NextRequest) {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const body = await request.json()
  const date = day(body.date)
  if (!date) return NextResponse.json({ error: 'Informe o dia da visita' }, { status: 400 })
  const client = await prisma.vetClient.findFirst({ where: { id: String(body.clientId ?? ''), vetId: auth.vet.id, status: 'ativo' }, include: { farm: { select: { name: true } } } })
  if (!client) return NextResponse.json({ error: 'Escolha a propriedade' }, { status: 400 })
  const visit = await prisma.vetVisit.create({
    data: { vetId: auth.vet.id, clientId: client.id, farmName: client.farm?.name ?? client.farmName, date, time: hour(body.time), purpose: text(body.purpose, 200) },
  })
  return NextResponse.json(visit, { status: 201 })
}
