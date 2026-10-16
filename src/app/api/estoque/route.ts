import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { requireFarmAccess } from '@/lib/auth'
import { supplyDailyUse, withDailyUse } from '@/lib/lotUsage'

// Preço por unidade e peso do saco: opcionais (vazio apaga)
function optionalNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  const n = Number(String(value).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : undefined
}

export async function GET() {
  const auth = await requireFarmAccess('estoque', 'view')
  if (auth.error) return auth.error
  const farmId = auth.farmId

  try {
    const [supplies, use] = await Promise.all([
      prisma.supply.findMany({
        where: { farmId },
        include: { movements: { orderBy: { date: 'desc' }, take: 10 } },
        orderBy: { name: 'asc' },
      }),
      supplyDailyUse(farmId),
    ])
    // Consumo pelos lotes de recria/engorda: quanto sai por dia e em quantos dias acaba
    return NextResponse.json(supplies.map((s) => withDailyUse(s, use)))
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar estoque' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFarmAccess('estoque', 'edit')
  if (auth.error) return auth.error
  const farmId = auth.farmId

  try {
    const body = await request.json()
    const { name, category, unit, currentQuantity, minimumQuantity, unitPrice, packageKg } = body

    if (!name || !category || !unit) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    const supply = await prisma.supply.create({
      data: {
        farmId,
        name,
        category,
        unit,
        currentQuantity: parseFloat(currentQuantity) || 0,
        minimumQuantity: parseFloat(minimumQuantity) || 0,
        unitPrice: optionalNumber(unitPrice) ?? null,
        packageKg: optionalNumber(packageKg) ?? null,
      },
      include: { movements: true },
    })

    return NextResponse.json(supply, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar insumo' }, { status: 500 })
  }
}
