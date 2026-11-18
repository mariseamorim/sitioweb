import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAccessModule, requireFarmAccess } from '@/lib/auth'
import { addMonths, buildIndicators, type MonthLiters } from '@/lib/reproInsights'
import { buildHerdIndices } from '@/lib/herdIndices'
import { animalToday } from '@/lib/animalRules'

// GET: indicadores de reprodução da propriedade aberta (partos por mês, prenhez por mês, leite por mês e destaques).
// e os índices zootécnicos do rebanho (serviço, concepção, prenhez, IEP, IPP e DPP). O leite só entra para quem tem o módulo de leite.
export async function GET() {
  const auth = await requireFarmAccess('reproducao', 'view')
  if (auth.error) return auth.error

  const today = animalToday()
  const from = new Date(`${addMonths(today.slice(0, 7), -11)}-01T00:00:00.000Z`)
  const [coverages, milk, herd] = await Promise.all([
    // Coberturas dos 12 meses e todas as que ainda estão em aberto (parto previsto ou diagnóstico pendente)
    prisma.reproduction.findMany({
      where: { farmId: auth.farmId, OR: [{ coverageDate: { gte: from } }, { status: { in: ['Coberta', 'Prenha'] }, actualBirthDate: null }] },
      select: { femaleId: true, coverageDate: true, status: true, expectedBirthDate: true, actualBirthDate: true },
    }),
    canAccessModule(auth.user, 'leite')
      ? prisma.$queryRaw<MonthLiters[]>`SELECT to_char("date", 'YYYY-MM') AS month, SUM("quantity")::float AS liters FROM "milk_productions" WHERE "farmId" = ${auth.farmId} AND "date" >= ${from} GROUP BY 1`
      : Promise.resolve(null),
    prisma.animal.findMany({ where: { farmId: auth.farmId }, select: { id: true, species: true, gender: true, status: true, birthDate: true, motherId: true } }),
  ])

  const iso = (d: Date | null) => (d ? d.toISOString() : null)
  const rows = coverages.map((c) => ({ femaleId: c.femaleId, coverageDate: c.coverageDate.toISOString(), status: c.status, expectedBirthDate: iso(c.expectedBirthDate), actualBirthDate: iso(c.actualBirthDate) }))
  const indicators = buildIndicators(rows, milk, today)
  const indices = buildHerdIndices(herd.map((a) => ({ ...a, birthDate: a.birthDate.toISOString() })), rows, indicators.rate12, today)
  return NextResponse.json({ ...indicators, indices })
}
