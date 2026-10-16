import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFarmAccess } from '@/lib/auth'
import { LOT_SELECT, average, findLot, parseAnimalWeights, parseDay, parseWeighing, serializeLot } from '../../shared'

// POST { date, headCount, avgWeight }: nova pesagem pelo peso médio.
// POST { date, weights: { animalId: kg } }: pesagem animal por animal; a média do lote sai dos pesos.
// Devolve o lote atualizado.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const { id } = await params
  if (!(await findLot(id, auth.farmId))) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })

  const body = await request.json()
  const date = parseDay(body.date)
  if (!date) return NextResponse.json({ error: 'Informe a data da pesagem' }, { status: 400 })
  if (body.weights !== undefined) {
    const inLot = (await prisma.animal.findMany({ where: { lotId: id }, select: { id: true } })).map((a) => a.id)
    const weights = parseAnimalWeights(body.weights, inLot)
    if (!weights) return NextResponse.json({ error: 'Confira os pesos: use kg, por exemplo 300' }, { status: 400 })
    if (!weights.size) return NextResponse.json({ error: 'Informe o peso de pelo menos um animal' }, { status: 400 })
    await prisma.$transaction(async (tx) => {
      const lotWeighing = await tx.lotWeighing.create({ data: { lotId: id, date, headCount: inLot.length, avgWeight: average([...weights.values()]) } })
      await tx.animalWeighing.createMany({ data: [...weights].map(([animalId, weight]) => ({ animalId, weight, date, lotWeighingId: lotWeighing.id })) })
    })
  } else {
    const weighing = parseWeighing(body)
    if (typeof weighing === 'string') return NextResponse.json({ error: weighing }, { status: 400 })
    await prisma.lotWeighing.create({ data: { lotId: id, date, ...weighing } })
  }
  const lot = await prisma.lot.findUniqueOrThrow({ where: { id }, select: LOT_SELECT })
  return NextResponse.json(serializeLot(lot), { status: 201 })
}

// DELETE { weighingId }: apaga uma pesagem (a de entrada só sai junto com o lote)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const { id } = await params
  if (!(await findLot(id, auth.farmId))) return NextResponse.json({ error: 'Lote não encontrado' }, { status: 404 })

  const { weighingId } = await request.json()
  const weighings = await prisma.lotWeighing.findMany({ where: { lotId: id }, select: { id: true }, orderBy: { date: 'asc' } })
  if (!weighings.some((w) => w.id === weighingId)) return NextResponse.json({ error: 'Pesagem não encontrada' }, { status: 404 })
  if (weighings[0].id === weighingId) return NextResponse.json({ error: 'A pesagem de entrada não pode ser apagada. Altere ou exclua o lote.' }, { status: 400 })

  await prisma.lotWeighing.delete({ where: { id: weighingId } })
  const lot = await prisma.lot.findUniqueOrThrow({ where: { id }, select: LOT_SELECT })
  return NextResponse.json(serializeLot(lot))
}
