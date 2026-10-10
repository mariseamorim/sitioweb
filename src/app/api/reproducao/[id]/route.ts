import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'

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

    const data: Record<string, unknown> = {
      status: status || undefined,
      actualBirthDate: actualBirthDate ? new Date(actualBirthDate) : null,
      calfId: calfId || null,
      observations: observations || null,
    }

    if (maleName !== undefined) data.maleName = maleName || null
    if (coverageDate) {
      const coverage = new Date(coverageDate)
      data.coverageDate = coverage
      const expected = new Date(coverage)
      expected.setDate(expected.getDate() + 280)
      data.expectedBirthDate = expected
    }

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
