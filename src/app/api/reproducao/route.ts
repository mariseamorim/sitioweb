import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const farmId = request.nextUrl.searchParams.get('farmId')
    if (!farmId) return NextResponse.json({ error: 'farmId obrigatório' }, { status: 400 })

    const reproductions = await prisma.reproduction.findMany({
      where: { farmId },
      include: { female: true },
      orderBy: { coverageDate: 'desc' },
    })

    return NextResponse.json(reproductions)
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao buscar reproduções' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { femaleId, farmId, maleName, coverageDate, status, observations } = body

    if (!femaleId || !farmId || !coverageDate) {
      return NextResponse.json({ error: 'Fêmea, fazenda e data de cobertura são obrigatórios' }, { status: 400 })
    }

    const coverage = new Date(coverageDate)
    const expectedBirthDate = new Date(coverage)
    expectedBirthDate.setDate(expectedBirthDate.getDate() + 280)

    const reproduction = await prisma.reproduction.create({
      data: {
        femaleId,
        farmId,
        maleName: maleName || null,
        coverageDate: coverage,
        expectedBirthDate,
        status: status || 'Coberta',
        observations: observations || null,
      },
      include: { female: true },
    })

    return NextResponse.json(reproduction, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Erro ao criar reprodução' }, { status: 500 })
  }
}
