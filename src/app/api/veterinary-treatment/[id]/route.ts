import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'
import { parseWithdrawalDays } from '@/lib/withdrawal'

async function findOwned(id: string, farmId: string) {
  return prisma.veterinaryTreatment.findFirst({
    where: { id, animal: { farmId } },
    include: { animal: true },
  })
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('veterinario', 'view')
  if (auth.error) return auth.error

  const { id } = await params
  const treatment = await findOwned(id, auth.farmId)
  if (!treatment) return notFound('Tratamento não encontrado')
  return NextResponse.json(treatment)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('veterinario', 'edit')
  if (auth.error) return auth.error

  try {
    const { id } = await params
    if (!(await findOwned(id, auth.farmId))) return notFound('Tratamento não encontrado')

    const body = await request.json()
    const { startDate, endDate, medicine, batch, manufacturer, description, observations } = body
    const milkWithdrawalDays = parseWithdrawalDays(body.milkWithdrawalDays)
    const meatWithdrawalDays = parseWithdrawalDays(body.meatWithdrawalDays)
    if (milkWithdrawalDays === 'invalid' || meatWithdrawalDays === 'invalid') {
      return NextResponse.json({ error: 'A carência deve ser em dias, de 0 a 365' }, { status: 400 })
    }

    const treatment = await prisma.veterinaryTreatment.update({
      where: { id },
      data: {
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        medicine,
        ...('milkWithdrawalDays' in body && { milkWithdrawalDays }),
        ...('meatWithdrawalDays' in body && { meatWithdrawalDays }),
        batch,
        manufacturer,
        description,
        observations,
      },
      include: { animal: true },
    })

    return NextResponse.json(treatment)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar tratamento' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('veterinario', 'edit')
  if (auth.error) return auth.error

  try {
    const { id } = await params
    if (!(await findOwned(id, auth.farmId))) return notFound('Tratamento não encontrado')

    await prisma.veterinaryTreatment.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao excluir tratamento' }, { status: 500 })
  }
}
