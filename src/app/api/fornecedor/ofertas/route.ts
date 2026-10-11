import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendor } from '@/lib/auth'
import { offerError, parseOffer } from '@/lib/offers'
import { WEEKLY_OFFER_LIMIT } from '@/lib/vendors'

export async function POST(request: NextRequest) {
  const auth = await requireVendor()
  if ('error' in auth) return auth.error
  const { vendor } = auth

  if (vendor.status !== 'aprovado') {
    return NextResponse.json({ error: 'Seu cadastro ainda está em análise. Você poderá publicar ofertas após a aprovação.' }, { status: 403 })
  }
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const recent = await prisma.promotion.count({ where: { vendorId: vendor.id, createdAt: { gte: weekAgo } } })
  if (recent >= WEEKLY_OFFER_LIMIT) {
    return NextResponse.json({ error: `Limite de ${WEEKLY_OFFER_LIMIT} ofertas novas por semana atingido. Você pode editar ou reativar as existentes.` }, { status: 429 })
  }

  const offer = parseOffer(await request.json())
  const error = offerError(offer)
  if (error) return NextResponse.json({ error }, { status: 400 })

  const created = await prisma.promotion.create({ data: { ...offer, validUntil: offer.validUntil!, vendorId: vendor.id } })
  return NextResponse.json(created, { status: 201 })
}
