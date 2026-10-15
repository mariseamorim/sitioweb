import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { requireFarmAccess } from '@/lib/auth'
import { supplyDailyUse, withDailyUse } from '@/lib/lotUsage'

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
    const { name, category, unit, currentQuantity, minimumQuantity } = body

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
      },
      include: { movements: true },
    })

    return NextResponse.json(supply, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar insumo' }, { status: 500 })
  }
}
