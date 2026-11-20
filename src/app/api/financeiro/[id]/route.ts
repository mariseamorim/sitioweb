import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('financeiro', 'edit')
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const owned = await prisma.transaction.findFirst({ where: { id, farmId: auth.farmId }, select: { id: true } })
    if (!owned) return notFound('Lançamento não encontrado')
    await prisma.transaction.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao excluir transação' }, { status: 500 })
  }
}

// PATCH { paid }: marca o lançamento como pago/recebido ou em aberto
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('financeiro', 'edit')
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const { paid } = await request.json().catch(() => ({}))
    if (typeof paid !== 'boolean') return NextResponse.json({ error: 'Informe se o lançamento foi pago' }, { status: 400 })
    const owned = await prisma.transaction.findFirst({ where: { id, farmId: auth.farmId }, select: { id: true } })
    if (!owned) return notFound('Lançamento não encontrado')
    const transaction = await prisma.transaction.update({ where: { id }, data: { paid }, include: { animal: { select: { id: true, name: true, code: true } } } })
    return NextResponse.json(transaction)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar transação' }, { status: 500 })
  }
}
