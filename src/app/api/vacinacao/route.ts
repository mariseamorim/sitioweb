import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const farmId = request.nextUrl.searchParams.get('farmId')
    const animalId = request.nextUrl.searchParams.get('animalId')

    if (animalId) {
      const vaccinations = await prisma.vaccination.findMany({
        where: { animalId },
        include: { animal: true },
        orderBy: { scheduledDate: 'desc' },
      })
      return NextResponse.json(vaccinations)
    }

    if (farmId) {
      const vaccinations = await prisma.vaccination.findMany({
        where: { animal: { farmId } },
        include: { animal: true },
        orderBy: { scheduledDate: 'desc' },
      })
      return NextResponse.json(vaccinations)
    }

    return NextResponse.json({ error: 'farmId ou animalId obrigatório' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar vacinações' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { animalId, vaccineName, scheduledDate, appliedDate, batch, manufacturer, observations } = body

    if (!animalId || !vaccineName || !scheduledDate) {
      return NextResponse.json({ error: 'Animal, vacina e data agendada são obrigatórios' }, { status: 400 })
    }

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
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar vacinação' }, { status: 500 })
  }
}
