import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireProducer } from '@/lib/auth'
import { visibleOffersWhere } from '@/lib/vendors'

// POST: conta um clique em "Chamar no WhatsApp" e abre um contato da propriedade com a oferta,
// que o fornecedor depois marca como venda ou não (relatório de vendas). Um contato aberto por
// propriedade e oferta: cliques repetidos só somam na contagem.
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProducer(false)
  if ('error' in auth) return auth.error

  const { id } = await params
  const visible = await prisma.promotion.findFirst({ where: { id, ...(await visibleOffersWhere(auth.farmId)) }, select: { id: true } })
  if (!visible) return notFound('Oferta não encontrada')

  const open = await prisma.offerContact.findFirst({ where: { promotionId: id, farmId: auth.farmId, status: 'contato' }, select: { id: true } })
  await prisma.$transaction([
    prisma.promotion.update({ where: { id }, data: { whatsappClicks: { increment: 1 } } }),
    ...(open ? [] : [prisma.offerContact.create({ data: { promotionId: id, farmId: auth.farmId } })]),
  ])
  return NextResponse.json({ ok: true })
}
