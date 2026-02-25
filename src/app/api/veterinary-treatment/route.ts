import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const animalId = request.nextUrl.searchParams.get('animalId')
    const farmId = request.nextUrl.searchParams.get('farmId')

    if (animalId) {
      const treatments = await prisma.veterinaryTreatment.findMany({
        where: { animalId },
        orderBy: { startDate: 'desc' },
      })
      return NextResponse.json(treatments)
    }

    if (farmId) {
      const treatments = await prisma.veterinaryTreatment.findMany({
        where: {
          animal: {
            farmId,
          },
        },
        include: { animal: true },
        orderBy: { startDate: 'desc' },
      })
      return NextResponse.json(treatments)
    }

    return NextResponse.json({ error: 'farmId or animalId required' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch veterinary treatments' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { animalId, startDate, endDate, medicine, batch, manufacturer, description, observations } = body

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
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create veterinary treatment' }, { status: 500 })
  }
}
