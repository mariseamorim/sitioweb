import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'

async function findOwned(id: string, farmId: string) {
  return prisma.milkProduction.findFirst({
    where: { id, farmId },
    include: { animal: true },
  })
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('leite', 'view')
  if (auth.error) return auth.error

  const { id } = await params
  const production = await findOwned(id, auth.farmId)
  if (!production) return notFound()
  return NextResponse.json(production)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('leite', 'edit')
  if (auth.error) return auth.error

  try {
    const { id } = await params
    if (!(await findOwned(id, auth.farmId))) return notFound()

    const body = await request.json()
    const { date, quantity, observations } = body

    const production = await prisma.milkProduction.update({
      where: { id },
      data: {
        date: date ? new Date(date) : undefined,
        quantity: quantity ? parseFloat(quantity) : undefined,
        observations,
      },
      include: { animal: true },
    })

    return NextResponse.json(production)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar produção' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('leite', 'edit')
  if (auth.error) return auth.error

  try {
    const { id } = await params
    if (!(await findOwned(id, auth.farmId))) return notFound()

    await prisma.milkProduction.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao excluir produção' }, { status: 500 })
  }
}
