import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVendor } from '@/lib/auth'
import { buildSalesReport, parseRange, parseSale } from '@/lib/offerSales'
import { todayISO } from '@/lib/utils'

// Relatório de vendas do fornecedor: qual oferta mais virou venda, contatos a confirmar e vendas do período.

const farmSelect = { select: { name: true, owner: true, city: true, state: true, phone: true } }

function row(c: {
  id: string; promotionId: string; farmId: string | null; buyerName: string | null; status: string; source: string
  saleValue: number | null; quantity: number | null; soldAt: Date | null; note: string | null; createdAt: Date
  promotion: { title: string }; farm: { name: string; owner: string | null; city: string | null; state: string | null; phone: string | null } | null
}) {
  return {
    id: c.id, promotionId: c.promotionId, offerTitle: c.promotion.title, farmId: c.farmId, farm: c.farm, buyerName: c.buyerName,
    status: c.status, source: c.source, saleValue: c.saleValue, quantity: c.quantity, soldAt: c.soldAt, note: c.note, createdAt: c.createdAt,
  }
}

// GET ?from=AAAA-MM-DD&to=AAAA-MM-DD (sem período: o mês atual)
export async function GET(request: NextRequest) {
  const auth = await requireVendor()
  if ('error' in auth) return auth.error
  const { vendor } = auth
  const range = parseRange(request.nextUrl.searchParams.get('from') ?? undefined, request.nextUrl.searchParams.get('to') ?? undefined)
  if (!range) return NextResponse.json({ error: 'Período inválido' }, { status: 400 })

  const [offers, contacts, requests] = await Promise.all([
    prisma.promotion.findMany({ where: { vendorId: vendor.id }, select: { id: true, title: true, category: true, price: true, unit: true } }),
    prisma.offerContact.findMany({
      where: { promotion: { vendorId: vendor.id } },
      include: { promotion: { select: { title: true } }, farm: farmSelect },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.supplyRequest.findMany({ where: { vendorId: vendor.id, status: 'fechado' }, select: { status: true, replyPrice: true, updatedAt: true } }),
  ])
  const report = buildSalesReport(offers, contacts, requests, range)
  const rows = contacts.map(row)
  return NextResponse.json({
    ...report,
    // Contatos ainda sem resposta (de qualquer data): o fornecedor diz se virou venda
    pending: rows.filter((c) => c.status === 'contato'),
    // Vendas do período, uma a uma
    sales: rows.filter((c) => c.status === 'venda' && (c.soldAt ?? c.createdAt).toISOString().slice(0, 10) >= range.from && (c.soldAt ?? c.createdAt).toISOString().slice(0, 10) <= range.to),
  })
}

// POST: venda registrada à mão { promotionId, farmId?, buyerName?, saleValue?, quantity?, soldAt?, note? }. Cliente e comprador são opcionais.
export async function POST(request: NextRequest) {
  const auth = await requireVendor()
  if ('error' in auth) return auth.error
  const { vendor } = auth
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>

  const promotionId = typeof body.promotionId === 'string' ? body.promotionId : ''
  const offer = promotionId ? await prisma.promotion.findFirst({ where: { id: promotionId, vendorId: vendor.id }, select: { id: true } }) : null
  if (!offer) return NextResponse.json({ error: 'Escolha a oferta' }, { status: 400 })

  const sale = parseSale(body, todayISO())
  if (typeof sale === 'string') return NextResponse.json({ error: sale }, { status: 400 })

  // Cliente do app: só quem está vinculado ao fornecedor
  const farmId = typeof body.farmId === 'string' && body.farmId ? body.farmId : null
  if (farmId) {
    const client = await prisma.vendorClient.findFirst({ where: { vendorId: vendor.id, farmId }, select: { id: true } })
    if (!client) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 400 })
  }

  const created = await prisma.offerContact.create({
    data: {
      promotionId: offer.id, farmId, buyerName: farmId ? null : sale.buyerName, status: 'venda', source: 'manual',
      saleValue: sale.saleValue, quantity: sale.quantity, note: sale.note, soldAt: new Date(`${sale.soldAt}T00:00:00Z`),
    },
    include: { promotion: { select: { title: true } }, farm: farmSelect },
  })
  return NextResponse.json(row(created), { status: 201 })
}
