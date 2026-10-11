import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireProducer } from '@/lib/auth'

async function findLink(vendorId: string) {
  const auth = await requireProducer(true)
  if (auth.error) return { error: auth.error } as const
  const where = { vendorId_farmId: { vendorId, farmId: auth.farmId } }
  if (!(await prisma.vendorClient.findUnique({ where }))) return { error: notFound('Fornecedor não encontrado') } as const
  return { where } as const
}

// PATCH: { muted } silencia ou volta a receber as ofertas deste fornecedor;
// { shareStock } mostra ou esconde dele os itens do estoque abaixo do mínimo
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ vendorId: string }> }) {
  const link = await findLink((await params).vendorId)
  if ('error' in link) return link.error
  const body = await request.json()
  const data: { muted?: boolean; shareStock?: boolean } = {}
  if (body.muted !== undefined) data.muted = !!body.muted
  if (body.shareStock !== undefined) data.shareStock = !!body.shareStock
  await prisma.vendorClient.update({ where: link.where, data })
  return NextResponse.json({ ok: true })
}

// DELETE: remove o fornecedor da lista (ele deixa de ver a propriedade como cliente)
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ vendorId: string }> }) {
  const link = await findLink((await params).vendorId)
  if ('error' in link) return link.error
  await prisma.vendorClient.delete({ where: link.where })
  return NextResponse.json({ ok: true })
}
