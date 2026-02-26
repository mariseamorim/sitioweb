import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, category, unit, minimumQuantity } = body

    const supply = await prisma.supply.update({
      where: { id },
      data: {
        name,
        category,
        unit,
        minimumQuantity: minimumQuantity !== undefined ? parseFloat(minimumQuantity) : undefined,
      },
      include: { movements: { orderBy: { date: 'desc' }, take: 10 } },
    })

    return NextResponse.json(supply)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar insumo' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.supply.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao excluir insumo' }, { status: 500 })
  }
}
