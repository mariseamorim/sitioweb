import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await requireFarmAccess('financeiro', 'view')
  if (auth.error) return auth.error
  const farmId = auth.farmId

  try {
    const from = request.nextUrl.searchParams.get('from')
    const to = request.nextUrl.searchParams.get('to')

    const transactions = await prisma.transaction.findMany({
      where: {
        farmId,
        ...(from || to ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to + 'T23:59:59Z') } : {}), // Z: datas gravadas em UTC, independente do fuso do servidor
          },
        } : {}),
      },
      include: { animal: { select: { id: true, name: true, code: true } } },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(transactions)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar transações' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFarmAccess('financeiro', 'edit')
  if (auth.error) return auth.error
  const farmId = auth.farmId

  try {
    const body = await request.json()
    const { type, category, date, amount, description, animalId } = body

    if (!type || !category || !date || !amount) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    if (animalId) {
      const animal = await prisma.animal.findFirst({ where: { id: animalId, farmId }, select: { id: true } })
      if (!animal) return notFound('Animal não encontrado')
    }

    const transaction = await prisma.transaction.create({
      data: {
        farmId,
        type,
        category,
        date: new Date(date),
        amount: parseFloat(amount),
        description: description || null,
        animalId: animalId || null,
      },
      include: { animal: { select: { id: true, name: true, code: true } } },
    })

    return NextResponse.json(transaction, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar transação' }, { status: 500 })
  }
}
