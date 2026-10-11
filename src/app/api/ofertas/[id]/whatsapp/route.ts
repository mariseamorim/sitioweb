import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireProducer } from '@/lib/auth'
import { visibleOffersWhere } from '@/lib/vendors'

// POST: conta um clique em "Chamar no WhatsApp" (métrica para o fornecedor)
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProducer(false)
  if ('error' in auth) return auth.error

  const { id } = await params
  const visible = await prisma.promotion.findFirst({ where: { id, ...(await visibleOffersWhere(auth.farmId)) }, select: { id: true } })
  if (!visible) return notFound('Oferta não encontrada')

  await prisma.promotion.update({ where: { id }, data: { whatsappClicks: { increment: 1 } } })
  return NextResponse.json({ ok: true })
}
