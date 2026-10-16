import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'
import { canBreed } from '@/lib/animalRules'

const OPEN_STATUSES = ['Coberta', 'Prenha']

/** Campos da cobertura: cio, inseminação ou monta natural, sêmen e touro (todos opcionais) */
function coverageDetails(body: Record<string, unknown>) {
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  const method = body.method === 'ia' || body.method === 'natural' ? body.method : null
  const heat = typeof body.heatDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.heatDate) ? new Date(body.heatDate) : null
  return { method, heatDate: heat, semenBatch: method === 'natural' ? null : text(body.semenBatch, 60), bullRegistry: text(body.bullRegistry, 60) }
}

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
      select: { id: true, species: true, gender: true, birthDate: true, status: true, lot: { select: { phase: true, endDate: true } } },
    })
    if (!female) return notFound('Animal não encontrado')
    const inRearingLot = female.lot?.phase === 'recria' && !female.lot.endDate
    if (!canBreed(female, undefined, { inRearingLot })) {
      return NextResponse.json({ error: inRearingLot ? 'A novilha precisa ter pelo menos 13 meses' : 'A fêmea precisa estar viva e, se for bovina, ter pelo menos 2 anos' }, { status: 400 })
    }

    const coverage = new Date(coverageDate)
    // Só cobertura em andamento tem parto previsto ("Vazia" não gera aviso de parto)
    const expectedBirthDate = OPEN_STATUSES.includes(status || 'Coberta') ? new Date(coverage) : null
    expectedBirthDate?.setDate(expectedBirthDate.getDate() + 280)
    if (expectedBirthDate && typeof body.expectedBirthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.expectedBirthDate)) expectedBirthDate.setTime(Date.parse(body.expectedBirthDate))

    const reproduction = await prisma.reproduction.create({
      data: {
        femaleId,
        farmId: auth.farmId,
        maleName: maleName || null,
        ...coverageDetails(body),
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
