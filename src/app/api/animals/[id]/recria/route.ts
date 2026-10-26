import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFarmAccess, notFound } from '@/lib/auth'
import { animalToday } from '@/lib/animalRules'
import { canEnterRearing, rearingEntryError } from '@/lib/rearing'
import { optionalKg, rearingAnimal } from '../../../recria/shared'

const fail = (error: string) => NextResponse.json({ error }, { status: 400 })
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

// POST { start, weight?, target? }: o animal entra na recria na data da desmama; o peso vira a primeira pesagem
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const { id } = await params
  const animal = await prisma.animal.findFirst({
    where: { id, farmId: auth.farmId },
    select: { id: true, species: true, gender: true, birthDate: true, isCastrated: true, status: true, lotId: true, rearingStart: true, rearingEnd: true },
  })
  if (!animal) return notFound('Animal não encontrado')
  const today = animalToday()
  const current = { ...animal, rearingStart: animal.rearingStart?.toISOString() ?? null, rearingEnd: animal.rearingEnd?.toISOString() ?? null }
  if (!canEnterRearing(current, today)) {
    if (animal.lotId) return fail('O animal está num lote: acompanhe a recria por lá')
    if (current.rearingStart && !current.rearingEnd) return fail('O animal já está na recria')
    return fail('Só bezerros, bezerras e bois jovens vivos entram na recria')
  }

  const body = await request.json()
  const weight = optionalKg(body.weight)
  const target = optionalKg(body.target)
  if (weight === null) return fail('Peso inválido: use kg, por exemplo 180')
  if (target === null) return fail('Peso-alvo inválido: use kg, por exemplo 320')
  const start = typeof body.start === 'string' ? body.start : ''
  const error = rearingEntryError({ start, birthDate: animal.birthDate.toISOString(), today, weight, target })
  if (error) return fail(error)

  await prisma.$transaction(async (tx) => {
    await tx.animal.update({ where: { id }, data: { rearingStart: new Date(start), rearingEnd: null, rearingTarget: target ?? null } })
    if (weight) await tx.animalWeighing.create({ data: { animalId: id, date: new Date(start), weight } })
  })
  return NextResponse.json(await rearingAnimal(id), { status: 201 })
}

// PATCH { target } muda o peso-alvo; { end } encerra a recria (vendido, foi para a engorda ou virou matriz); { end: null } reabre
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const { id } = await params
  const animal = await prisma.animal.findFirst({ where: { id, farmId: auth.farmId }, select: { id: true, rearingStart: true } })
  if (!animal) return notFound('Animal não encontrado')
  if (!animal.rearingStart) return fail('O animal não está na recria')

  const body = await request.json()
  const data: { rearingTarget?: number | null; rearingEnd?: Date | null } = {}
  if ('target' in body) {
    const target = optionalKg(body.target)
    if (target === null) return fail('Peso-alvo inválido: use kg, por exemplo 320')
    data.rearingTarget = target ?? null
  }
  if ('end' in body) {
    if (body.end === null) data.rearingEnd = null
    else {
      if (typeof body.end !== 'string' || !ISO_DAY.test(body.end)) return fail('Informe a data de saída')
      if (body.end > animalToday()) return fail('A saída não pode ser no futuro')
      if (body.end < animal.rearingStart.toISOString().slice(0, 10)) return fail('A saída não pode ser antes da entrada')
      data.rearingEnd = new Date(body.end)
    }
  }
  if (!Object.keys(data).length) return fail('Nada para alterar')
  await prisma.animal.update({ where: { id }, data })
  return NextResponse.json(await rearingAnimal(id))
}
