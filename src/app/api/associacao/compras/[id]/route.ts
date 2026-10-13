import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireOrganization } from '@/lib/auth'

async function findPurchase(id: string) {
  const auth = await requireOrganization('associacao')
  if ('error' in auth) return { error: auth.error } as const
  const purchase = await prisma.groupPurchase.findFirst({ where: { id, organizationId: auth.organization.id }, select: { id: true } })
  if (!purchase) return { error: notFound('Compra não encontrada') } as const
  return { purchase } as const
}

// PATCH: { status: 'aberta' | 'fechada' } encerra (ou reabre) os pedidos dos associados
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await findPurchase((await params).id)
  if ('error' in found) return found.error
  const { status } = await request.json()
  if (!['aberta', 'fechada'].includes(status)) return NextResponse.json({ error: 'Situação inválida' }, { status: 400 })
  return NextResponse.json(await prisma.groupPurchase.update({ where: { id: found.purchase.id }, data: { status } }))
}

// DELETE: apaga a compra e os pedidos dela
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await findPurchase((await params).id)
  if ('error' in found) return found.error
  await prisma.groupPurchase.delete({ where: { id: found.purchase.id } })
  return NextResponse.json({ ok: true })
}
