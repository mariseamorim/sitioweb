import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const farmId = request.nextUrl.searchParams.get('farmId')
    if (!farmId) return NextResponse.json({ error: 'farmId obrigatório' }, { status: 400 })

    const from = request.nextUrl.searchParams.get('from')
    const to = request.nextUrl.searchParams.get('to')

    const transactions = await prisma.transaction.findMany({
      where: {
        farmId,
        ...(from || to ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to + 'T23:59:59') } : {}),
          },
        } : {}),
      },
      include: { animal: { select: { id: true, name: true, code: true } } },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(transactions)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar transações' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { farmId, type, category, date, amount, description, animalId } = body

    if (!farmId || !type || !category || !date || !amount) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
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
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar transação' }, { status: 500 })
  }
}
