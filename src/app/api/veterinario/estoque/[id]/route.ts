import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/auth'
import { requireVet } from '@/lib/vets'
import { day, kindFields, positive, text } from '@/lib/vetInput'

// PATCH: corrige o cadastro do item (nome, unidade, mínimo, validade). A quantidade só muda por entrada e saída.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const body = await request.json()
  const name = text(body.name, 120)
  if (!name) return NextResponse.json({ error: 'Informe o nome do item' }, { status: 400 })
  const { count } = await prisma.vetSupply.updateMany({
    where: { id: (await params).id, vetId: auth.vet.id },
    data: { name, ...kindFields(body), unit: text(body.unit, 20) ?? 'un', minimum: positive(body.minimum), expiry: day(body.expiry) },
  })
  return count ? NextResponse.json({ ok: true }) : notFound('Item não encontrado')
}

// DELETE: tira o item do estoque, com o histórico dele
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const { count } = await prisma.vetSupply.deleteMany({ where: { id: (await params).id, vetId: auth.vet.id } })
  return count ? NextResponse.json({ ok: true }) : notFound('Item não encontrado')
}
