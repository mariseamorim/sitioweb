import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { requireFarmAccess } from '@/lib/auth'
import { milkDay, milkNumber, milkPrice } from '@/lib/milkValidation'

interface BatchItem {
  animalId: string
  quantity: number | string
  observations?: string
}

// POST: lança a ordenha do dia de várias vacas de uma vez
export async function POST(request: NextRequest) {
  const auth = await requireFarmAccess('leite', 'edit')
  if (auth.error) return auth.error

  const { date, items, pricePerLiter: rawPrice } = (await request.json()) as { date?: string; items?: BatchItem[]; pricePerLiter?: unknown }
  const day = milkDay(date)

  if (!day || !Array.isArray(items)) {
    return NextResponse.json({ error: 'Data e lista de vacas são obrigatórias' }, { status: 400 })
  }
  if (items.some(i => !i || typeof i.animalId !== 'string' || !i.animalId || !Number.isFinite(milkNumber(i.quantity)) || milkNumber(i.quantity) <= 0)) return NextResponse.json({ error: 'Informe vacas e quantidades válidas' }, { status: 400 })
  const farm = rawPrice === undefined ? await prisma.farm.findUnique({ where: { id: auth.farmId }, select: { milkPrice: true } }) : null
  const pricePerLiter = milkPrice(rawPrice === undefined ? farm?.milkPrice ?? null : rawPrice)
  if (pricePerLiter === undefined) return NextResponse.json({ error: 'Preço por litro inválido' }, { status: 400 })

  const entries = items
    .map((i) => ({ animalId: i.animalId, quantity: milkNumber(i.quantity), observations: i.observations || null }))
    .filter((i) => i.animalId && Number.isFinite(i.quantity) && i.quantity > 0)

  if (entries.length === 0) {
    return NextResponse.json({ error: 'Informe a quantidade de pelo menos uma vaca' }, { status: 400 })
  }

  const ids = [...new Set(entries.map((e) => e.animalId))]
  const owned = await prisma.animal.count({ where: { id: { in: ids }, farmId: auth.farmId } })
  if (owned !== ids.length) {
    return NextResponse.json({ error: 'Há vacas que não pertencem a esta propriedade' }, { status: 400 })
  }

  try {
    const result = await prisma.milkProduction.createMany({
      data: entries.map((e) => ({ ...e, farmId: auth.farmId, date: day, pricePerLiter })),
    })
    return NextResponse.json({ created: result.count }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao salvar a ordenha' }, { status: 500 })
  }
}
