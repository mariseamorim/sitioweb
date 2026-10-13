import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'
import { canBreed } from '@/lib/animalRules'

const OPEN_STATUSES = ['Coberta', 'Prenha']

export async function GET() {
  const auth = await requireFarmAccess('reproducao', 'view')
  if (auth.error) return auth.error

  try {
    const reproductions = await prisma.reproduction.findMany({
      where: { farmId: auth.farmId },
      include: { female: true },
      orderBy: { coverageDate: 'desc' },
    })

    return NextResponse.json(reproductions)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar reproduções' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFarmAccess('reproducao', 'edit')
  if (auth.error) return auth.error

  try {
    const body = await request.json()
    const { femaleId, maleName, coverageDate, status, observations } = body

    if (!femaleId || !coverageDate) {
      return NextResponse.json({ error: 'Fêmea e data de cobertura são obrigatórios' }, { status: 400 })
    }
    const female = await prisma.animal.findFirst({
      where: { id: femaleId, farmId: auth.farmId },
      select: { id: true, species: true, gender: true, birthDate: true, status: true },
    })
    if (!female) return notFound('Animal não encontrado')
    if (!canBreed(female)) {
      return NextResponse.json({ error: 'A fêmea precisa estar viva e, se for bovina, ter pelo menos 2 anos' }, { status: 400 })
    }

    const coverage = new Date(coverageDate)
    // Só cobertura em andamento tem parto previsto ("Vazia" não gera aviso de parto)
    const expectedBirthDate = OPEN_STATUSES.includes(status || 'Coberta') ? new Date(coverage) : null
    expectedBirthDate?.setDate(expectedBirthDate.getDate() + 280)

    const reproduction = await prisma.reproduction.create({
      data: {
        femaleId,
        farmId: auth.farmId,
        maleName: maleName || null,
        coverageDate: coverage,
        expectedBirthDate,
        status: status || 'Coberta',
        observations: observations || null,
      },
      include: { female: true },
    })

    return NextResponse.json(reproduction, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar reprodução' }, { status: 500 })
  }
}
