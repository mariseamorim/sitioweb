import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireVendor } from '@/lib/auth'
import { offerError, parseOffer } from '@/lib/offers'

async function findOwned(id: string, vendorId: string) {
  return prisma.promotion.findFirst({ where: { id, vendorId }, select: { id: true } })
}

// PUT: edita a oferta; com { isActive } apenas pausa ou reativa
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVendor()
  if ('error' in auth) return auth.error

  const { id } = await params
  if (!(await findOwned(id, auth.vendor.id))) return notFound('Oferta não encontrada')

  const body = await request.json()
  if (Object.keys(body).length === 1 && typeof body.isActive === 'boolean') {
    return NextResponse.json(await prisma.promotion.update({ where: { id }, data: { isActive: body.isActive } }))
  }

  const offer = parseOffer(body)
  const error = offerError(offer)
  if (error) return NextResponse.json({ error }, { status: 400 })
  const updated = await prisma.promotion.update({ where: { id }, data: { ...offer, validUntil: offer.validUntil! } })
  return NextResponse.json(updated)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVendor()
  if ('error' in auth) return auth.error

  const { id } = await params
  if (!(await findOwned(id, auth.vendor.id))) return notFound('Oferta não encontrada')
  await prisma.promotion.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
