import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendor } from '@/lib/auth'
import { SUPPLY_CATEGORIES } from '@/lib/supplies'
import { clientsNeedingSupplies, WEEKLY_OFFER_LIMIT } from '@/lib/vendors'

// GET: tudo o que o painel do fornecedor precisa
export async function GET() {
  const auth = await requireVendor()
  if ('error' in auth) return auth.error
  const { vendor } = auth

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  const monthStart = new Date(Date.UTC(new Date().getFullYear(), new Date().getMonth(), 1))
  const [offers, clients, offersThisWeek, requests, needs, salesThisMonth, contactsToConfirm] = await Promise.all([
    prisma.promotion.findMany({ where: { vendorId: vendor.id }, orderBy: { createdAt: 'desc' } }),
    prisma.vendorClient.findMany({
      where: { vendorId: vendor.id },
      include: { farm: { select: { name: true, owner: true, city: true, state: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.promotion.count({ where: { vendorId: vendor.id, createdAt: { gte: weekAgo } } }),
    // Pedidos de orçamento: abertos e os encerrados nos últimos 60 dias (cancelados somem)
    prisma.supplyRequest.findMany({
      where: { vendorId: vendor.id, OR: [{ status: { in: ['novo', 'respondido'] } }, { status: 'fechado', updatedAt: { gte: since } }] },
      include: { farm: { select: { name: true, owner: true, city: true, state: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    clientsNeedingSupplies(vendor.id, vendor.categories),
    // Vendas das ofertas no mês e contatos do WhatsApp ainda sem resposta (relatório de vendas)
    prisma.offerContact.count({ where: { promotion: { vendorId: vendor.id }, status: 'venda', soldAt: { gte: monthStart } } }),
    prisma.offerContact.count({ where: { promotion: { vendorId: vendor.id }, status: 'contato' } }),
  ])

  return NextResponse.json({
    vendor,
    offers,
    // O fornecedor vê só dados de contato de quem se vinculou a ele
    clients: clients.map((c) => ({ id: c.id, farmId: c.farmId, since: c.createdAt, ...c.farm })),
    offersThisWeek,
    weeklyLimit: WEEKLY_OFFER_LIMIT,
    requests,
    needs,
    salesThisMonth,
    contactsToConfirm,
  })
}

// PATCH: o fornecedor atualiza os próprios dados de contato
export async function PATCH(request: NextRequest) {
  const auth = await requireVendor()
  if ('error' in auth) return auth.error

  const body = await request.json()
  const data: Record<string, string | string[] | null> = {}
  for (const field of ['phone', 'whatsapp', 'city', 'description'] as const) {
    if (body[field] !== undefined) data[field] = body[field] || null
  }
  if (body.state !== undefined) data.state = body.state ? String(body.state).trim().toUpperCase() : null
  if (data.phone === null) return NextResponse.json({ error: 'Telefone é obrigatório' }, { status: 400 })
  // O que vende: filtra os avisos de estoque baixo dos clientes
  if (Array.isArray(body.categories)) {
    data.categories = SUPPLY_CATEGORIES.filter((c) => body.categories.includes(c))
  }

  const vendor = await prisma.vendor.update({ where: { id: auth.vendor.id }, data })
  return NextResponse.json(vendor)
}
