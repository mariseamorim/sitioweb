import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'

async function findOwned(id: string, farmId: string) {
  return prisma.supply.findFirst({ where: { id, farmId }, select: { id: true } })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('estoque', 'edit')
  if (auth.error) return auth.error

  try {
    const { id } = await params
    if (!(await findOwned(id, auth.farmId))) return notFound('Insumo não encontrado')
    const body = await request.json()
    const { name, category, unit, minimumQuantity } = body

    const supply = await prisma.supply.update({
      where: { id },
      data: {
        name,
        category,
        unit,
        minimumQuantity: minimumQuantity !== undefined ? parseFloat(minimumQuantity) : undefined,
      },
      include: { movements: { orderBy: { date: 'desc' }, take: 10 } },
    })

    return NextResponse.json(supply)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar insumo' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('estoque', 'edit')
  if (auth.error) return auth.error

  try {
    const { id } = await params
    if (!(await findOwned(id, auth.farmId))) return notFound('Insumo não encontrado')
    await prisma.supply.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao excluir insumo' }, { status: 500 })
  }
}
