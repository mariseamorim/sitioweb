import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
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
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao atualizar reprodução' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    await prisma.reproduction.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao excluir reprodução' }, { status: 500 })
  }
}
