import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'

/** Campos da cobertura: cio, inseminação ou monta natural, sêmen e touro (todos opcionais) */
function coverageDetails(body: Record<string, unknown>) {
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  const method = body.method === 'ia' || body.method === 'natural' ? body.method : null
  const heat = typeof body.heatDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.heatDate) ? new Date(body.heatDate) : null
  return { method, heatDate: heat, semenBatch: method === 'natural' ? null : text(body.semenBatch, 60), bullRegistry: text(body.bullRegistry, 60) }
}

async function findOwned(id: string, farmId: string) {
  return prisma.reproduction.findFirst({ where: { id, farmId }, select: { id: true } })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('reproducao', 'edit')
  if (auth.error) return auth.error

  try {
    const { id } = await params
    if (!(await findOwned(id, auth.farmId))) return notFound()
    const body = await request.json()
    const { maleName, coverageDate, status, actualBirthDate, calfId, observations } = body

    const data: Record<string, unknown> = { status: status || undefined }
    if ('actualBirthDate' in body) data.actualBirthDate = actualBirthDate ? new Date(actualBirthDate) : null
    if ('calfId' in body) data.calfId = calfId || null
    if ('observations' in body) data.observations = observations || null

    if (maleName !== undefined) data.maleName = maleName || null
    if (['method', 'heatDate', 'semenBatch', 'bullRegistry'].some((k) => k in body)) Object.assign(data, coverageDetails(body))
    if (coverageDate) {
      const coverage = new Date(coverageDate)
      data.coverageDate = coverage
      const expected = new Date(coverage)
      expected.setDate(expected.getDate() + 280)
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
