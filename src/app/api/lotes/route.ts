import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFarmAccess } from '@/lib/auth'
import { isLotPhase } from '@/lib/lots'
import { LOT_SELECT, linkSupply, parseDay, parsePercent, parseWeighing, serializeLot } from './shared'

// Lotes de recria e engorda da propriedade (permissão do módulo Animais)
export async function GET() {
  const auth = await requireFarmAccess('animais', 'view')
  if (auth.error) return auth.error
  const lots = await prisma.lot.findMany({ where: { farmId: auth.farmId }, select: LOT_SELECT, orderBy: [{ endDate: { sort: 'desc', nulls: 'first' } }, { startDate: 'desc' }] })
  return NextResponse.json(lots.map(serializeLot))
}

// POST: novo lote, com a pesagem de entrada
export async function POST(request: NextRequest) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const farmId = auth.farmId

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
  if (!name) return NextResponse.json({ error: 'Dê um nome ao lote' }, { status: 400 })
  const phase = body.phase ?? 'engorda'
  if (!isLotPhase(phase)) return NextResponse.json({ error: 'Fase inválida' }, { status: 400 })
  const startDate = parseDay(body.startDate)
  if (!startDate) return NextResponse.json({ error: 'Informe a data de entrada' }, { status: 400 })
  const weighing = parseWeighing(body)
  if (typeof weighing === 'string') return NextResponse.json({ error: weighing }, { status: 400 })
  const supplyPercent = parsePercent(body.supplyPercent)
  if (supplyPercent === 'invalid') return NextResponse.json({ error: 'O consumo deve ser uma % do peso vivo, por exemplo 0,1' }, { status: 400 })
  const supplyId = await linkSupply(farmId, body.supplyId, body.packageKg)
  if (supplyId === 'invalid') return NextResponse.json({ error: 'Suplemento ou peso do saco inválido' }, { status: 400 })

  const lot = await prisma.lot.create({
    data: {
      farmId, name, phase, startDate, supplyId, supplyPercent,
      notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 500) : null,
      weighings: { create: { date: startDate, ...weighing } },
    },
    select: LOT_SELECT,
  })
  return NextResponse.json(serializeLot(lot), { status: 201 })
}
