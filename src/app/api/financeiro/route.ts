import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { canAccessModule, notFound, requireFarmAccess } from '@/lib/auth'
import { parseStockEntry } from '@/lib/stockFinance'

export async function GET(request: NextRequest) {
  const auth = await requireFarmAccess('financeiro', 'view')
  if (auth.error) return auth.error
  const farmId = auth.farmId

  try {
    const from = request.nextUrl.searchParams.get('from')
    const to = request.nextUrl.searchParams.get('to')

    const transactions = await prisma.transaction.findMany({
      where: {
        farmId,
        ...(from || to ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to + 'T23:59:59Z') } : {}), // Z: datas gravadas em UTC, independente do fuso do servidor
          },
        } : {}),
      },
      include: { animal: { select: { id: true, name: true, code: true } }, lot: { select: { id: true, name: true } } },
      orderBy: { date: 'desc' },
    })

    return NextResponse.json(transactions)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar transações' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireFarmAccess('financeiro', 'edit')
  if (auth.error) return auth.error
  const farmId = auth.farmId

  try {
    const body = await request.json()
    const { type, category, date, amount, description } = body
    // Despesa não tem animal; só a receita (venda de animal) pode ter
    const animalId = type === 'Receita' ? body.animalId : null

    if (!type || !category || !date || !amount) {
      return NextResponse.json({ error: 'Campos obrigatórios faltando' }, { status: 400 })
    }

    // Despesa de um lote de recria/engorda (entra no desempenho do lote)
    const lotId = type === 'Despesa' && typeof body.lotId === 'string' && body.lotId ? body.lotId : null
    if (lotId && !(await prisma.lot.count({ where: { id: lotId, farmId } }))) return notFound('Lote não encontrado')

    if (animalId) {
      const animal = await prisma.animal.findFirst({ where: { id: animalId, farmId }, select: { id: true } })
      if (!animal) return notFound('Animal não encontrado')
    }

    // Despesa com "Dar entrada no estoque": a entrada nasce junto, ligada à despesa
    const stock = type === 'Despesa' ? parseStockEntry(body.stock) : null
    if (stock === 'invalid') return NextResponse.json({ error: 'Escolha o item do estoque e a quantidade' }, { status: 400 })
    if (stock && !canAccessModule(auth.user, 'estoque')) return NextResponse.json({ error: 'Você não tem permissão no Estoque para dar a entrada' }, { status: 403 })
    const supply = stock ? await prisma.supply.findFirst({ where: { id: stock.supplyId, farmId }, select: { id: true } }) : null
    if (stock && !supply) return notFound('Item do estoque não encontrado')

    // Compra de uma entrada de estoque já salva (o estoque oferece "Lançar a compra no financeiro" depois de salvar)
    const linkId = type === 'Despesa' && !stock && typeof body.supplyMovementId === 'string' ? body.supplyMovementId : null
    if (linkId) {
      const entry = await prisma.supplyMovement.findFirst({ where: { id: linkId, type: 'Entrada', supply: { farmId } }, select: { transaction: { select: { id: true } } } })
      if (!entry) return notFound('Entrada do estoque não encontrada')
      if (entry.transaction) return NextResponse.json({ error: 'Esta entrada já tem a compra lançada no financeiro' }, { status: 409 })
    }

    const transaction = await prisma.$transaction(async (tx) => {
      const movement = stock
        ? await tx.supplyMovement.create({ data: { supplyId: stock.supplyId, type: 'Entrada', quantity: stock.quantity, date: new Date(date), description: description || 'Compra lançada no financeiro' } })
        : null
      if (stock) await tx.supply.update({ where: { id: stock.supplyId }, data: { currentQuantity: { increment: stock.quantity } } })
      return tx.transaction.create({
      data: {
        farmId,
        type,
        category,
        date: new Date(date),
        amount: parseFloat(amount),
        description: description || null,
        // Sem a informação (app antigo), conta como pago, como antes
        paid: body.paid !== false,
        animalId: animalId || null,
        lotId,
        supplyMovementId: movement?.id ?? linkId,
      },
      include: { animal: { select: { id: true, name: true, code: true } }, lot: { select: { id: true, name: true } } },
    })
    })

    return NextResponse.json(transaction, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Erro ao criar transação' }, { status: 500 })
  }
}
