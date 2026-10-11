import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const auth = await requireFarmAccess('leite', 'view')
  if (auth.error) return auth.error

  try {
    const animalId = request.nextUrl.searchParams.get('animalId')

    const productions = await prisma.milkProduction.findMany({
      where: { farmId: auth.farmId, ...(animalId ? { animalId } : {}) },
      include: { animal: true },
      orderBy: { date: 'desc' },
    })
    return NextResponse.json(productions)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar produção de leite' }, { status: 500 })
  }
}

// POST: um lançamento. Sem animalId, é o total do dia (sítio que não separa por vaca).
export async function POST(request: NextRequest) {
  const auth = await requireFarmAccess('leite', 'edit')
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { animalId, date, observations } = body
    const quantity = parseFloat(String(body.quantity ?? '').replace(',', '.'))
    const cowsMilked = parseInt(String(body.cowsMilked ?? ''), 10)

    if (!date || !(quantity > 0)) {
      return NextResponse.json({ error: 'Data e quantidade são obrigatórias' }, { status: 400 })
    }
    if (animalId) {
      const animal = await prisma.animal.findFirst({ where: { id: animalId, farmId: auth.farmId }, select: { id: true } })
      if (!animal) return notFound('Animal não encontrado')
    }

    const production = await prisma.milkProduction.create({
      data: {
        farmId: auth.farmId,
        animalId: animalId || null,
        date: new Date(date),
        quantity,
        cowsMilked: !animalId && cowsMilked > 0 ? cowsMilked : null,
        observations: observations || null,
      },
      include: { animal: true },
    })

    return NextResponse.json(production, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao registrar produção' }, { status: 500 })
  }
}
