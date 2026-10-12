import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'
import { milkDay, milkNumber, milkPrice } from '@/lib/milkValidation'

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
    const existing = await findOwned(id, auth.farmId)
    if (!existing) return notFound()

    const body = await request.json()
    const { date, observations } = body
    const day = date === undefined ? undefined : milkDay(date)
    const quantity = body.quantity === undefined ? undefined : milkNumber(body.quantity)
    const pricePerLiter = body.pricePerLiter === undefined ? undefined : milkPrice(body.pricePerLiter)
    const cowsMilked = body.cowsMilked === undefined ? undefined : body.cowsMilked === null || body.cowsMilked === '' ? null : milkNumber(body.cowsMilked)
    if (day === null || (quantity !== undefined && (!Number.isFinite(quantity) || quantity <= 0))) return NextResponse.json({ error: 'Informe data e quantidade válidas' }, { status: 400 })
    if ('pricePerLiter' in body && pricePerLiter === undefined) return NextResponse.json({ error: 'Preço por litro inválido' }, { status: 400 })
    if (cowsMilked !== undefined && cowsMilked !== null && (!Number.isInteger(cowsMilked) || cowsMilked <= 0)) return NextResponse.json({ error: 'Informe um número inteiro de vacas ordenhadas' }, { status: 400 })
    if (observations !== undefined && observations !== null && typeof observations !== 'string') return NextResponse.json({ error: 'Observações inválidas' }, { status: 400 })
    if (existing.source === 'lite' && day && day.getTime() !== existing.date.getTime()) {
      const duplicate = await prisma.milkProduction.findFirst({ where: { farmId: auth.farmId, source: 'lite', date: day, id: { not: id } } })
      if (duplicate) return NextResponse.json({ error: 'Já existe uma anotação do Anota Aí Leite nesta data' }, { status: 409 })
    }

    const production = await prisma.milkProduction.update({
      where: { id },
      data: {
        date: day,
        quantity,
        pricePerLiter,
        cowsMilked: existing.animalId ? null : cowsMilked,
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
