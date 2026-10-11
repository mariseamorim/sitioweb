import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await requireFarmAccess('veterinario', 'view')
  if (auth.error) return auth.error

  try {
    const animalId = request.nextUrl.searchParams.get('animalId')

    if (animalId) {
      const treatments = await prisma.veterinaryTreatment.findMany({
        where: { animalId, animal: { farmId: auth.farmId } },
        orderBy: { startDate: 'desc' },
      })
      return NextResponse.json(treatments)
    }

    const treatments = await prisma.veterinaryTreatment.findMany({
      where: { animal: { farmId: auth.farmId } },
      include: { animal: true },
      orderBy: { startDate: 'desc' },
    })
    return NextResponse.json(treatments)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar tratamentos' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFarmAccess('veterinario', 'edit')
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { animalId, startDate, endDate, medicine, batch, manufacturer, description, observations } = body

    if (!animalId || !startDate || !medicine) {
      return NextResponse.json({ error: 'Animal, data de início e medicamento são obrigatórios' }, { status: 400 })
    }
    const animal = await prisma.animal.findFirst({ where: { id: animalId, farmId: auth.farmId }, select: { id: true } })
    if (!animal) return notFound('Animal não encontrado')

    const treatment = await prisma.veterinaryTreatment.create({
      data: {
        animalId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        medicine,
        batch,
        manufacturer,
        description,
        observations,
      },
      include: { animal: true },
    })

    return NextResponse.json(treatment, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao registrar tratamento' }, { status: 500 })
  }
}
