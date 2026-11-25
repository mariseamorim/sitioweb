import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAccessModule, requireFarmAccess } from '@/lib/auth'
import { animalToday } from '@/lib/animalRules'
import { lastMonths, milkResultByMonth, spendingAlerts } from '@/lib/milkResult'
import { stockKg } from '@/lib/lots'

// GET: resultado do leite dos últimos 12 meses (receita, custo e sobra por litro) e os gastos acima do normal no mês.
// Regra em src/lib/milkResult.ts.
export async function GET() {
  const auth = await requireFarmAccess('financeiro', 'view')
  if (auth.error) return auth.error
  const today = animalToday()
  const months = lastMonths(today, 12)
  const from = new Date(`${months[0]}-01T00:00:00.000Z`)
  const [transactions, milk, feedOut] = await Promise.all([
    prisma.transaction.findMany({ where: { farmId: auth.farmId, date: { gte: from } }, select: { type: true, category: true, date: true, amount: true, lotId: true } }),
    canAccessModule(auth.user, 'leite')
      ? prisma.milkProduction.findMany({ where: { farmId: auth.farmId, date: { gte: from } }, select: { date: true, quantity: true, pricePerLiter: true } })
      : [],
    // Ração e sal que saíram do estoque (sem o trato dos lotes de recria/engorda), para a conversão alimentar
    canAccessModule(auth.user, 'estoque')
      ? prisma.supplyMovement.findMany({
          where: { type: 'Saída', date: { gte: from }, feeding: null, supply: { farmId: auth.farmId, category: { in: ['Ração', 'Sal mineral'] } } },
          select: { date: true, quantity: true, supply: { select: { unit: true, packageKg: true } } },
        })
      : [],
  ])
  const feed = feedOut.flatMap((m) => { const kg = stockKg({ ...m.supply, currentQuantity: m.quantity }); return kg ? [{ date: m.date.toISOString().slice(0, 10), kg }] : [] })
  const tx = transactions.map((t) => ({ ...t, date: t.date.toISOString().slice(0, 10) }))
  const result = milkResultByMonth(tx, milk.map((m) => ({ ...m, date: m.date.toISOString().slice(0, 10) })), months, feed)
  return NextResponse.json({ today, months: result, hasMilk: milk.length > 0, alerts: spendingAlerts(tx, today) })
}
