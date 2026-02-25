import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const treatment = await prisma.veterinaryTreatment.findUnique({
      where: { id: params.id },
      include: { animal: true },
    })

    if (!treatment) {
      return NextResponse.json({ error: 'Veterinary treatment not found' }, { status: 404 })
    }

    return NextResponse.json(treatment)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch veterinary treatment' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { startDate, endDate, medicine, batch, manufacturer, description, observations } = body

    const treatment = await prisma.veterinaryTreatment.update({
      where: { id: params.id },
      data: {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        medicine,
        batch,
        manufacturer,
        description,
        observations,
      },
      include: { animal: true },
    })

    return NextResponse.json(treatment)
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update veterinary treatment' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.veterinaryTreatment.delete({
      where: { id: params.id },
    })

    return NextResponse.json({ message: 'Veterinary treatment deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete veterinary treatment' }, { status: 500 })
  }
}
