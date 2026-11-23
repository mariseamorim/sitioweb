import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { requireFarmAccess } from '@/lib/auth'
import { animalCategory } from '@/lib/animalRules'
import { createAnimal } from '@/lib/animalCreate'

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
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Dados do animal inválidos' }, { status: 400 })
  // Regras do cadastro em src/lib/animalCreate.ts (as mesmas do veterinário)
  const result = await createAnimal(auth.farmId, body)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json(result.animal, { status: 201 })
}
