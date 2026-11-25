import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'

/** Nome de quem aplicou ou cuida (opcional) */
const optionalText = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

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
    const { vaccineName, scheduledDate, appliedDate, batch, manufacturer, observations, appliedBy } = body

    const vaccination = await prisma.vaccination.update({
      where: { id },
      data: {
        vaccineName,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
        appliedDate: appliedDate ? new Date(appliedDate) : null,
        batch: batch || null,
        manufacturer: manufacturer || null,
        ...(appliedBy !== undefined ? { appliedBy: optionalText(appliedBy, 80) } : {}),
        observations: observations || null,
      },
      include: { animal: true },
    })

    return NextResponse.json(vaccination)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar vacinação' }, { status: 500 })
  }
}

// PATCH { appliedDate }: marca só a aplicação (a Agenda usa no botão "Aplicada"), sem mexer nos outros campos
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('vacinacao', 'edit')
  if (auth.error) return auth.error
  const { id } = await params
  if (!(await findOwned(id, auth.farmId))) return notFound('Vacinação não encontrada')
  const { appliedDate, appliedBy } = await request.json().catch(() => ({}))
  const date = typeof appliedDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(appliedDate) ? new Date(`${appliedDate.slice(0, 10)}T00:00:00.000Z`) : null
  if (appliedDate && !date) return NextResponse.json({ error: 'Data de aplicação inválida' }, { status: 400 })
  const vaccination = await prisma.vaccination.update({ where: { id }, data: { appliedDate: date, ...(appliedBy !== undefined ? { appliedBy: optionalText(appliedBy, 80) } : {}) }, include: { animal: true } })
  return NextResponse.json(vaccination)
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
