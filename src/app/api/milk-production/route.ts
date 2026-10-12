import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'
import { milkDay, milkNumber, milkPrice } from '@/lib/milkValidation'

export async function GET(request: NextRequest) {
  const auth = await requireFarmAccess('leite', 'view')
  if (auth.error) return auth.error

  try {
    const animalId = request.nextUrl.searchParams.get('animalId')

    const productions = await prisma.milkProduction.findMany({
      where: { farmId: auth.farmId, ...(animalId ? { animalId } : {}) },
      include: { animal: true },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(productions)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar produção de leite' }, { status: 500 })
  }
}

// POST: um lançamento. Sem animalId, é o total do dia (sítio que não separa por vaca).
export async function POST(request: NextRequest) {
  const auth = await requireFarmAccess('leite', 'edit')
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { animalId, date, observations } = body
    const quantity = milkNumber(body.quantity)
    const cowsMilked = body.cowsMilked === undefined || body.cowsMilked === null || body.cowsMilked === '' ? null : milkNumber(body.cowsMilked)
    const day = milkDay(date)

    if (!day || !Number.isFinite(quantity) || !(quantity > 0)) {
      return NextResponse.json({ error: 'Data e quantidade são obrigatórias' }, { status: 400 })
    }
    if (cowsMilked !== null && (!Number.isInteger(cowsMilked) || cowsMilked <= 0)) return NextResponse.json({ error: 'Informe um número inteiro de vacas ordenhadas' }, { status: 400 })
    const farm = body.pricePerLiter === undefined ? await prisma.farm.findUnique({ where: { id: auth.farmId }, select: { milkPrice: true } }) : null
    const pricePerLiter = milkPrice(body.pricePerLiter === undefined ? farm?.milkPrice ?? null : body.pricePerLiter)
    if (pricePerLiter === undefined) return NextResponse.json({ error: 'Preço por litro inválido' }, { status: 400 })
    if (animalId) {
      const animal = await prisma.animal.findFirst({ where: { id: animalId, farmId: auth.farmId }, select: { id: true } })
      if (!animal) return notFound('Animal não encontrado')
    }

    const production = await prisma.milkProduction.create({
      data: {
        farmId: auth.farmId,
        animalId: animalId || null,
        date: day,
        quantity,
        pricePerLiter,
        cowsMilked: !animalId ? cowsMilked : null,
        observations: observations || null,
      },
      include: { animal: true },
    })

    return NextResponse.json(production, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao registrar produção' }, { status: 500 })
  }
}
