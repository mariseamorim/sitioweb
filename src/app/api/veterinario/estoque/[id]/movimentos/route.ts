import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/auth'
import { requireVet } from '@/lib/vets'
import { day, positive, text } from '@/lib/vetInput'

// POST: entrada ou saída de um item. Body: { type: 'entrada' | 'saida', quantity, date?, farmName?, note? }
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const body = await request.json()
  const quantity = positive(body.quantity)
  if (body.type !== 'entrada' && body.type !== 'saida') return NextResponse.json({ error: 'Movimento inválido' }, { status: 400 })
  if (!quantity) return NextResponse.json({ error: 'Informe a quantidade' }, { status: 400 })
  const id = (await params).id

  const result = await prisma.$transaction(async (tx) => {
    const supply = await tx.vetSupply.findFirst({ where: { id, vetId: auth.vet.id } })
    if (!supply) return 'missing' as const
    if (body.type === 'saida') {
      // Só baixa se houver saldo: a condição vai junto na atualização, para duas saídas ao mesmo tempo não deixarem negativo
      const { count } = await tx.vetSupply.updateMany({ where: { id, quantity: { gte: quantity } }, data: { quantity: { decrement: quantity } } })
      if (!count) return 'short' as const
    } else {
      await tx.vetSupply.update({ where: { id }, data: { quantity: { increment: quantity } } })
    }
    await tx.vetSupplyMove.create({ data: { supplyId: id, type: body.type, quantity, date: day(body.date) ?? new Date(), farmName: text(body.farmName, 120), note: text(body.note, 300) } })
    return tx.vetSupply.findUnique({ where: { id } })
  })
  if (result === 'missing') return notFound('Item não encontrado')
  if (result === 'short') return NextResponse.json({ error: 'A saída é maior do que o saldo do item' }, { status: 400 })
  return NextResponse.json(result, { status: 201 })
}
