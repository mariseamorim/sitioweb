import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const production = await prisma.milkProduction.findUnique({
      where: { id: params.id },
      include: { animal: true },
    })

    if (!production) {
      return NextResponse.json({ error: 'Milk production not found' }, { status: 404 })
    }

    return NextResponse.json(production)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch milk production' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { date, quantity, observations } = body

    const production = await prisma.milkProduction.update({
      where: { id: params.id },
      data: {
        date: date ? new Date(date) : undefined,
        quantity: quantity ? parseFloat(quantity) : undefined,
        observations,
      },
      include: { animal: true },
    })

    return NextResponse.json(production)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update milk production' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.milkProduction.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Milk production deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete milk production' }, { status: 500 })
  }
}
