import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await requireFarmAccess('vacinacao', 'view')
  if (auth.error) return auth.error

  try {
    const animalId = request.nextUrl.searchParams.get('animalId')

    const vaccinations = await prisma.vaccination.findMany({
      where: { animal: { farmId: auth.farmId }, ...(animalId ? { animalId } : {}) },
      include: { animal: true },
      orderBy: { scheduledDate: 'desc' },
    })
    return NextResponse.json(vaccinations)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar vacinações' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFarmAccess('vacinacao', 'edit')
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { animalId, vaccineName, scheduledDate, appliedDate, batch, manufacturer, observations } = body

    if (!animalId || !vaccineName || !scheduledDate) {
      return NextResponse.json({ error: 'Animal, vacina e data agendada são obrigatórios' }, { status: 400 })
    }
    const animal = await prisma.animal.findFirst({ where: { id: animalId, farmId: auth.farmId }, select: { id: true } })
    if (!animal) return notFound('Animal não encontrado')

    const vaccination = await prisma.vaccination.create({
      data: {
        animalId,
        vaccineName,
        scheduledDate: new Date(scheduledDate),
        appliedDate: appliedDate ? new Date(appliedDate) : null,
        batch: batch || null,
        manufacturer: manufacturer || null,
        observations: observations || null,
      },
      include: { animal: true },
    })

    return NextResponse.json(vaccination, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar vacinação' }, { status: 500 })
  }
}
