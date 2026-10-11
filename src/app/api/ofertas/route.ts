import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProducer } from '@/lib/auth'
import { lowStockCategories, visibleOffersWhere } from '@/lib/vendors'

// GET: ofertas para o produtor. Ao abrir a tela, as ofertas deixam de contar como "novas" no sino.
export async function GET(request: NextRequest) {
  const auth = await requireProducer(false)
  if ('error' in auth) return auth.error
  const { farmId, user } = auth
  const category = request.nextUrl.searchParams.get('categoria')

  const [where, lowCategories, links] = await Promise.all([
    visibleOffersWhere(farmId),
    lowStockCategories(farmId),
    prisma.vendorClient.findMany({ where: { farmId }, select: { vendorId: true } }),
  ])
  const offers = await prisma.promotion.findMany({
    where: { ...where, ...(category ? { category } : {}) },
    include: { vendor: { select: { id: true, companyName: true, city: true, state: true, whatsapp: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
    take: 60,
  })
  await prisma.user.update({ where: { id: user.id }, data: { offersSeenAt: new Date() } })

  const linkedIds = new Set(links.map((l) => l.vendorId))
  const result = offers
    .map((o) => ({ ...o, isMyVendor: linkedIds.has(o.vendorId), matchesLowStock: lowCategories.includes(o.category) }))
    // Primeiro o que combina com o estoque baixo
    .sort((a, b) => Number(b.matchesLowStock) - Number(a.matchesLowStock))
  return NextResponse.json({ offers: result, lowCategories })
}
