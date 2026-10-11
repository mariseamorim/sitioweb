import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'

async function findOwned(id: string, farmId: string) {
  return prisma.vaccination.findFirst({ where: { id, animal: { farmId } }, select: { id: true } })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('vacinacao', 'edit')
  if (auth.error) return auth.error

  try {
    const { id } = await params
    if (!(await findOwned(id, auth.farmId))) return notFound('Vacinação não encontrada')

    const body = await request.json()
    const { vaccineName, scheduledDate, appliedDate, batch, manufacturer, observations } = body

    const vaccination = await prisma.vaccination.update({
      where: { id },
      data: {
        vaccineName,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        appliedDate: appliedDate ? new Date(appliedDate) : null,
        batch: batch || null,
        manufacturer: manufacturer || null,
        observations: observations || null,
      },
      include: { animal: true },
    })

    return NextResponse.json(vaccination)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar vacinação' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('vacinacao', 'edit')
  if (auth.error) return auth.error

  try {
    const { id } = await params
    if (!(await findOwned(id, auth.farmId))) return notFound('Vacinação não encontrada')

    await prisma.vaccination.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao excluir vacinação' }, { status: 500 })
  }
}
