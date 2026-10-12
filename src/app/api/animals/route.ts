import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { requireFarmAccess } from '@/lib/auth'
import { closeOpenPregnancy, findValidMother } from '@/lib/calves'
import { animalCategory, animalRuleError } from '@/lib/animalRules'

export async function GET() {
  const auth = await requireFarmAccess('animais', 'view')
  if (auth.error) return auth.error

  const animals = await prisma.animal.findMany({
    where: { farmId: auth.farmId },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(animals.map(animal => ({ ...animal, species: animalCategory(animal) })))
}

export async function POST(request: NextRequest) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const farmId = auth.farmId

  const body = await request.json()
  const { code, name, species, gender, birthDate, status, gta, observations, imageUrl, motherId, isCastrated = false, acquisitionType = 'nascimento' } = body

  if (!name || !species || !gender || !birthDate || !status) {
    return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  }
  if (typeof species !== 'string' || typeof gender !== 'string' || typeof birthDate !== 'string' || typeof isCastrated !== 'boolean' || typeof acquisitionType !== 'string') return NextResponse.json({ error: 'Dados do animal inválidos' }, { status: 400 })
  const classification = { species, gender, birthDate, isCastrated, acquisitionType }
  const ruleError = animalRuleError(classification)
  if (ruleError) return NextResponse.json({ error: ruleError }, { status: 400 })
  // Cria registrada a partir da vaca
  if (motherId && !(await findValidMother(String(motherId), farmId))) {
    return NextResponse.json({ error: 'A mãe deve ser uma fêmea bovina da propriedade com pelo menos 2 anos e meio' }, { status: 400 })
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
        species: animalCategory(classification),
        gender,
        birthDate: new Date(birthDate),
        isCastrated,
        acquisitionType,
        status,
        gta: gta || null,
        observations: observations || null,
        imageUrl: imageUrl || null,
        motherId: motherId || null,
      },
    })
    if (animal.motherId) await closeOpenPregnancy(animal.motherId, animal.id, animal.birthDate)
    return NextResponse.json(animal, { status: 201 })
  } catch (error: unknown) {
    if ((error as { code?: string }).code === 'P2002') {
      return NextResponse.json({ error: 'Já existe um animal com esse código nessa fazenda' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Erro ao criar animal' }, { status: 500 })
  }
}
