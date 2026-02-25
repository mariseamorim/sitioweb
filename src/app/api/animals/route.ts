import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const farmId = request.nextUrl.searchParams.get('farmId')
  if (!farmId) return NextResponse.json({ error: 'farmId required' }, { status: 400 })

  const animals = await prisma.animal.findMany({
    where: { farmId },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(animals)
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { farmId, code, name, species, gender, birthDate, status, gta, observations, imageUrl } = body

  if (!farmId || !name || !species || !gender || !birthDate || !status) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }

  async function getNextCode(fid: string) {
    const existing = await prisma.animal.findMany({
      where: { farmId: fid },
      select: { code: true },
    })
    const maxNum = existing.reduce((acc: number, item: { code: string }) => {
      const n = Number.parseInt(item.code, 10)
      return Number.isFinite(n) && n > acc ? n : acc
    }, 0)
    const next = maxNum + 1
    return String(next).padStart(2, '0')
  }

  try {
    const animal = await prisma.animal.create({
      data: {
        farmId,
        code: code || await getNextCode(farmId),
        name,
        species,
        gender,
        birthDate: new Date(birthDate),
        status,
        gta: gta || null,
        observations: observations || null,
        imageUrl: imageUrl || null,
      },
    })
    return NextResponse.json(animal, { status: 201 })
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um animal com esse código nessa fazenda' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao criar animal' }, { status: 500 })
  }
}
