import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAccessModule, requireFarmAccess } from '@/lib/auth'
import { animalToday } from '@/lib/animalRules'
import { lastMonths, milkResultByMonth, spendingAlerts } from '@/lib/milkResult'

// GET: resultado do leite dos últimos 12 meses (receita, custo e sobra por litro) e os gastos acima do normal no mês.
// Regra em src/lib/milkResult.ts.
export async function GET() {
  const auth = await requireFarmAccess('financeiro', 'view')
  if (auth.error) return auth.error
  const today = animalToday()
  const months = lastMonths(today, 12)
  const from = new Date(`${months[0]}-01T00:00:00.000Z`)
  const [transactions, milk] = await Promise.all([
    prisma.transaction.findMany({ where: { farmId: auth.farmId, date: { gte: from } }, select: { type: true, category: true, date: true, amount: true, lotId: true } }),
    canAccessModule(auth.user, 'leite')
      ? prisma.milkProduction.findMany({ where: { farmId: auth.farmId, date: { gte: from } }, select: { date: true, quantity: true, pricePerLiter: true } })
      : [],
  ])
  const tx = transactions.map((t) => ({ ...t, date: t.date.toISOString().slice(0, 10) }))
  const result = milkResultByMonth(tx, milk.map((m) => ({ ...m, date: m.date.toISOString().slice(0, 10) })), months)
  return NextResponse.json({ today, months: result, hasMilk: milk.length > 0, alerts: spendingAlerts(tx, today) })
}
