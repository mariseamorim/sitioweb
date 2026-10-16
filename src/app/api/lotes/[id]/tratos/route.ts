import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFarmAccess } from '@/lib/auth'
import { dailySupplyKg, kgInStockUnit, pricePerKg } from '@/lib/lots'
import { LOT_SELECT, parseDay, serializeLot } from '../../shared'

// POST { date, kg }: trato do dia com o suplemento do lote. Dá baixa no estoque e guarda o custo, se houver preço.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const { id } = await params
  const lot = await prisma.lot.findFirst({
    where: { id, farmId: auth.farmId },
    select: { name: true, supplyPercent: true, supply: true, weighings: { select: { headCount: true, avgWeight: true }, orderBy: { date: 'desc' }, take: 1 } },
  })
  if (!lot) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })
  if (!lot.supply) return NextResponse.json({ error: 'Ligue um suplemento do estoque ao lote antes de lançar o trato' }, { status: 400 })

  const body = await request.json()
  const date = parseDay(body.date)
  if (!date) return NextResponse.json({ error: 'Informe a data do trato' }, { status: 400 })
  const kg = Number(String(body.kg ?? '').replace(',', '.'))
  if (!Number.isFinite(kg) || kg <= 0 || kg > 100000) return NextResponse.json({ error: 'Informe quantos kg foram dados' }, { status: 400 })
  const quantity = kgInStockUnit(lot.supply, kg)
  if (quantity === null) {
    return NextResponse.json({
      error: lot.supply.unit === 'sacos' ? 'Informe o peso do saco no suplemento do lote para dar baixa no estoque' : 'O estoque deste produto precisa estar em kg ou sacos',
    }, { status: 400 })
  }
  const last = lot.weighings[0]
  const suggestedKg = dailySupplyKg(last ? { ...last, date: '' } : null, lot.supplyPercent)
  const perKg = pricePerKg(lot.supply)
  const supplyId = lot.supply.id

  await prisma.$transaction(async (tx) => {
    const movement = await tx.supplyMovement.create({ data: { supplyId, type: 'Saída', quantity, date, description: `Trato do lote ${lot.name}` } })
    await tx.supply.update({ where: { id: supplyId }, data: { currentQuantity: { decrement: quantity } } })
    await tx.lotFeeding.create({
      data: {
        lotId: id, supplyId, date, kg: Math.round(kg * 10) / 10, suggestedKg,
        cost: perKg !== null ? Math.round(kg * perKg * 100) / 100 : null, movementId: movement.id,
      },
    })
  })
  const updated = await prisma.lot.findUniqueOrThrow({ where: { id }, select: LOT_SELECT })
  return NextResponse.json(serializeLot(updated), { status: 201 })
}

// DELETE { feedingId }: apaga o trato e devolve a quantidade ao estoque
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const { id } = await params
  const { feedingId } = await request.json()
  const feeding = await prisma.lotFeeding.findFirst({
    where: { id: String(feedingId ?? ''), lot: { id, farmId: auth.farmId } },
    select: { id: true, movement: { select: { id: true, supplyId: true, quantity: true } } },
  })
  if (!feeding) return NextResponse.json({ error: 'Trato não encontrado' }, { status: 404 })

  await prisma.$transaction(async (tx) => {
    await tx.lotFeeding.delete({ where: { id: feeding.id } })
    if (feeding.movement) {
      await tx.supply.update({ where: { id: feeding.movement.supplyId }, data: { currentQuantity: { increment: feeding.movement.quantity } } })
      await tx.supplyMovement.delete({ where: { id: feeding.movement.id } })
    }
  })
  const updated = await prisma.lot.findUniqueOrThrow({ where: { id }, select: LOT_SELECT })
  return NextResponse.json(serializeLot(updated))
}
