import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canEdit } from '@/lib/auth'
import { createClientFarm, requireVet } from '@/lib/vets'
import { createAnimal } from '@/lib/animalCreate'
import { animalCategory } from '@/lib/animalRules'

// Animais de todas as propriedades que o veterinário atende.
// GET: a lista, cada animal com a fazenda dele (a tela filtra por fazenda e busca por nome/código).
// POST { farmId | newFarmName, ...animal }: cadastra o animal numa fazenda atendida ou, com newFarmName,
// numa fazenda que ainda não está no sistema (ela é criada como propriedade de cliente do veterinário).

async function activeLinks(vetId: string) {
  return prisma.vetClient.findMany({
    where: { vetId, status: 'ativo', farm: { isActive: true } },
    select: { farmId: true, farm: { select: { name: true } } },
  })
}

export async function GET() {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const links = await activeLinks(auth.vet.id)
  const names = new Map(links.map((l) => [l.farmId!, l.farm!.name]))
  const animals = await prisma.animal.findMany({
    where: { farmId: { in: [...names.keys()] } },
    select: { id: true, code: true, customCode: true, name: true, species: true, gender: true, birthDate: true, status: true, breed: true, isCastrated: true, acquisitionType: true, farmId: true },
    orderBy: [{ name: 'asc' }],
  })
  return NextResponse.json(animals.map((a) => ({ ...a, species: animalCategory(a), farmName: names.get(a.farmId) ?? '' })))
}

export async function POST(request: NextRequest) {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const { user, vet } = auth
  if (!canEdit(user)) return NextResponse.json({ error: 'Você não tem permissão para esta ação' }, { status: 403 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Dados do animal inválidos' }, { status: 400 })

  const newFarmName = typeof body.newFarmName === 'string' ? body.newFarmName.trim() : ''
  let farmId = typeof body.farmId === 'string' ? body.farmId : ''
  if (!newFarmName) {
    const links = await activeLinks(vet.id)
    if (!farmId || !links.some((l) => l.farmId === farmId)) return NextResponse.json({ error: 'Escolha a fazenda do animal' }, { status: 400 })
  }

  // Valida o animal antes de criar a fazenda nova (para não deixar fazenda vazia por um erro no formulário)
  if (!body.name || !body.species || !body.gender || !body.birthDate || !body.status) return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
  if (newFarmName) {
    if (newFarmName.length > 120) return NextResponse.json({ error: 'Nome da fazenda muito longo' }, { status: 400 })
    const link = await createClientFarm(user, vet.id, { name: newFarmName })
    farmId = link.farmId!
  }
  const result = await createAnimal(farmId, body)
  if ('error' in result) return NextResponse.json({ error: result.error, ...(newFarmName ? { farmCreated: farmId } : {}) }, { status: result.status })
  return NextResponse.json({ ...result.animal, farmName: newFarmName || undefined, farmCreated: newFarmName ? farmId : undefined }, { status: 201 })
}
