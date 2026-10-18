import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'
import { supplyDailyUse, withDailyUse } from '@/lib/lotUsage'
import { movementDelta, parseMovement } from '@/lib/stockMovements'

// Uma movimentação já registrada: a tela salva sozinha enquanto a pessoa preenche, então o que foi
// criado pode ser corrigido (PATCH) ou desfeito (DELETE) logo em seguida, com o saldo acompanhando.
// Saídas geradas pelo trato dos lotes não passam por aqui (apagar o trato devolve ao estoque).

type Params = { params: Promise<{ id: string; movId: string }> }

async function findMovement(supplyId: string, movId: string, farmId: string) {
  return prisma.supplyMovement.findFirst({
    where: { id: movId, supplyId, supply: { farmId } },
    select: { id: true, type: true, quantity: true, feeding: { select: { id: true } } },
  })
}

const supplyInclude = { movements: { orderBy: { date: 'desc' as const }, take: 10 } }

export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireFarmAccess('estoque', 'edit')
  if (auth.error) return auth.error

  try {
    const { id: supplyId, movId } = await params
    const current = await findMovement(supplyId, movId, auth.farmId)
    if (!current) return notFound('Movimentação não encontrada')
    if (current.feeding) return NextResponse.json({ error: 'Esta saída veio do trato de um lote e é alterada por lá' }, { status: 409 })
    const input = parseMovement(await request.json().catch(() => null))
    if (!input) return NextResponse.json({ error: 'Tipo, quantidade e data são obrigatórios' }, { status: 400 })

    const [movement, supply] = await prisma.$transaction([
      prisma.supplyMovement.update({
        where: { id: movId },
        data: { type: input.type, quantity: input.quantity, date: new Date(input.date), description: input.description },
      }),
      prisma.supply.update({
        where: { id: supplyId },
        data: { currentQuantity: { increment: movementDelta(current, input) } },
        include: supplyInclude,
      }),
    ])
    const use = await supplyDailyUse(auth.farmId)
    return NextResponse.json({ movement, supply: withDailyUse(supply, use) })
  } catch {
    return NextResponse.json({ error: 'Erro ao alterar movimentação' }, { status: 500 })
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  const auth = await requireFarmAccess('estoque', 'edit')
  if (auth.error) return auth.error

  try {
    const { id: supplyId, movId } = await params
    const current = await findMovement(supplyId, movId, auth.farmId)
    if (!current) return notFound('Movimentação não encontrada')
    if (current.feeding) return NextResponse.json({ error: 'Esta saída veio do trato de um lote e é apagada por lá' }, { status: 409 })

    const [, supply] = await prisma.$transaction([
      prisma.supplyMovement.delete({ where: { id: movId } }),
      prisma.supply.update({
        where: { id: supplyId },
        data: { currentQuantity: { increment: movementDelta(current, null) } },
        include: supplyInclude,
      }),
    ])
    const use = await supplyDailyUse(auth.farmId)
    return NextResponse.json({ supply: withDailyUse(supply, use) })
  } catch {
    return NextResponse.json({ error: 'Erro ao desfazer movimentação' }, { status: 500 })
  }
}
