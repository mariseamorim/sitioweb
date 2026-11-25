import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessModule, notFound, requireFarmAccess } from '@/lib/auth'
import { expenseCategoryFor, parsePurchase, purchaseDescription } from '@/lib/stockFinance'
import { supplyDailyUse, withDailyUse } from '@/lib/lotUsage'
import { parseMovement, signedQuantity } from '@/lib/stockMovements'

// POST: registra uma entrada ou saída e ajusta o saldo. Com { purchase: { amount, paid } } numa entrada, lança a compra
// no financeiro junto. Devolve o insumo já com o consumo dos lotes
// (dias até acabar), para a tela não precisar recarregar.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('estoque', 'edit')
  if (auth.error) return auth.error

  try {
    const { id: supplyId } = await params
    const owned = await prisma.supply.findFirst({ where: { id: supplyId, farmId: auth.farmId }, select: { id: true, name: true, unit: true, category: true } })
    if (!owned) return notFound('Insumo não encontrado')
    const body = await request.json().catch(() => null)
    const input = parseMovement(body)
    if (!input) return NextResponse.json({ error: 'Tipo, quantidade e data são obrigatórios' }, { status: 400 })
    // Entrada com "Lançar a compra no financeiro": a despesa nasce junto, ligada à entrada
    const purchase = input.type === 'Entrada' ? parsePurchase(body?.purchase) : null
    if (purchase === 'invalid') return NextResponse.json({ error: 'Informe o valor da compra' }, { status: 400 })
    if (purchase && !canAccessModule(auth.user, 'financeiro')) return NextResponse.json({ error: 'Você não tem permissão no Financeiro para lançar a compra' }, { status: 403 })

    const { movement, supply } = await prisma.$transaction(async (tx) => {
      const movement = await tx.supplyMovement.create({
        data: { supplyId, type: input.type, quantity: input.quantity, date: new Date(input.date), description: input.description },
      })
      const supply = await tx.supply.update({
        where: { id: supplyId },
        data: { currentQuantity: { increment: signedQuantity(input) } },
        include: { movements: { orderBy: { date: 'desc' }, take: 10 } },
      })
      if (purchase) {
        await tx.transaction.create({
          data: {
            farmId: auth.farmId, type: 'Despesa', category: expenseCategoryFor(owned.category), date: new Date(input.date),
            amount: purchase.amount, paid: purchase.paid, description: input.description || purchaseDescription(owned.name, input.quantity, owned.unit),
            supplyMovementId: movement.id,
          },
        })
      }
      return { movement, supply }
    })
    const use = await supplyDailyUse(auth.farmId)
    return NextResponse.json({ movement, supply: withDailyUse(supply, use) }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao registrar movimentação' }, { status: 500 })
  }
}
