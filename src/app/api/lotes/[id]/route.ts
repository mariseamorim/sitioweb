import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFarmAccess } from '@/lib/auth'
import { isLotPhase } from '@/lib/lots'
import { LOT_SELECT, farmAnimals, findLot, linkSupply, parseDay, parsePercent, parseTarget, serializeLot } from '../shared'

// PATCH: altera o lote, encerra (endDate) ou reabre (endDate null), põe (addAnimalIds) ou tira (removeAnimalIds) animais
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const { id } = await params
  if (!(await findLot(id, auth.farmId))) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })

  const body = await request.json()
  const data: Record<string, unknown> = {}
  if ('name' in body) {
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 80) : ''
    if (!name) return NextResponse.json({ error: 'Dê um nome ao lote' }, { status: 400 })
    data.name = name
  }
  if ('phase' in body) {
    if (!isLotPhase(body.phase)) return NextResponse.json({ error: 'Fase inválida' }, { status: 400 })
    data.phase = body.phase
  }
  if ('supplyPercent' in body) {
    const percent = parsePercent(body.supplyPercent)
    if (percent === 'invalid') return NextResponse.json({ error: 'O consumo deve ser uma % do peso vivo, por exemplo 0,1' }, { status: 400 })
    data.supplyPercent = percent
  }
  if ('supplyId' in body) {
    const supplyId = await linkSupply(auth.farmId, body.supplyId, body.packageKg, body.unitPrice)
    if (supplyId === 'invalid') return NextResponse.json({ error: 'Suplemento ou peso do saco inválido' }, { status: 400 })
    data.supplyId = supplyId
  }
  if ('targetWeight' in body) {
    const target = parseTarget(body.targetWeight)
    if (target === 'invalid') return NextResponse.json({ error: 'Peso-alvo inválido' }, { status: 400 })
    data.targetWeight = target
  }
  const add = body.addAnimalIds === undefined ? [] : await farmAnimals(auth.farmId, body.addAnimalIds)
  if (!add) return NextResponse.json({ error: 'Escolha animais vivos desta propriedade' }, { status: 400 })
  const remove = Array.isArray(body.removeAnimalIds) ? body.removeAnimalIds.filter((x: unknown) => typeof x === 'string') as string[] : []
  if ('notes' in body) data.notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 500) : null
  if ('endDate' in body) {
    if (body.endDate === null) data.endDate = null
    else {
      const endDate = parseDay(body.endDate)
      if (!endDate) return NextResponse.json({ error: 'Informe a data de saída' }, { status: 400 })
      data.endDate = endDate
    }
  }

  const lot = await prisma.$transaction(async (tx) => {
    if (add.length) await tx.animal.updateMany({ where: { id: { in: add } }, data: { lotId: id } })
    if (remove.length) await tx.animal.updateMany({ where: { id: { in: remove }, lotId: id }, data: { lotId: null } })
    return tx.lot.update({ where: { id }, data, select: LOT_SELECT })
  })
  return NextResponse.json(serializeLot(lot))
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const { id } = await params
  if (!(await findLot(id, auth.farmId))) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
  await prisma.lot.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
