import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, notFound } from '@/lib/auth'
import { canManageMembership, memberIdentity } from '@/lib/associacao'
import { cleanNumber, cleanText } from '@/lib/laticinio'

// PUT: { purchaseId, quantity, note? } o associado informa quanto quer na compra coletiva (0 ou vazio tira o pedido)
export async function PUT(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 })
  const identity = memberIdentity(user)
  if (!identity || !canManageMembership(user)) return NextResponse.json({ error: 'Você não tem permissão para esta ação' }, { status: 403 })

  const body = await request.json()
  const purchase = await prisma.groupPurchase.findUnique({ where: { id: String(body.purchaseId ?? '') }, select: { id: true, organizationId: true, status: true, deadline: true } })
  if (!purchase) return notFound('Compra não encontrada')
  const member = await prisma.orgMember.findFirst({ where: { organizationId: purchase.organizationId, ...identity }, select: { id: true, status: true } })
  if (!member) return notFound('Compra não encontrada')
  if (member.status !== 'ativo') return NextResponse.json({ error: 'Associado inativo. Fale com a associação.' }, { status: 403 })
  if (purchase.status !== 'aberta') return NextResponse.json({ error: 'Esta compra já foi fechada' }, { status: 409 })

  const quantity = cleanNumber(body.quantity)
  const where = { purchaseId_memberId: { purchaseId: purchase.id, memberId: member.id } }
  if (!quantity) {
    await prisma.groupPurchaseOrder.deleteMany({ where: { purchaseId: purchase.id, memberId: member.id } })
    return NextResponse.json({ ok: true, quantity: null })
  }
  const note = cleanText(body.note, 300)
  const order = await prisma.groupPurchaseOrder.upsert({
    where,
    create: { purchaseId: purchase.id, memberId: member.id, quantity, note },
    update: { quantity, note },
  })
  return NextResponse.json(order)
}
