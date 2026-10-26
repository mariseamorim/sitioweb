import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFarmAccess, notFound } from '@/lib/auth'
import { animalToday } from '@/lib/animalRules'
import { optionalKg, rearingAnimal } from '../../../recria/shared'

const fail = (error: string) => NextResponse.json({ error }, { status: 400 })

// POST { date, weight }: pesagem de um animal fora de lote (recria por animal). Devolve o animal com as pesagens.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const { id } = await params
  const animal = await prisma.animal.findFirst({ where: { id, farmId: auth.farmId }, select: { id: true, birthDate: true } })
  if (!animal) return notFound('Animal não encontrado')

  const body = await request.json()
  const weight = optionalKg(body.weight)
  if (!weight) return fail('Informe o peso em kg, por exemplo 180')
  const date = typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : ''
  if (!date || date > animalToday()) return fail('Informe a data da pesagem (até hoje)')
  if (date < animal.birthDate.toISOString().slice(0, 10)) return fail('A pesagem não pode ser antes do nascimento')

  await prisma.animalWeighing.create({ data: { animalId: id, date: new Date(date), weight } })
  return NextResponse.json(await rearingAnimal(id), { status: 201 })
}

// DELETE { weighingId }: apaga uma pesagem individual (as do lote saem pela tela do lote)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const { id } = await params
  if (!(await prisma.animal.findFirst({ where: { id, farmId: auth.farmId }, select: { id: true } }))) return notFound('Animal não encontrado')
  const { weighingId } = await request.json()
  const weighing = await prisma.animalWeighing.findFirst({ where: { id: String(weighingId), animalId: id }, select: { id: true, lotWeighingId: true } })
  if (!weighing) return notFound('Pesagem não encontrada')
  if (weighing.lotWeighingId) return fail('Essa pesagem é do lote: corrija pela tela do lote')
  await prisma.animalWeighing.delete({ where: { id: weighing.id } })
  return NextResponse.json(await rearingAnimal(id))
}
