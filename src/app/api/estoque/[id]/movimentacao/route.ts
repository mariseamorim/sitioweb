import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: supplyId } = await params
    const body = await request.json()
    const { type, quantity, date, description } = body

    if (!type || !quantity || !date) {
      return NextResponse.json({ error: 'Tipo, quantidade e data são obrigatórios' }, { status: 400 })
    }

    const qty = parseFloat(quantity)

    const [movement, supply] = await prisma.$transaction([
      prisma.supplyMovement.create({
        data: {
          supplyId,
          type,
          quantity: qty,
          date: new Date(date),
          description: description || null,
        },
      }),
      prisma.supply.update({
        where: { id: supplyId },
        data: {
          currentQuantity: {
            increment: type === 'Entrada' ? qty : -qty,
          },
        },
        include: { movements: { orderBy: { date: 'desc' }, take: 10 } },
      }),
    ])

    return NextResponse.json({ movement, supply }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao registrar movimentação' }, { status: 500 })
  }
}
