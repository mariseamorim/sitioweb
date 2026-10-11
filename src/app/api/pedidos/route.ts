import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireProducer } from '@/lib/auth'
import { SUPPLY_CATEGORIES } from '@/lib/supplies'

// Pedidos abertos por propriedade (evita excesso de mensagens para os fornecedores)
const OPEN_LIMIT = 30

// GET: pedidos de orçamento da propriedade (abertos e dos últimos 60 dias)
export async function GET() {
  const auth = await requireProducer(false)
  if ('error' in auth) return auth.error

  const since = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
  const requests = await prisma.supplyRequest.findMany({
    where: { farmId: auth.farmId, OR: [{ status: { in: ['novo', 'respondido'] } }, { updatedAt: { gte: since } }] },
    include: { vendor: { select: { id: true, companyName: true, whatsapp: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json(requests)
}

// POST: { vendorId, supplyId?, itemName, category, quantity?, unit?, note? }
export async function POST(request: NextRequest) {
  const auth = await requireProducer(true)
  if ('error' in auth) return auth.error

  const body = await request.json()
  const itemName = String(body.itemName ?? '').trim().slice(0, 120)
  const category = SUPPLY_CATEGORIES.includes(body.category) ? body.category : 'Outro'
  const quantity = body.quantity === undefined || body.quantity === null || body.quantity === '' ? null : Number(String(body.quantity).replace(',', '.'))
  if (!itemName) return NextResponse.json({ error: 'Informe o produto ou o assunto' }, { status: 400 })
  // Mensagem solta (sem item do estoque) precisa do texto
  if (!body.supplyId && !String(body.note ?? '').trim()) return NextResponse.json({ error: 'Escreva a mensagem' }, { status: 400 })
  if (quantity !== null && (!Number.isFinite(quantity) || quantity <= 0)) {
    return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 })
  }

  // Só para fornecedor vinculado à propriedade e não bloqueado
  const link = await prisma.vendorClient.findUnique({
    where: { vendorId_farmId: { vendorId: String(body.vendorId ?? ''), farmId: auth.farmId } },
    select: { vendor: { select: { id: true, status: true, companyName: true } } },
  })
  if (!link || link.vendor.status === 'bloqueado') return notFound('Fornecedor não encontrado')

  const supplyId = body.supplyId
    ? (await prisma.supply.findFirst({ where: { id: String(body.supplyId), farmId: auth.farmId }, select: { id: true } }))?.id ?? null
    : null

  const open = await prisma.supplyRequest.count({ where: { farmId: auth.farmId, status: { in: ['novo', 'respondido'] } } })
  if (open >= OPEN_LIMIT) {
    return NextResponse.json({ error: 'Muitos pedidos em aberto. Marque como resolvidos os que já foram atendidos.' }, { status: 429 })
  }

  const created = await prisma.supplyRequest.create({
    data: {
      farmId: auth.farmId,
      vendorId: link.vendor.id,
      supplyId,
      itemName,
      category,
      quantity,
      unit: body.unit ? String(body.unit).trim().slice(0, 20) : null,
      note: body.note ? String(body.note).trim().slice(0, 500) : null,
      createdBy: auth.user.name,
    },
  })
  return NextResponse.json(created, { status: 201 })
}
