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
