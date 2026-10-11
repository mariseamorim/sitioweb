import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireProducer } from '@/lib/auth'

// PATCH: { status: 'fechado' | 'cancelado' } o produtor encerra o pedido (resolvido ou desistiu)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProducer(true)
  if ('error' in auth) return auth.error

  const { id } = await params
  const { status } = await request.json()
  if (!['fechado', 'cancelado'].includes(status)) return NextResponse.json({ error: 'Situação inválida' }, { status: 400 })

  const found = await prisma.supplyRequest.findFirst({ where: { id, farmId: auth.farmId }, select: { id: true } })
  if (!found) return notFound('Pedido não encontrado')

  const updated = await prisma.supplyRequest.update({ where: { id }, data: { status } })
  return NextResponse.json(updated)
}
