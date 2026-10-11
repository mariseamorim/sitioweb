import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendor } from '@/lib/auth'
import { WEEKLY_OFFER_LIMIT } from '@/lib/vendors'

// GET: tudo o que o painel do fornecedor precisa
export async function GET() {
  const auth = await requireVendor()
  if ('error' in auth) return auth.error
  const { vendor } = auth

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [offers, clients, offersThisWeek] = await Promise.all([
    prisma.promotion.findMany({ where: { vendorId: vendor.id }, orderBy: { createdAt: 'desc' } }),
    prisma.vendorClient.findMany({
      where: { vendorId: vendor.id },
      include: { farm: { select: { name: true, owner: true, city: true, state: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.promotion.count({ where: { vendorId: vendor.id, createdAt: { gte: weekAgo } } }),
  ])

  return NextResponse.json({
    vendor,
    offers,
    // O fornecedor vê só dados de contato de quem se vinculou a ele
    clients: clients.map((c) => ({ id: c.id, since: c.createdAt, ...c.farm })),
    offersThisWeek,
    weeklyLimit: WEEKLY_OFFER_LIMIT,
  })
}

// PATCH: o fornecedor atualiza os próprios dados de contato
export async function PATCH(request: NextRequest) {
  const auth = await requireVendor()
  if ('error' in auth) return auth.error

  const body = await request.json()
  const data: Record<string, string | null> = {}
  for (const field of ['phone', 'whatsapp', 'city', 'description'] as const) {
    if (body[field] !== undefined) data[field] = body[field] || null
  }
  if (body.state !== undefined) data.state = body.state ? String(body.state).trim().toUpperCase() : null
  if (data.phone === null) return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 })

  const vendor = await prisma.vendor.update({ where: { id: auth.vendor.id }, data })
  return NextResponse.json(vendor)
}
