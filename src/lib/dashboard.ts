// Monta o Dashboard de cada perfil (formato em src/lib/dashboardTypes.ts): produtor, veterinário consultor,
// laticínio/associação e fornecedor. Só leitura; respeita os módulos que a pessoa pode ver na propriedade.
import { prisma } from '@/lib/prisma'
import { canAccessModule, type SessionUser } from '@/lib/auth'
import { animalCategory, animalToday } from '@/lib/animalRules'
import { lactatingByMonth, lactatingNow } from '@/lib/lactating'
import { addMonths, buildIndicators } from '@/lib/reproInsights'
import { farmOverviews, vetProfileOf, vetTasks } from '@/lib/vets'
import { todayStops } from '@/lib/laticinio'
import { sharedProduction } from '@/lib/associacao'
import type { Board, Chart, Tile, Tone } from '@/lib/dashboardTypes'

const DAY = 24 * 60 * 60 * 1000
const dayKey = (d: Date) => d.toISOString().slice(0, 10)
const midnight = (day: string) => new Date(`${day}T00:00:00.000Z`)
const ddmm = (d: Date) => `${d.toISOString().slice(8, 10)}/${d.toISOString().slice(5, 7)}`
const round1 = (n: number) => Math.round(n * 10) / 10

/** Os últimos n dias, terminando hoje ("AAAA-MM-DD") */
function lastDays(today: string, n: number): string[] {
  const end = midnight(today).getTime()
  return Array.from({ length: n }, (_, i) => dayKey(new Date(end - (n - 1 - i) * DAY)))
}

/** Os últimos n meses, terminando no mês atual ("AAAA-MM") */
const lastMonths = (today: string, n: number) => Array.from({ length: n }, (_, i) => addMonths(today.slice(0, 7), i - (n - 1)))

function sumBy<T>(rows: T[], key: (row: T) => string, value: (row: T) => number): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows) map.set(key(row), (map.get(key(row)) ?? 0) + value(row))
  return map
}

/** As maiores primeiro, até `limit` */
const top = (rows: { label: string; value: number }[], limit = 10) => rows.filter((r) => r.value > 0).sort((a, b) => b.value - a.value).slice(0, limit)

/** Opções do filtro de período (meses), no quadro do veterinário */
const PERIODS = [3, 6, 12]

export async function buildDashboard(user: SessionUser, options: { months?: number } = {}): Promise<Board | null> {
  if (user.role === 'fornecedor') return user.vendorId ? vendorBoard(user.vendorId) : null
  if (user.role === 'laticinio' || user.role === 'associacao') return user.organizationId ? organizationBoard(user.organizationId) : null
  if (user.role === 'lite' || user.role === 'motorista') return null
  const vet = await vetProfileOf(user.id)
  if (vet) return vetBoard(user, vet.id, PERIODS.includes(options.months ?? 0) ? options.months! : 12)
  return producerBoard(user)
}

// ------------------------------------------------------------------------------------------------ produtor

async function producerBoard(user: SessionUser): Promise<Board | null> {
  const farmId = user.effectiveFarmId
  if (!farmId) return null
  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { name: true, segments: true, lactatingGoal: true } })
  if (!farm) return null
  const can = (module: string) => canAccessModule(user, module)
  const today = animalToday()
  const days = lastDays(today, 30)
  const months = lastMonths(today, 12)
  const monthStart = midnight(`${months[11]}-01`)
  const showMilk = can('leite') && (!farm.segments.length || farm.segments.includes('leite'))

  const [animals, milk, coverages, lateShots, money] = await Promise.all([
    can('animais') ? prisma.animal.findMany({ where: { farmId, status: { in: ['Vivo', 'Doente'] } }, select: { species: true, gender: true, birthDate: true, isCastrated: true } }) : null,
    showMilk ? prisma.milkProduction.findMany({ where: { farmId, date: { gte: midnight(`${months[0]}-01`) } }, select: { date: true, quantity: true, animalId: true, cowsMilked: true } }) : null,
    can('reproducao') ? prisma.reproduction.findMany({ where: { farmId }, select: { coverageDate: true, status: true, expectedBirthDate: true, actualBirthDate: true } }) : null,
    can('vacinacao') ? prisma.vaccination.count({ where: { animal: { farmId }, appliedDate: null, scheduledDate: { lt: midnight(today) } } }) : null,
    can('financeiro') ? prisma.transaction.findMany({ where: { farmId, date: { gte: monthStart } }, select: { type: true, amount: true } }) : null,
  ])

  const tiles: Tile[] = []
  const charts: Chart[] = []

  if (animals) tiles.push({ label: 'Animais no rebanho', value: animals.length })

  if (milk) {
    const byDay = sumBy(milk, (m) => dayKey(m.date), (m) => m.quantity)
    const byMonth = sumBy(milk, (m) => dayKey(m.date).slice(0, 7), (m) => m.quantity)
    const yesterday = days[28]
    const week = days.slice(22, 29).reduce((sum, d) => sum + (byDay.get(d) ?? 0), 0)
    tiles.push({ label: 'Leite ontem', value: Math.round(byDay.get(yesterday) ?? 0), unit: 'L', detail: { text: 'média de 7 dias: {n} L/dia', vars: { n: Math.round(week / 7) } } })
    tiles.push({ label: 'Leite no mês', value: Math.round(byMonth.get(months[11]) ?? 0), unit: 'L' })
    // Vacas em lactação e a meta da propriedade ("70 de 100")
    const lactRows = milk.map((m) => ({ date: dayKey(m.date), animalId: m.animalId, cowsMilked: m.cowsMilked }))
    const lactating = lactatingNow(lactRows, today)
    if (lactating !== null || farm.lactatingGoal) {
      const goal = farm.lactatingGoal
      tiles.push({
        label: 'Vacas em lactação', value: lactating ?? 0,
        ...(goal ? { suffix: `de ${goal}`, detail: { text: '{p}% da meta', vars: { p: Math.round(((lactating ?? 0) / goal) * 100) } } } : {}),
      })
      const series = lactatingByMonth(lactRows, months)
      if (series.some((v) => v !== null)) charts.push({ kind: 'columns', axis: 'month', unit: '', title: 'Vacas em lactação por mês', subtitle: goal ? { text: 'Média de cada mês · meta: {n}', vars: { n: goal } } : 'Média de cada mês', points: months.map((x, i) => ({ x, value: series[i] })) })
    }
    charts.push({ kind: 'columns', wide: true, axis: 'day', unit: 'L', title: 'Leite por dia', subtitle: 'Últimos 30 dias (hoje ainda em andamento)', points: days.map((x) => ({ x, value: round1(byDay.get(x) ?? 0) })) })
    charts.push({ kind: 'columns', axis: 'month', unit: 'L', title: 'Leite por mês', subtitle: 'Últimos 12 meses', points: months.map((x) => ({ x, value: Math.round(byMonth.get(x) ?? 0) })) })
  }

  if (coverages) {
    const iso = (d: Date | null) => (d ? d.toISOString() : null)
    const rows = coverages.map((c) => ({ coverageDate: c.coverageDate.toISOString(), status: c.status, expectedBirthDate: iso(c.expectedBirthDate), actualBirthDate: iso(c.actualBirthDate) }))
    const ind = buildIndicators(rows, null, today)
    const in30 = dayKey(new Date(midnight(today).getTime() + 30 * DAY))
    const soon = rows.filter((c) => (c.status === 'Coberta' || c.status === 'Prenha') && !c.actualBirthDate && c.expectedBirthDate && c.expectedBirthDate.slice(0, 10) >= today && c.expectedBirthDate.slice(0, 10) <= in30).length
    tiles.push({ label: 'Concepção em 12 meses', value: ind.rate12, unit: '%' })
    tiles.push({ label: 'Partos em 30 dias', value: soon })
    tiles.push({ label: 'A diagnosticar', value: ind.awaiting, tone: ind.awaiting ? 'warn' : undefined })
    charts.push({ kind: 'columns', axis: 'month', title: 'Partos previstos', subtitle: 'Mês atual e os 5 seguintes', points: ind.births.map((m) => ({ x: m.month, value: m.count })) })
    charts.push({ kind: 'line', axis: 'month', unit: '%', max: 100, title: 'Taxa de concepção', subtitle: 'Por mês da cobertura: das diagnosticadas, quantas ficaram prenhas', points: ind.pregnancy.map((m) => ({ x: m.month, value: m.rate })) })
  }

  if (lateShots !== null) tiles.push({ label: 'Vacinas atrasadas', value: lateShots, tone: lateShots ? 'bad' : undefined })

  if (money) {
    const income = money.filter((t) => t.type === 'Receita').reduce((s, t) => s + t.amount, 0)
    const expense = money.filter((t) => t.type !== 'Receita').reduce((s, t) => s + t.amount, 0)
    tiles.push({ label: 'Saldo do mês', value: Math.round(income - expense), unit: 'R$', tone: income - expense < 0 ? 'bad' : 'good' })
    charts.push({ kind: 'bars', unit: 'R$', title: 'Receitas e despesas do mês', rows: [{ label: 'Receitas', value: Math.round(income), translate: true }, { label: 'Despesas', value: Math.round(expense), translate: true }] })
  }

  if (animals) {
    const byCategory = sumBy(animals, (a) => animalCategory(a), () => 1)
    charts.push({ kind: 'bars', title: 'Rebanho por categoria', rows: top([...byCategory].map(([label, value]) => ({ label, value })), 12).map((r) => ({ ...r, translate: true })) })
  }

  return { profile: 'produtor', name: farm.name, tiles, charts, generatedAt: new Date().toISOString() }
}

// ------------------------------------------------------------------------------------------------ veterinário

/** Etiqueta das vacinas no comparativo: em dia (90% ou mais aplicadas), atenção (75% a 89%) ou atrasadas */
function vaccineBadge(pct: number | null): { tone: Tone; badge: string } | undefined {
  if (pct === null) return undefined
  if (pct >= 90) return { tone: 'good', badge: 'Em dia' }
  return pct >= 75 ? { tone: 'warn', badge: 'Atenção' } : { tone: 'bad', badge: 'Atrasadas' }
}

async function vetBoard(user: SessionUser, vetId: string, period: number): Promise<Board> {
  const today = animalToday()
  const links = await prisma.vetClient.findMany({
    where: { vetId, status: 'ativo', farm: { isActive: true } },
    select: { id: true, farmId: true, farm: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  const farmIds = links.map((l) => l.farmId!)
  const periodStart = midnight(`${addMonths(today.slice(0, 7), 1 - period)}-01`)
  const [overviews, tasks, visits, shots, lastVisits] = await Promise.all([
    farmOverviews(farmIds, period),
    vetTasks(farmIds),
    prisma.vetVisit.findMany({ where: { vetId, status: 'agendada', date: { gte: midnight(today) } }, select: { farmName: true, date: true, time: true, purpose: true }, orderBy: [{ date: 'asc' }, { time: 'asc' }], take: 8 }),
    // Vacinas em dia: das marcadas no período até hoje, quantas já foram aplicadas
    prisma.vaccination.findMany({ where: { animal: { farmId: { in: farmIds } }, scheduledDate: { gte: periodStart, lte: midnight(today) } }, select: { appliedDate: true, animal: { select: { farmId: true } } } }),
    prisma.vetVisit.groupBy({ by: ['clientId'], where: { vetId, status: 'realizada', clientId: { in: links.map((l) => l.id) } }, _max: { date: true } }),
  ])
  const farms = links.map((l) => {
    const own = shots.filter((s) => s.animal.farmId === l.farmId)
    return {
      name: l.farm!.name, farmId: l.farmId!, ...overviews.get(l.farmId!)!,
      vaccinesOnTime: own.length ? Math.round((own.filter((s) => s.appliedDate).length / own.length) * 100) : null,
      lastVisit: lastVisits.find((v) => v.clientId === l.id)?._max.date ?? null,
    }
  })
  const total = (pick: (f: (typeof farms)[number]) => number) => farms.reduce((sum, f) => sum + pick(f), 0)
  const rates = farms.flatMap((f) => (f.pregnancyRate === null ? [] : [f.pregnancyRate]))
  const average = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null
  const nameOf = (farmId: string) => farms.find((f) => f.farmId === farmId)?.name ?? ''
  const months = farms.find((f) => f.birthsByMonth.length)?.birthsByMonth.map((m) => m.month) ?? []

  const tiles: Tile[] = [
    { label: 'Propriedades atendidas', value: farms.length, accent: 'green' },
    { label: 'Rebanho total', value: total((f) => f.animals), suffix: 'animais', accent: 'blue' },
    { label: 'Concepção média', value: average, unit: '%', detail: { text: 'Últimos {n} meses', vars: { n: period } }, accent: 'teal' },
    { label: 'Partos em 30 dias', value: total((f) => f.birthsSoon), accent: 'amber' },
  ]
  const charts: Chart[] = [
    { kind: 'stacked', axis: 'month', title: 'Partos previstos por mês', subtitle: 'Todas as propriedades, pelas coberturas em aberto', xs: months, series: farms.map((f) => ({ name: f.name, values: months.map((m) => f.birthsByMonth.find((b) => b.month === m)?.count ?? 0) })) },
    {
      kind: 'bars', unit: '%', max: 100, title: 'Concepção por propriedade',
      subtitle: { text: 'Das diagnosticadas nos últimos {n} meses, quantas ficaram prenhas', vars: { n: period } },
      rows: [...farms].sort((a, b) => (b.pregnancyRate ?? -1) - (a.pregnancyRate ?? -1)).map((f) => ({ label: f.name, value: f.pregnancyRate })),
      ...(average !== null && rates.length > 1 ? { reference: { value: average, label: { text: 'Média: {n}%', vars: { n: average } } } } : {}),
    },
    { kind: 'bars', color: 'blue', title: 'A diagnosticar por propriedade', subtitle: 'Coberturas ainda sem diagnóstico de gestação', rows: top(farms.map((f) => ({ label: f.name, value: f.awaitingDiagnosis }))) },
    {
      kind: 'table', full: true, title: 'Comparativo por propriedade',
      columns: [{ label: 'Propriedade' }, { label: 'Animais', numeric: true }, { label: 'Concepção', numeric: true }, { label: 'A diagnosticar', numeric: true }, { label: 'Vacinas em dia' }, { label: 'Última visita' }],
      rows: [...farms].sort((a, b) => b.animals - a.animals).map((f) => [
        { text: f.name }, { value: f.animals }, { value: f.pregnancyRate, unit: '%' }, { value: f.awaitingDiagnosis },
        { value: f.vaccinesOnTime, unit: '%', ...vaccineBadge(f.vaccinesOnTime) },
        { date: f.lastVisit ? dayKey(f.lastVisit) : null },
      ]),
    },
    {
      kind: 'list', title: 'Próximas visitas', empty: 'Nenhuma visita marcada.',
      rows: visits.map((v) => ({ title: v.farmName, detail: [ddmm(v.date), v.time, v.purpose].filter(Boolean).join(' · '), tone: dayKey(v.date) === today ? 'warn' as const : undefined })),
    },
    {
      kind: 'list', title: 'O que fazer nas propriedades', empty: 'Nada pendente nas propriedades que você atende.',
      rows: tasks.filter((k) => k.tone !== 'blue').sort((a, b) => (a.tone === 'red' ? 0 : 1) - (b.tone === 'red' ? 0 : 1)).slice(0, 8)
        .map((k) => ({ title: { text: k.title, vars: { n: k.n } }, detail: nameOf(k.farmId), tone: k.tone === 'red' ? 'bad' as const : 'warn' as const })),
    },
  ]
  return { profile: 'veterinario', name: user.name, tiles, charts, period: { months: period, options: PERIODS }, generatedAt: new Date().toISOString() }
}

// ------------------------------------------------------------------------------------------------ laticínio e associação

async function organizationBoard(organizationId: string): Promise<Board | null> {
  const org = await prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true, type: true } })
  if (!org) return null
  const today = animalToday()
  const days = lastDays(today, 30)
  const months = lastMonths(today, 12)
  const monthStart = midnight(`${months[11]}-01`)
  const tiles: Tile[] = []
  const charts: Chart[] = []

  // Coleta de leite pelas rotas (laticínio; associação que também coleta)
  const points = await prisma.milkPoint.findMany({ where: { organizationId }, select: { id: true, name: true, active: true } })
  if (points.length) {
    const [entries, stops, received] = await Promise.all([
      prisma.milkEntry.findMany({ where: { pointId: { in: points.map((p) => p.id) }, date: { gte: midnight(`${months[0]}-01`) } }, select: { pointId: true, date: true, liters: true } }),
      todayStops(organizationId, midnight(today)),
      prisma.milkReception.aggregate({ where: { organizationId, date: { gte: monthStart } }, _sum: { liters: true } }),
    ])
    const byDay = sumBy(entries, (e) => dayKey(e.date), (e) => e.liters)
    const byMonth = sumBy(entries, (e) => dayKey(e.date).slice(0, 7), (e) => e.liters)
    const byPoint = sumBy(entries.filter((e) => e.date >= monthStart), (e) => e.pointId, (e) => e.liters)
    const pending = stops.filter((s) => s.status === 'pendente').length
    const done = stops.filter((s) => s.status === 'coletado').length
    tiles.push({ label: 'Coletado hoje', value: Math.round(byDay.get(today) ?? 0), unit: 'L', detail: stops.length ? { text: '{a} de {b} paradas coletadas', vars: { a: done, b: stops.length } } : undefined })
    tiles.push({ label: 'Paradas pendentes hoje', value: pending, tone: pending ? 'warn' : undefined })
    tiles.push({ label: 'Coletado no mês', value: Math.round(byMonth.get(months[11]) ?? 0), unit: 'L' })
    if (received._sum.liters) tiles.push({ label: 'Recebido no mês', value: Math.round(received._sum.liters), unit: 'L' })
    tiles.push({ label: 'Pontos de coleta', value: points.filter((p) => p.active).length })
    charts.push({ kind: 'columns', wide: true, axis: 'day', unit: 'L', title: 'Leite coletado por dia', subtitle: 'Últimos 30 dias (hoje ainda em andamento)', points: days.map((x) => ({ x, value: Math.round(byDay.get(x) ?? 0) })) })
    charts.push({ kind: 'columns', axis: 'month', unit: 'L', title: 'Leite coletado por mês', subtitle: 'Últimos 12 meses', points: months.map((x) => ({ x, value: Math.round(byMonth.get(x) ?? 0) })) })
    charts.push({ kind: 'bars', unit: 'L', title: 'Pontos que mais entregaram no mês', rows: top(points.map((p) => ({ label: p.name, value: Math.round(byPoint.get(p.id) ?? 0) }))) })
    charts.push({
      kind: 'list', title: 'Sem coleta hoje', empty: 'Nenhuma parada sem coleta hoje.',
      rows: stops.filter((s) => s.status === 'nao-coletado').map((s) => ({ title: s.pointName, detail: s.skipReason ?? undefined, tone: 'bad' as const })),
    })
  }

  if (org.type === 'associacao') {
    const members = await prisma.orgMember.findMany({
      where: { organizationId, status: 'ativo' },
      select: { id: true, farmId: true, userId: true, shareProduction: true, farm: { select: { name: true } }, user: { select: { name: true } } },
    })
    const sixMonths = lastMonths(today, 6)
    const [fees, requested, visits, ...production] = await Promise.all([
      prisma.memberFee.findMany({ where: { organizationId, paidAt: null, dueDate: { lt: midnight(today) } }, select: { amount: true } }),
      prisma.techVisit.count({ where: { organizationId, status: 'solicitada' } }),
      prisma.techVisit.findMany({
        where: { organizationId, status: 'agendada', scheduledFor: { gte: midnight(today) } },
        select: { subject: true, scheduledFor: true, member: { select: { farm: { select: { name: true } }, user: { select: { name: true } } } } },
        orderBy: { scheduledFor: 'asc' }, take: 8,
      }),
      ...sixMonths.map((m) => sharedProduction(members, midnight(`${m}-01`), new Date(midnight(`${addMonths(m, 1)}-01`).getTime() - 1))),
    ])
    const memberName = (m: { farm: { name: string } | null; user: { name: string } | null }) => m.farm?.name ?? m.user?.name ?? '—'
    const thisMonth = production[production.length - 1]
    const overdue = fees.reduce((s, f) => s + f.amount, 0)
    tiles.push({ label: 'Associados', value: members.length })
    tiles.push({ label: 'Leite dos associados no mês', value: Math.round([...thisMonth.values()].reduce((a, b) => a + b, 0)), unit: 'L', detail: { text: '{n} compartilham a produção', vars: { n: members.filter((m) => m.shareProduction).length } } })
    tiles.push({ label: 'Mensalidades atrasadas', value: Math.round(overdue), unit: 'R$', tone: fees.length ? 'bad' : undefined, detail: { text: fees.length === 1 ? '{n} mensalidade' : '{n} mensalidades', vars: { n: fees.length } } })
    tiles.push({ label: 'Visitas técnicas pedidas', value: requested, tone: requested ? 'warn' : undefined })
    charts.push({ kind: 'columns', axis: 'month', unit: 'L', title: 'Leite dos associados por mês', subtitle: 'Só de quem autorizou compartilhar a produção', points: sixMonths.map((x, i) => ({ x, value: Math.round([...production[i].values()].reduce((a, b) => a + b, 0)) })) })
    charts.push({ kind: 'bars', unit: 'L', title: 'Leite por associado no mês', rows: top(members.map((m) => ({ label: memberName(m), value: Math.round(thisMonth.get(m.id) ?? 0) }))) })
    charts.push({
      kind: 'list', title: 'Próximas visitas técnicas', empty: 'Nenhuma visita agendada.',
      rows: visits.map((v) => ({ title: memberName(v.member), detail: [v.scheduledFor ? ddmm(v.scheduledFor) : null, v.subject].filter(Boolean).join(' · ') })),
    })
  }

  return { profile: org.type, name: org.name, tiles, charts, generatedAt: new Date().toISOString() }
}

// ------------------------------------------------------------------------------------------------ fornecedor

async function vendorBoard(vendorId: string): Promise<Board | null> {
  const today = animalToday()
  const months = lastMonths(today, 12)
  const from12 = midnight(`${months[0]}-01`)
  const monthKey = months[11]
  const [vendor, requests, waiting, clients, promotions, sales] = await Promise.all([
    prisma.vendor.findUnique({ where: { id: vendorId }, select: { companyName: true } }),
    prisma.supplyRequest.findMany({ where: { vendorId, createdAt: { gte: from12 } }, select: { status: true, category: true, createdAt: true, repliedAt: true } }),
    prisma.supplyRequest.findMany({ where: { vendorId, status: 'novo' }, select: { itemName: true, quantity: true, unit: true, createdAt: true, farm: { select: { name: true } } }, orderBy: { createdAt: 'asc' } }),
    prisma.vendorClient.count({ where: { vendorId } }),
    prisma.promotion.findMany({ where: { vendorId, isActive: true, validUntil: { gte: midnight(today) } }, select: { title: true, whatsappClicks: true } }),
    prisma.offerContact.findMany({ where: { promotion: { vendorId }, status: 'venda', soldAt: { gte: from12 } }, select: { saleValue: true, soldAt: true } }),
  ])
  if (!vendor) return null
  const reqByMonth = sumBy(requests, (r) => dayKey(r.createdAt).slice(0, 7), () => 1)
  const salesByMonth = sumBy(sales, (s) => dayKey(s.soldAt!).slice(0, 7), (s) => s.saleValue ?? 0)
  const repliedThisMonth = requests.filter((r) => r.repliedAt && dayKey(r.repliedAt).startsWith(monthKey)).length

  const tiles: Tile[] = [
    { label: 'Pedidos aguardando resposta', value: waiting.length, tone: waiting.length ? 'warn' : undefined },
    { label: 'Pedidos no mês', value: reqByMonth.get(monthKey) ?? 0, detail: { text: '{n} respondidos', vars: { n: repliedThisMonth } } },
    { label: 'Clientes', value: clients },
    { label: 'Ofertas ativas', value: promotions.length },
    { label: 'Vendas pelas ofertas no mês', value: Math.round(salesByMonth.get(monthKey) ?? 0), unit: 'R$' },
  ]
  const charts: Chart[] = [
    { kind: 'columns', axis: 'month', title: 'Pedidos de orçamento por mês', subtitle: 'Últimos 12 meses', points: months.map((x) => ({ x, value: reqByMonth.get(x) ?? 0 })) },
    { kind: 'columns', axis: 'month', unit: 'R$', title: 'Vendas pelas ofertas por mês', subtitle: 'Vendas registradas nos contatos das ofertas', points: months.map((x) => ({ x, value: Math.round(salesByMonth.get(x) ?? 0) })) },
    { kind: 'bars', title: 'Pedidos por categoria', subtitle: 'Últimos 12 meses', rows: top([...sumBy(requests, (r) => r.category, () => 1)].map(([label, value]) => ({ label, value }))).map((r) => ({ ...r, translate: true })) },
    { kind: 'bars', title: 'Cliques no WhatsApp por oferta', subtitle: 'Ofertas ativas', rows: top(promotions.map((p) => ({ label: p.title, value: p.whatsappClicks }))) },
    {
      kind: 'list', title: 'Aguardando resposta', empty: 'Nenhum pedido aguardando resposta.',
      rows: waiting.slice(0, 8).map((r) => ({ title: r.itemName, detail: [r.farm.name, r.quantity ? `${r.quantity} ${r.unit ?? ''}`.trim() : null, ddmm(r.createdAt)].filter(Boolean).join(' · '), tone: 'warn' as const })),
    },
  ]
  return { profile: 'fornecedor', name: vendor.companyName, tiles, charts, generatedAt: new Date().toISOString() }
}
