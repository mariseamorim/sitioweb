import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const treatment = await prisma.veterinaryTreatment.findUnique({
      where: { id },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { startDate, endDate, medicine, batch, manufacturer, description, observations } = body

    const treatment = await prisma.veterinaryTreatment.update({
      where: { id },
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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    await prisma.veterinaryTreatment.delete({
      where: { id },
    })

    return NextResponse.json({ message: 'Veterinary treatment deleted' })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete veterinary treatment' }, { status: 500 })
  }
}
