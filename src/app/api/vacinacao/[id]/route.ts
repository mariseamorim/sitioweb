import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { vaccineName, scheduledDate, appliedDate, batch, manufacturer, observations } = body

    const vaccination = await prisma.vaccination.update({
      where: { id },
      data: {
        vaccineName,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        appliedDate: appliedDate ? new Date(appliedDate) : null,
        batch: batch || null,
        manufacturer: manufacturer || null,
        observations: observations || null,
      },
      include: { animal: true },
    })

    return NextResponse.json(vaccination)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar vacinação' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.vaccination.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao excluir vacinação' }, { status: 500 })
  }
}
