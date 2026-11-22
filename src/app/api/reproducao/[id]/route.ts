import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'
import { GESTATION_DAYS, parseCoverageDetails } from '@/lib/coverage'

/** Campos da cobertura (todos opcionais): como foi, cio, sêmen, touro e inseminador */
function coverageDetails(body: Record<string, unknown>) {
  const { heatDate, ...rest } = parseCoverageDetails(body)
  return { ...rest, heatDate: heatDate ? new Date(heatDate) : null }
}

async function findOwned(id: string, farmId: string) {
  return prisma.reproduction.findFirst({ where: { id, farmId }, select: { id: true, status: true } })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('reproducao', 'edit')
  if (auth.error) return auth.error

  try {
    const { id } = await params
    const existing = await findOwned(id, auth.farmId)
    if (!existing) return notFound()
    const body = await request.json()
    const { maleName, coverageDate, status, actualBirthDate, calfId, observations } = body

    const data: Record<string, unknown> = { status: status || undefined }
    // Diagnóstico de gestação: guarda quem deu e quando (o veterinário leva isso com ele se o vínculo acabar)
    if ((status === 'Prenha' || status === 'Vazia') && status !== existing.status) Object.assign(data, { diagnosedById: auth.user.id, diagnosedAt: new Date() })
    if ('actualBirthDate' in body) data.actualBirthDate = actualBirthDate ? new Date(actualBirthDate) : null
    if ('calfId' in body) data.calfId = calfId || null
    if ('observations' in body) data.observations = observations || null

    if (maleName !== undefined) data.maleName = maleName || null
    if (['method', 'heatDate', 'semenBatch', 'bullRegistry', 'bullBreed', 'inseminator'].some((k) => k in body)) Object.assign(data, coverageDetails(body))
    if (coverageDate) {
      const coverage = new Date(coverageDate)
      data.coverageDate = coverage
      const expected = new Date(coverage)
      expected.setDate(expected.getDate() + GESTATION_DAYS)
      data.expectedBirthDate = expected
    }
    if (typeof body.expectedBirthDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.expectedBirthDate)) data.expectedBirthDate = new Date(body.expectedBirthDate)
    // Confirmada vazia ou perdida: deixa de ter parto previsto (não gera aviso de parto)
    if (status === 'Vazia' || status === 'Perdida') data.expectedBirthDate = null

    const reproduction = await prisma.reproduction.update({
      where: { id },
      data,
      include: { female: true },
    })

    return NextResponse.json(reproduction)
  } catch {
    return NextResponse.json({ error: 'Erro ao atualizar reprodução' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('reproducao', 'edit')
  if (auth.error) return auth.error

  try {
    const { id } = await params
    if (!(await findOwned(id, auth.farmId))) return notFound()
    await prisma.reproduction.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Erro ao excluir reprodução' }, { status: 500 })
  }
}
