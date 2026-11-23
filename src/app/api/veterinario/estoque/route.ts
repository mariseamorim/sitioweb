import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVet } from '@/lib/vets'
import { day, kindFields, positive, text } from '@/lib/vetInput'

// GET: estoque do veterinário, com as 5 últimas movimentações de cada item
export async function GET() {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const supplies = await prisma.vetSupply.findMany({
    where: { vetId: auth.vet.id },
    include: { moves: { orderBy: [{ date: 'desc' }, { createdAt: 'desc' }], take: 5 } },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(supplies)
}

// POST: novo item. Body: { name, kind?, bullName?, bullBreed?, semenBatch?, unit?, quantity?, minimum?, expiry? }. A quantidade inicial entra como primeira entrada.
export async function POST(request: NextRequest) {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const body = await request.json()
  const name = text(body.name, 120)
  if (!name) return NextResponse.json({ error: 'Informe o nome do item' }, { status: 400 })
  const quantity = positive(body.quantity) ?? 0
  const supply = await prisma.vetSupply.create({
    data: {
      vetId: auth.vet.id, name, ...kindFields(body), unit: text(body.unit, 20) ?? 'un', quantity, minimum: positive(body.minimum), expiry: day(body.expiry),
      ...(quantity > 0 ? { moves: { create: { type: 'entrada', quantity, date: new Date(), note: 'Quantidade inicial' } } } : {}),
    },
  })
  return NextResponse.json(supply, { status: 201 })
}
