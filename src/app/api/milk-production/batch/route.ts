import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { requireFarmAccess } from '@/lib/auth'

interface BatchItem {
  animalId: string
  quantity: number | string
  observations?: string
}

// POST: lança a ordenha do dia de várias vacas de uma vez
export async function POST(request: NextRequest) {
  const auth = await requireFarmAccess('leite', 'edit')
  if (auth.error) return auth.error

  const { date, items } = (await request.json()) as { date?: string; items?: BatchItem[] }

  if (!date || !Array.isArray(items)) {
    return NextResponse.json({ error: 'Data e lista de vacas são obrigatórias' }, { status: 400 })
  }

  const entries = items
    .map((i) => ({ animalId: i.animalId, quantity: parseFloat(String(i.quantity).replace(',', '.')), observations: i.observations || null }))
    .filter((i) => i.animalId && i.quantity > 0)

  if (entries.length === 0) {
    return NextResponse.json({ error: 'Informe a quantidade de pelo menos uma vaca' }, { status: 400 })
  }

  const ids = [...new Set(entries.map((e) => e.animalId))]
  const owned = await prisma.animal.count({ where: { id: { in: ids }, farmId: auth.farmId } })
  if (owned !== ids.length) {
    return NextResponse.json({ error: 'Há vacas que não pertencem a esta propriedade' }, { status: 400 })
  }

  try {
    const day = new Date(date)
    const result = await prisma.milkProduction.createMany({
      data: entries.map((e) => ({ ...e, farmId: auth.farmId, date: day })),
    })
    return NextResponse.json({ created: result.count }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao salvar a ordenha' }, { status: 500 })
  }
}
