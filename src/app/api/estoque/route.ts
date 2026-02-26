import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const farmId = request.nextUrl.searchParams.get('farmId')
    if (!farmId) return NextResponse.json({ error: 'farmId obrigatório' }, { status: 400 })

    const supplies = await prisma.supply.findMany({
      where: { farmId },
      include: { movements: { orderBy: { date: 'desc' }, take: 10 } },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json(supplies)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar estoque' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { farmId, name, category, unit, currentQuantity, minimumQuantity } = body

    if (!farmId || !name || !category || !unit) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const supply = await prisma.supply.create({
      data: {
        farmId,
        name,
        category,
        unit,
        currentQuantity: parseFloat(currentQuantity) || 0,
        minimumQuantity: parseFloat(minimumQuantity) || 0,
      },
      include: { movements: true },
    })

    return NextResponse.json(supply, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar insumo' }, { status: 500 })
  }
}
