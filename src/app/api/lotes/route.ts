import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFarmAccess } from '@/lib/auth'
import { isLotPhase } from '@/lib/lots'
import { LOT_SELECT, average, farmAnimals, linkSupply, parseAnimalWeights, parseDay, parsePercent, parseTarget, parseWeighing, serializeLot } from './shared'

// Lotes de recria e engorda da propriedade (permissão do módulo Animais)
export async function GET() {
  const auth = await requireFarmAccess('animais', 'view')
  if (auth.error) return auth.error
  const lots = await prisma.lot.findMany({ where: { farmId: auth.farmId }, select: LOT_SELECT, orderBy: [{ endDate: { sort: 'desc', nulls: 'first' } }, { startDate: 'desc' }] })
  return NextResponse.json(lots.map(serializeLot))
}

// POST: novo lote, com a pesagem de entrada.
// Com animais cadastrados (animalIds), a entrada vem do peso de cada um (weights) ou, sem pesos, do peso médio informado.
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
  const animalIds = body.animalIds === undefined ? [] : await farmAnimals(farmId, body.animalIds)
  if (!animalIds) return NextResponse.json({ error: 'Escolha animais vivos desta propriedade' }, { status: 400 })
  const weights = parseAnimalWeights(body.weights, animalIds)
  if (!weights) return NextResponse.json({ error: 'Confira os pesos: use kg, por exemplo 300' }, { status: 400 })
  const weighing = weights.size
    ? { headCount: animalIds.length, avgWeight: average([...weights.values()]) }
    : parseWeighing(animalIds.length ? { ...body, headCount: animalIds.length } : body)
  if (typeof weighing === 'string') return NextResponse.json({ error: weighing }, { status: 400 })
  const targetWeight = parseTarget(body.targetWeight)
  if (targetWeight === 'invalid') return NextResponse.json({ error: 'Peso-alvo inválido' }, { status: 400 })
  const supplyPercent = parsePercent(body.supplyPercent)
  if (supplyPercent === 'invalid') return NextResponse.json({ error: 'O consumo deve ser uma % do peso vivo, por exemplo 0,1' }, { status: 400 })
  const supplyId = await linkSupply(farmId, body.supplyId, body.packageKg)
  if (supplyId === 'invalid') return NextResponse.json({ error: 'Suplemento ou peso do saco inválido' }, { status: 400 })

  const created = await prisma.$transaction(async (tx) => {
    const lot = await tx.lot.create({
      data: {
        farmId, name, phase, startDate, supplyId, supplyPercent, targetWeight,
        notes: typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim().slice(0, 500) : null,
        weighings: { create: { date: startDate, ...weighing } },
      },
      select: { id: true, weighings: { select: { id: true } } },
    })
    // Os animais saem do lote em que estavam e entram neste, com o peso de entrada de cada um
    if (animalIds.length) {
      await tx.animal.updateMany({ where: { id: { in: animalIds } }, data: { lotId: lot.id } })
      if (weights.size) {
        await tx.animalWeighing.createMany({
          data: [...weights].map(([animalId, weight]) => ({ animalId, weight, date: startDate, lotWeighingId: lot.weighings[0].id })),
        })
      }
    }
    return tx.lot.findUniqueOrThrow({ where: { id: lot.id }, select: LOT_SELECT })
  })
  return NextResponse.json(serializeLot(created), { status: 201 })
}
