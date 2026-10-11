import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { requireFarmAccess } from '@/lib/auth'
import { formatarIdade } from '@/lib/utils'
import { REPORT_TYPES, Report, fmtDate, fmtMoney, fmtNumber } from '@/lib/reports'
import { cowCalving, herdCalving, LATE_MONTHS } from '@/lib/calving'

interface Period {
  gte: Date
  lt: Date
  label: string
}

function parsePeriod(from: string | null, to: string | null): Period | null {
  if (!from || !to) return null
  const gte = new Date(from)
  const lt = new Date(to)
  if (Number.isNaN(gte.getTime()) || Number.isNaN(lt.getTime())) return null
  lt.setUTCDate(lt.getUTCDate() + 1) // inclui o dia final inteiro
  return { gte, lt, label: `${fmtDate(gte)} a ${fmtDate(to)}` }
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const type = REPORT_TYPES.find((t) => t.key === params.get('tipo'))
  if (!type) return NextResponse.json({ error: 'Relatório desconhecido' }, { status: 400 })

  const auth = await requireFarmAccess(type.module, 'view')
  if (auth.error) return auth.error
  const farmId = auth.farmId

  const period = parsePeriod(params.get('from'), params.get('to'))
  if (type.needsPeriod && !period) {
    return NextResponse.json({ error: 'Informe o período' }, { status: 400 })
  }

  const farm = await prisma.farm.findUnique({ where: { id: farmId }, select: { name: true } })
  const farmName = farm?.name ?? ''

  try {
    let report: Report | null
    switch (type.key) {
      case 'leite': report = await milkReport(farmId, period!); break
      case 'ficha-animal': report = await animalReport(farmId, params.get('animalId')); break
      case 'vacinacao': report = await vaccinationReport(farmId, period!); break
      case 'financeiro': report = await financeReport(farmId, period!); break
      case 'rebanho': report = await herdReport(farmId); break
      case 'partos': report = await calvingReport(farmId); break
      case 'estoque': report = await stockReport(farmId, period!); break
      default: report = null
    }
    if (!report) return NextResponse.json({ error: 'Animal não encontrado' }, { status: 404 })

    report.subtitle = [farmName, report.subtitle].filter(Boolean).join(' · ')
    return NextResponse.json(report)
  } catch (err) {
    console.error('Report error:', err)
    return NextResponse.json({ error: 'Erro ao gerar o relatório' }, { status: 500 })
  }
}

// ── Produção de leite ──────────────────────────────────────────────────

async function milkReport(farmId: string, period: Period): Promise<Report> {
  const productions = await prisma.milkProduction.findMany({
    where: { farmId, date: { gte: period.gte, lt: period.lt } },
    include: { animal: { select: { id: true, code: true, name: true } } },
    orderBy: { date: 'asc' },
  })

  // Por dia soma tudo: lançamentos por vaca e totais do dia (sem vaca)
  const byDay = new Map<string, { total: number; cows: Set<string>; cowsInTotal: number }>()
  const byCow = new Map<string, { code: string; name: string; total: number; days: Set<string> }>()
  for (const p of productions) {
    const day = p.date.toISOString().slice(0, 10)
    const d = byDay.get(day) ?? { total: 0, cows: new Set<string>(), cowsInTotal: 0 }
    d.total += p.quantity
    if (p.animal) {
      d.cows.add(p.animal.id)
      const cow = byCow.get(p.animal.id) ?? { code: p.animal.code, name: p.animal.name, total: 0, days: new Set<string>() }
      cow.total += p.quantity
      cow.days.add(day)
      byCow.set(p.animal.id, cow)
    } else if (p.cowsMilked) {
      // Manhã e tarde costumam ser as mesmas vacas: vale o maior número informado no dia
      d.cowsInTotal = Math.max(d.cowsInTotal, p.cowsMilked)
    }
    byDay.set(day, d)
  }

  const total = productions.reduce((s, p) => s + p.quantity, 0)
  const days = [...byDay.entries()]
  const sections: Report['sections'] = [
    {
      title: 'Por dia',
      columns: ['Data', 'Vacas ordenhadas', 'Total (L)'],
      numeric: [1, 2],
      rows: days.map(([day, d]) => {
        const cows = d.cows.size + d.cowsInTotal
        return [fmtDate(day), cows || '—', fmtNumber(d.total)]
      }),
      footer: [`${days.length} dias`, days.length ? `Média ${fmtNumber(total / days.length)} L/dia` : '', fmtNumber(total)],
    },
  ]

  if (byCow.size > 0) {
    const cows = [...byCow.values()].sort((a, b) => b.total - a.total)
    const cowsTotal = cows.reduce((s, c) => s + c.total, 0)
    sections.push({
      title: 'Por vaca',
      columns: ['Código', 'Vaca', 'Total (L)', 'Dias com registro', 'Média por dia (L)'],
      numeric: [2, 3, 4],
      rows: cows.map((c) => [c.code, c.name, fmtNumber(c.total), c.days.size, fmtNumber(c.total / c.days.size)]),
      footer: ['', 'Total das vacas', fmtNumber(cowsTotal), '', ''],
    })
  }

  return { title: 'Produção de leite', subtitle: period.label, sections }
}

// ── Ficha do animal ────────────────────────────────────────────────────

async function animalReport(farmId: string, animalId: string | null): Promise<Report | null> {
  if (!animalId) return null
  const a = await prisma.animal.findFirst({
    where: { id: animalId, farmId },
    include: {
      vaccinations: { orderBy: { scheduledDate: 'desc' } },
      veterinaryTreatments: { orderBy: { startDate: 'desc' } },
      reproductions: { orderBy: { coverageDate: 'desc' } },
      milkProductions: { orderBy: { date: 'desc' }, select: { date: true, quantity: true } },
      calves: { orderBy: { birthDate: 'asc' } },
      mother: { select: { name: true, code: true } },
    },
  })
  if (!a) return null
  const calving = cowCalving(a, a.calves.map((c) => ({ ...c, motherId: a.id })))

  const byMonth = new Map<string, number>()
  for (const p of a.milkProductions) {
    const month = p.date.toISOString().slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + p.quantity)
  }

  const data: [string, string][] = [
    ['Código', a.code],
    ['Nome', a.name],
    ['Espécie', a.species],
    ['Sexo', a.gender],
    ['Nascimento', fmtDate(a.birthDate)],
    ['Idade', formatarIdade(a.birthDate.toISOString())],
    ['Situação', a.status],
    ['GTA', a.gta || '—'],
  ]
  if (a.mother) data.push(['Mãe', `${a.mother.name} (${a.mother.code})`])
  if (a.calves.length) {
    data.push(['Crias', `${a.calves.length} em ${calving.calvings} parto${calving.calvings === 1 ? '' : 's'}`])
    if (calving.averageInterval !== null) data.push(['Intervalo médio entre partos', `${calving.averageInterval} meses`])
  }
  if (a.lowDate) data.push(['Data da baixa', fmtDate(a.lowDate)], ['Motivo da baixa', a.lowReason || '—'])
  if (a.observations) data.push(['Observações', a.observations])

  return {
    title: `Ficha do animal: ${a.name} (${a.code})`,
    subtitle: `Emitido em ${new Date().toLocaleDateString('pt-BR')}`,
    sections: [
      { title: 'Dados', columns: ['Campo', 'Valor'], rows: data },
      {
        title: 'Vacinas',
        columns: ['Vacina', 'Prevista', 'Aplicada', 'Lote', 'Fabricante'],
        rows: a.vaccinations.map((v) => [v.vaccineName, fmtDate(v.scheduledDate), fmtDate(v.appliedDate), v.batch || '—', v.manufacturer || '—']),
      },
      {
        title: 'Tratamentos',
        columns: ['Medicamento', 'Início', 'Fim', 'Lote', 'Descrição'],
        rows: a.veterinaryTreatments.map((t) => [t.medicine, fmtDate(t.startDate), fmtDate(t.endDate), t.batch || '—', t.description || '—']),
      },
      {
        title: 'Reprodução',
        columns: ['Cobertura', 'Reprodutor', 'Parto previsto', 'Parto', 'Situação'],
        rows: a.reproductions.map((r) => [fmtDate(r.coverageDate), r.maleName || '—', fmtDate(r.expectedBirthDate), fmtDate(r.actualBirthDate), r.status]),
      },
      ...(a.calves.length ? [{
        title: 'Crias',
        columns: ['Nascimento', 'Código', 'Cria', 'Sexo', 'Situação'],
        rows: a.calves.map((c) => [fmtDate(c.birthDate), c.code, c.name, c.gender === 'Fêmea' ? 'Bezerra' : 'Bezerro', c.status]),
      }] : []),
      {
        title: 'Leite por mês',
        columns: ['Mês', 'Total (L)'],
        numeric: [1],
        rows: [...byMonth.entries()].map(([m, total]) => [`${m.slice(5, 7)}/${m.slice(0, 4)}`, fmtNumber(total)]),
      },
    ],
  }
}

// ── Vacinação ──────────────────────────────────────────────────────────

async function vaccinationReport(farmId: string, period: Period): Promise<Report> {
  const range = { gte: period.gte, lt: period.lt }
  const vaccinations = await prisma.vaccination.findMany({
    where: { animal: { farmId }, OR: [{ scheduledDate: range }, { appliedDate: range }] },
    include: { animal: { select: { code: true, name: true } } },
    orderBy: { scheduledDate: 'asc' },
  })
  const today = new Date()
  const status = (v: (typeof vaccinations)[number]) =>
    v.appliedDate ? 'Aplicada' : v.scheduledDate < today ? 'Atrasada' : 'Pendente'

  const applied = vaccinations.filter((v) => v.appliedDate).length
  return {
    title: 'Vacinação do rebanho',
    subtitle: period.label,
    sections: [
      {
        columns: ['Código', 'Animal', 'Vacina', 'Prevista', 'Aplicada', 'Lote', 'Fabricante', 'Situação'],
        rows: vaccinations.map((v) => [
          v.animal.code, v.animal.name, v.vaccineName, fmtDate(v.scheduledDate), fmtDate(v.appliedDate),
          v.batch || '—', v.manufacturer || '—', status(v),
        ]),
        footer: ['', `${vaccinations.length} registros`, '', '', `${applied} aplicadas`, '', '', `${vaccinations.length - applied} pendentes`],
      },
    ],
  }
}

// ── Fluxo de caixa ─────────────────────────────────────────────────────

async function financeReport(farmId: string, period: Period): Promise<Report> {
  const transactions = await prisma.transaction.findMany({
    where: { farmId, date: { gte: period.gte, lt: period.lt } },
    include: { animal: { select: { name: true } } },
    orderBy: { date: 'asc' },
  })

  const byCategory = new Map<string, { type: string; total: number }>()
  let income = 0
  let expense = 0
  for (const t of transactions) {
    const key = `${t.type}|${t.category}`
    const c = byCategory.get(key) ?? { type: t.type, total: 0 }
    c.total += t.amount
    byCategory.set(key, c)
    if (t.type === 'Receita') income += t.amount
    else expense += t.amount
  }

  return {
    title: 'Fluxo de caixa',
    subtitle: period.label,
    sections: [
      {
        title: 'Resumo',
        columns: ['Receitas', 'Despesas', 'Saldo'],
        numeric: [0, 1, 2],
        rows: [[fmtMoney(income), fmtMoney(expense), fmtMoney(income - expense)]],
      },
      {
        title: 'Por categoria',
        columns: ['Tipo', 'Categoria', 'Total'],
        numeric: [2],
        rows: [...byCategory.entries()]
          .sort((a, b) => a[1].type.localeCompare(b[1].type) || b[1].total - a[1].total)
          .map(([key, c]) => [c.type, key.split('|')[1], fmtMoney(c.total)]),
      },
      {
        title: 'Lançamentos',
        columns: ['Data', 'Tipo', 'Categoria', 'Descrição', 'Animal', 'Valor'],
        numeric: [5],
        rows: transactions.map((t) => [
          fmtDate(t.date), t.type, t.category, t.description || '—', t.animal?.name || '—',
          fmtMoney(t.type === 'Receita' ? t.amount : -t.amount),
        ]),
        footer: ['', '', '', '', 'Saldo', fmtMoney(income - expense)],
      },
    ],
  }
}

// ── Inventário do rebanho ──────────────────────────────────────────────

async function herdReport(farmId: string): Promise<Report> {
  const animals = await prisma.animal.findMany({ where: { farmId }, orderBy: [{ species: 'asc' }, { name: 'asc' }] })

  const statuses = [...new Set(animals.map((a) => a.status))].sort()
  const bySpecies = new Map<string, Map<string, number>>()
  for (const a of animals) {
    const m = bySpecies.get(a.species) ?? new Map<string, number>()
    m.set(a.status, (m.get(a.status) ?? 0) + 1)
    bySpecies.set(a.species, m)
  }

  return {
    title: 'Inventário do rebanho',
    subtitle: `Posição em ${new Date().toLocaleDateString('pt-BR')}`,
    sections: [
      {
        title: 'Resumo por espécie',
        columns: ['Espécie', ...statuses, 'Total'],
        numeric: statuses.map((_, i) => i + 1).concat(statuses.length + 1),
        rows: [...bySpecies.entries()].map(([species, m]) => [
          species, ...statuses.map((s) => m.get(s) ?? 0), [...m.values()].reduce((x, y) => x + y, 0),
        ]),
        footer: ['Total', ...statuses.map((s) => animals.filter((a) => a.status === s).length), animals.length],
      },
      {
        title: 'Animais',
        columns: ['Código', 'Nome', 'Espécie', 'Sexo', 'Nascimento', 'Idade', 'Situação', 'GTA'],
        rows: animals.map((a) => [
          a.code, a.name, a.species, a.gender, fmtDate(a.birthDate), formatarIdade(a.birthDate.toISOString()), a.status, a.gta || '—',
        ]),
      },
    ],
  }
}

// ── Crias e partos ─────────────────────────────────────────────────────

async function calvingReport(farmId: string): Promise<Report> {
  const [animals, open] = await Promise.all([
    prisma.animal.findMany({ where: { farmId }, orderBy: { name: 'asc' } }),
    prisma.reproduction.findMany({ where: { farmId, actualBirthDate: null, status: { in: ['Coberta', 'Prenha'] } }, select: { femaleId: true } }),
  ])
  const stats = herdCalving(animals, new Set(open.map((r) => r.femaleId)))
  const byId = new Map(animals.map((a) => [a.id, a]))
  const calves = animals.filter((a) => a.motherId).sort((a, b) => a.birthDate.getTime() - b.birthDate.getTime())
  const months = (n: number | null) => (n === null ? '—' : String(n))

  return {
    title: 'Crias e partos',
    subtitle: `Posição em ${new Date().toLocaleDateString('pt-BR')}`,
    sections: [
      {
        title: 'Resumo',
        columns: ['Vacas', 'Crias anotadas', 'Intervalo médio entre partos (meses)', 'Idade média na 1ª cria (meses)', 'Demorando para criar'],
        numeric: [0, 1, 2, 3, 4],
        rows: [[
          stats.cows.length, calves.length, months(stats.averageInterval), months(stats.averageAgeAtFirst),
          stats.late.filter((l) => l.reason === 'sem-parir').length,
        ]],
      },
      {
        title: 'Por vaca',
        columns: ['Código', 'Vaca', 'Crias', 'Partos', 'Último parto', 'Meses desde o último', 'Intervalo médio (meses)', 'Idade na 1ª cria (meses)'],
        numeric: [2, 3, 5, 6, 7],
        rows: stats.cows.map((c) => [
          c.cow.code, c.cow.name, c.calves, c.calvings, c.lastCalving ? fmtDate(c.lastCalving) : '—',
          months(c.monthsSinceLast), months(c.averageInterval), months(c.ageAtFirstCalving),
        ]),
      },
      {
        title: `Demorando para criar (mais de ${LATE_MONTHS} meses sem parir, sem prenhez anotada)`,
        columns: ['Código', 'Vaca', 'Último parto', 'Meses sem parir'],
        numeric: [3],
        rows: stats.late.filter((l) => l.reason === 'sem-parir').map(({ stats: s }) => [s.cow.code, s.cow.name, fmtDate(s.lastCalving), months(s.monthsSinceLast)]),
      },
      {
        title: 'Crias',
        columns: ['Nascimento', 'Mãe', 'Código', 'Cria', 'Sexo', 'Situação'],
        rows: calves.map((c) => [fmtDate(c.birthDate), byId.get(c.motherId!)?.name ?? '—', c.code, c.name, c.gender === 'Fêmea' ? 'Bezerra' : 'Bezerro', c.status]),
      },
    ],
  }
}

// ── Estoque ────────────────────────────────────────────────────────────

async function stockReport(farmId: string, period: Period): Promise<Report> {
  const [movements, supplies] = await Promise.all([
    prisma.supplyMovement.findMany({
      where: { supply: { farmId }, date: { gte: period.gte, lt: period.lt } },
      include: { supply: { select: { name: true, unit: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.supply.findMany({ where: { farmId }, orderBy: { name: 'asc' } }),
  ])

  return {
    title: 'Movimentação de estoque',
    subtitle: period.label,
    sections: [
      {
        title: 'Entradas e saídas',
        columns: ['Data', 'Item', 'Tipo', 'Quantidade', 'Unidade', 'Descrição'],
        numeric: [3],
        rows: movements.map((m) => [fmtDate(m.date), m.supply.name, m.type, fmtNumber(m.quantity, 2), m.supply.unit, m.description || '—']),
      },
      {
        title: 'Saldo atual',
        columns: ['Item', 'Categoria', 'Quantidade', 'Mínimo', 'Unidade', 'Situação'],
        numeric: [2, 3],
        rows: supplies.map((s) => [
          s.name, s.category, fmtNumber(s.currentQuantity, 2), fmtNumber(s.minimumQuantity, 2), s.unit,
          s.currentQuantity <= s.minimumQuantity ? 'Repor' : 'OK',
        ]),
      },
    ],
  }
}
