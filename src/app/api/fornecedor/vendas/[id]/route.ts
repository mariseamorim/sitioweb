import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireVendor } from '@/lib/auth'
import { parseSale } from '@/lib/offerSales'
import { todayISO } from '@/lib/utils'

// Um contato/venda de oferta do fornecedor.
// PATCH { status: 'venda', saleValue?, quantity?, soldAt?, note? } confirma a venda;
// PATCH { status: 'perdido' } ou { status: 'contato' } muda o estado. DELETE apaga (vendas registradas à mão).

type Params = { params: Promise<{ id: string }> }

async function findOwned(id: string, vendorId: string) {
  return prisma.offerContact.findFirst({ where: { id, promotion: { vendorId } }, select: { id: true, source: true, status: true } })
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireVendor()
  if ('error' in auth) return auth.error
  const { id } = await params
  const found = await findOwned(id, auth.vendor.id)
  if (!found) return notFound('Contato não encontrado')

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const include = { promotion: { select: { title: true } }, farm: { select: { name: true, owner: true, city: true, state: true, phone: true } } }
  if (body.status === 'venda') {
    const sale = parseSale(body, todayISO())
    if (typeof sale === 'string') return NextResponse.json({ error: sale }, { status: 400 })
    const updated = await prisma.offerContact.update({
      where: { id },
      data: { status: 'venda', saleValue: sale.saleValue, quantity: sale.quantity, note: sale.note, soldAt: new Date(`${sale.soldAt}T00:00:00Z`) },
      include,
    })
    return NextResponse.json(updated)
  }
  if (body.status === 'perdido' || body.status === 'contato') {
    if (found.source === 'manual') return NextResponse.json({ error: 'Venda registrada à mão: exclua em vez de voltar para contato' }, { status: 409 })
    const updated = await prisma.offerContact.update({ where: { id }, data: { status: body.status, saleValue: null, quantity: null, soldAt: null }, include })
    return NextResponse.json(updated)
  }
  return NextResponse.json({ error: 'Informe o que aconteceu com o contato' }, { status: 400 })
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const auth = await requireVendor()
  if ('error' in auth) return auth.error
  const { id } = await params
  const found = await findOwned(id, auth.vendor.id)
  if (!found) return notFound('Contato não encontrado')
  await prisma.offerContact.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
