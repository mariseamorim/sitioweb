import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const animalId = request.nextUrl.searchParams.get('animalId')
    const farmId = request.nextUrl.searchParams.get('farmId')

    if (animalId) {
      const productions = await prisma.milkProduction.findMany({
        where: { animalId },
        orderBy: { date: 'desc' },
      })
      return NextResponse.json(productions)
    }

    if (farmId) {
      const productions = await prisma.milkProduction.findMany({
        where: {
          animal: {
            farmId,
          },
        },
        include: { animal: true },
        orderBy: { date: 'desc' },
      })
      return NextResponse.json(productions)
    }

    return NextResponse.json({ error: 'farmId or animalId required' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch milk productions' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { animalId, date, quantity, observations } = body

    const production = await prisma.milkProduction.create({
      data: {
        animalId,
        date: new Date(date),
        quantity: parseFloat(quantity),
        observations,
      },
      include: { animal: true },
    })

    return NextResponse.json(production, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create milk production' }, { status: 500 })
  }
}
