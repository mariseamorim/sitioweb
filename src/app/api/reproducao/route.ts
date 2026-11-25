import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'
import { canBreed } from '@/lib/animalRules'
import { GESTATION_DAYS, parseCoverageDetails } from '@/lib/coverage'
import { vetProfileOf } from '@/lib/vets'

const OPEN_STATUSES = ['Coberta', 'Prenha']

class NoDoseError extends Error {}

/** Campos da cobertura (todos opcionais): como foi, cio, sêmen, touro e inseminador */
function coverageDetails(body: Record<string, unknown>) {
  const { heatDate, ...rest } = parseCoverageDetails(body)
  return { ...rest, heatDate: heatDate ? new Date(heatDate) : null }
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
      select: { id: true, name: true, code: true, species: true, gender: true, birthDate: true, status: true, rearingStart: true, rearingEnd: true, lot: { select: { phase: true, endDate: true } } },
    })
    if (!female) return notFound('Animal não encontrado')
    // Novilha na recria (em lote ou acompanhada um a um) pode ser coberta mais cedo
    const inRearingLot = (female.lot?.phase === 'recria' && !female.lot.endDate) || (!!female.rearingStart && !female.rearingEnd)
    if (!canBreed(female, undefined, { inRearingLot })) {
      return NextResponse.json({ error: inRearingLot ? 'A novilha precisa ter pelo menos 13 meses' : 'A fêmea precisa estar viva e, se for bovina, ter pelo menos 2 anos' }, { status: 400 })
    }

    const coverage = new Date(coverageDate)
    // Só cobertura em andamento tem parto previsto ("Vazia" não gera aviso de parto)
    const expectedBirthDate = OPEN_STATUSES.includes(status || 'Coberta') ? new Date(coverage) : null
    expectedBirthDate?.setDate(expectedBirthDate.getDate() + GESTATION_DAYS)
    if (expectedBirthDate && typeof body.expectedBirthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.expectedBirthDate)) expectedBirthDate.setTime(Date.parse(body.expectedBirthDate))

    // Sêmen do estoque do veterinário: desconta 1 dose e preenche touro, raça e partida que não vieram no formulário
    const vetSupplyId = typeof body.vetSupplyId === 'string' && body.vetSupplyId ? body.vetSupplyId : null
    const vet = vetSupplyId ? await vetProfileOf(auth.user.id) : null
    const semen = vetSupplyId && vet ? await prisma.vetSupply.findFirst({ where: { id: vetSupplyId, vetId: vet.id, kind: 'semen' } }) : null
    if (vetSupplyId && !semen) return notFound('Sêmen não encontrado no seu estoque')
    const details = coverageDetails(body)
    if (semen) {
      details.bullBreed = details.bullBreed ?? semen.bullBreed
      details.semenBatch = details.semenBatch ?? semen.semenBatch
    }

    const reproduction = await prisma.$transaction(async (tx) => {
      if (semen) {
        // Só baixa se houver dose: a condição vai junto na atualização, para duas coberturas ao mesmo tempo não deixarem negativo
        const { count } = await tx.vetSupply.updateMany({ where: { id: semen.id, quantity: { gte: 1 } }, data: { quantity: { decrement: 1 } } })
        if (!count) throw new NoDoseError()
        const farm = await tx.farm.findUnique({ where: { id: auth.farmId }, select: { name: true } })
        await tx.vetSupplyMove.create({ data: { supplyId: semen.id, type: 'saida', quantity: 1, date: coverage, farmName: farm?.name ?? null, note: `Cobertura de ${female.name} (${female.code})` } })
      }
      return tx.reproduction.create({
      data: {
        femaleId,
        farmId: auth.farmId,
        createdById: auth.user.id,
        // Já anotada como prenha ou vazia: quem anotou também deu o diagnóstico
        ...(status === 'Prenha' || status === 'Vazia' ? { diagnosedById: auth.user.id, diagnosedAt: new Date() } : {}),
        maleName: maleName || semen?.bullName || semen?.name || null,
        ...details,
        coverageDate: coverage,
        expectedBirthDate,
        status: status || 'Coberta',
        observations: observations || null,
      },
      include: { female: true },
    })
    })

    return NextResponse.json(reproduction, { status: 201 })
  } catch (err) {
    if (err instanceof NoDoseError) return NextResponse.json({ error: 'Não há dose desse sêmen no seu estoque. Dê entrada em Meu estoque.' }, { status: 400 })
    return NextResponse.json({ error: 'Erro ao criar reprodução' }, { status: 500 })
  }
}
