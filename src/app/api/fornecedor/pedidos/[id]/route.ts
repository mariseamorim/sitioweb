import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireVendor } from '@/lib/auth'

// PATCH: o fornecedor responde ({ reply, replyPrice? }) ou marca como atendido ({ status: 'fechado' })
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVendor()
  if ('error' in auth) return auth.error

  const { id } = await params
  const found = await prisma.supplyRequest.findFirst({ where: { id, vendorId: auth.vendor.id }, select: { status: true } })
  if (!found) return notFound('Pedido não encontrado')
  if (found.status === 'cancelado') return NextResponse.json({ error: 'O cliente cancelou este pedido' }, { status: 409 })

  const body = await request.json()
  if (body.status === 'fechado') {
    return NextResponse.json(await prisma.supplyRequest.update({ where: { id }, data: { status: 'fechado' } }))
  }

  const reply = String(body.reply ?? '').trim().slice(0, 1000)
  if (!reply) return NextResponse.json({ error: 'Escreva a resposta' }, { status: 400 })
  // "1.250,50" (milhar com ponto) ou "12.5" / "12,5"
  const rawPrice = String(body.replyPrice ?? '').trim()
  const price = !rawPrice ? null : Number(rawPrice.includes(',') ? rawPrice.replace(/\./g, '').replace(',', '.') : rawPrice)
  if (price !== null && (!Number.isFinite(price) || price < 0)) return NextResponse.json({ error: 'Preço inválido' }, { status: 400 })

  const updated = await prisma.supplyRequest.update({
    where: { id },
    data: { reply, replyPrice: price, repliedAt: new Date(), status: found.status === 'fechado' ? 'fechado' : 'respondido' },
  })
  return NextResponse.json(updated)
}
