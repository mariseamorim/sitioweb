import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'
import { supplyDailyUse, withDailyUse } from '@/lib/lotUsage'
import { parseMovement, signedQuantity } from '@/lib/stockMovements'

// POST: registra uma entrada ou saída e ajusta o saldo. Devolve o insumo já com o consumo dos lotes
// (dias até acabar), para a tela não precisar recarregar.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('estoque', 'edit')
  if (auth.error) return auth.error

  try {
    const { id: supplyId } = await params
    const owned = await prisma.supply.findFirst({ where: { id: supplyId, farmId: auth.farmId }, select: { id: true } })
    if (!owned) return notFound('Insumo não encontrado')
    const input = parseMovement(await request.json().catch(() => null))
    if (!input) return NextResponse.json({ error: 'Tipo, quantidade e data são obrigatórios' }, { status: 400 })

    const [movement, supply] = await prisma.$transaction([
      prisma.supplyMovement.create({
        data: { supplyId, type: input.type, quantity: input.quantity, date: new Date(input.date), description: input.description },
      }),
      prisma.supply.update({
        where: { id: supplyId },
        data: { currentQuantity: { increment: signedQuantity(input) } },
        include: { movements: { orderBy: { date: 'desc' }, take: 10 } },
      }),
    ])
    const use = await supplyDailyUse(auth.farmId)
    return NextResponse.json({ movement, supply: withDailyUse(supply, use) }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao registrar movimentação' }, { status: 500 })
  }
}
