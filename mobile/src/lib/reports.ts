// Relatórios calculados no aparelho a partir do banco local, com as mesmas fórmulas, colunas e rodapés
// de src/app/api/relatorios/route.ts do site. Funciona sem internet.
import { all, one } from '@/db'
import { animalCategory } from '@/lib/animalRules'
import { cowCalving, herdCalving, LATE_MONTHS, type CowLike } from '@/lib/calving'
import { brDate, brMoney, brNumber, isoDay, todayISO } from '@/lib/format'

export interface ReportSection {
  title?: string
  columns: string[]
  /** Colunas numéricas, alinhadas à direita */
  numeric?: number[]
  rows: (string | number)[][]
  footer?: (string | number)[]
}

export interface Report {
  title: string
  subtitle: string
  sections: ReportSection[]
}

export interface ReportType {
  key: string
  label: string
  description: string
  module: string
  needsPeriod: boolean
  needsAnimal?: boolean
}

export const REPORT_TYPES: ReportType[] = [
  { key: 'leite', label: 'Produção de leite', description: 'Total por dia e, se houver lançamento por vaca, o total de cada uma.', module: 'leite', needsPeriod: true },
  { key: 'ficha-animal', label: 'Ficha do animal', description: 'Dados, vacinas, tratamentos, partos e leite de um animal.', module: 'animais', needsPeriod: false, needsAnimal: true },
  { key: 'vacinacao', label: 'Vacinação do rebanho', description: 'Vacinas aplicadas e pendentes no período, com lote e fabricante.', module: 'vacinacao', needsPeriod: true },
  { key: 'financeiro', label: 'Fluxo de caixa', description: 'Receitas e despesas por categoria e lançamentos do período.', module: 'financeiro', needsPeriod: true },
  { key: 'partos', label: 'Crias e partos', description: 'Crias de cada vaca, intervalo entre partos e vacas demorando para criar.', module: 'animais', needsPeriod: false },
  { key: 'rebanho', label: 'Inventário do rebanho', description: 'Animais por espécie e situação, com lista completa.', module: 'animais', needsPeriod: false },
  { key: 'estoque', label: 'Movimentação de estoque', description: 'Entradas e saídas no período e saldo atual de cada item.', module: 'estoque', needsPeriod: true },
]

export const fmtNumber = (v: number, decimals = 1) => brNumber(v, decimals)
export const fmtMoney = (v: number) => brMoney(v)
export const fmtDate = (d: string | null | undefined) => brDate(d)

/** "3 Anos e 2 Meses", como formatarIdade() do site */
export function ageLabel(birthDate: string, today = todayISO()): string {
  const b = isoDay(birthDate)
  let anos = Number(today.slice(0, 4)) - Number(b.slice(0, 4))
  let meses = Number(today.slice(5, 7)) - Number(b.slice(5, 7))
  if (meses < 0) { anos--; meses += 12 }
  if (Number(today.slice(8, 10)) < Number(b.slice(8, 10))) { meses--; if (meses < 0) { anos--; meses += 12 } }
  return `${anos} Anos e ${meses} Meses`
}

export interface ReportParams { farmId: string; farmName?: string; from?: string; to?: string; animalId?: string | null }

interface Period { from: string; to: string; label: string }

/** Monta o relatório pedido. Devolve null se faltar o animal (ficha) ou o período. */
export function buildReport(tipo: string, p: ReportParams): Report | null {
  const type = REPORT_TYPES.find(t => t.key === tipo)
  if (!type) return null
  const period: Period | null = p.from && p.to ? { from: p.from, to: p.to, label: `${fmtDate(p.from)} a ${fmtDate(p.to)}` } : null
  if (type.needsPeriod && !period) return null
  let report: Report | null
  switch (type.key) {
    case 'leite': report = milkReport(p.farmId, period!); break
    case 'ficha-animal': report = animalReport(p.farmId, p.animalId ?? null); break
    case 'vacinacao': report = vaccinationReport(p.farmId, period!); break
    case 'financeiro': report = financeReport(p.farmId, period!); break
    case 'rebanho': report = herdReport(p.farmId); break
    case 'partos': report = calvingReport(p.farmId); break
    case 'estoque': report = stockReport(p.farmId, period!); break
    default: report = null
  }
  if (!report) return null
  report.subtitle = [p.farmName ?? '', report.subtitle].filter(Boolean).join(' · ')
  return report
}

/** Condição de período sobre uma coluna de data (ISO ou AAAA-MM-DD) */
const inPeriod = (col: string) => `substr(${col}, 1, 10) >= ? AND substr(${col}, 1, 10) <= ?`
const today = () => new Date().toLocaleDateString('pt-BR')

// ── Produção de leite ──────────────────────────────────────────────────

interface MilkRow { date: string; quantity: number; cowsMilked: number | null; animalId: string | null; code: string | null; name: string | null }

function milkReport(farmId: string, period: Period): Report {
  const productions = all<MilkRow>(
    `SELECT m.date, m.quantity, m.cowsMilked, a.id AS animalId, a.code, a.name FROM milk m LEFT JOIN animals a ON a.id = m.animalId
     WHERE m.farmId = ? AND ${inPeriod('m.date')} ORDER BY m.date ASC`, [farmId, period.from, period.to],
  )

  // Por dia soma tudo: lançamentos por vaca e totais do dia (sem vaca)
  const byDay = new Map<string, { total: number; cows: Set<string>; cowsInTotal: number }>()
  const byCow = new Map<string, { code: string; name: string; total: number; days: Set<string> }>()
  for (const p of productions) {
    const day = isoDay(p.date)
    const d = byDay.get(day) ?? { total: 0, cows: new Set<string>(), cowsInTotal: 0 }
    d.total += p.quantity
    if (p.animalId) {
      d.cows.add(p.animalId)
      const cow = byCow.get(p.animalId) ?? { code: p.code ?? '', name: p.name ?? '', total: 0, days: new Set<string>() }
      cow.total += p.quantity
      cow.days.add(day)
      byCow.set(p.animalId, cow)
    } else if (p.cowsMilked) {
      // Manhã e tarde costumam ser as mesmas vacas: vale o maior número informado no dia
      d.cowsInTotal = Math.max(d.cowsInTotal, p.cowsMilked)
    }
    byDay.set(day, d)
  }

  const total = productions.reduce((s, p) => s + p.quantity, 0)
  const days = [...byDay.entries()]
  const sections: ReportSection[] = [{
    title: 'Por dia',
    columns: ['Data', 'Vacas ordenhadas', 'Total (L)'],
    numeric: [1, 2],
    rows: days.map(([day, d]) => { const cows = d.cows.size + d.cowsInTotal; return [fmtDate(day), cows || '—', fmtNumber(d.total)] }),
    footer: [`${days.length} dias`, days.length ? `Média ${fmtNumber(total / days.length)} L/dia` : '', fmtNumber(total)],
  }]

  if (byCow.size > 0) {
    const cows = [...byCow.values()].sort((a, b) => b.total - a.total)
    const cowsTotal = cows.reduce((s, c) => s + c.total, 0)
    sections.push({
      title: 'Por vaca',
      columns: ['Código', 'Vaca', 'Total (L)', 'Dias com registro', 'Média por dia (L)'],
      numeric: [2, 3, 4],
      rows: cows.map(c => [c.code, c.name, fmtNumber(c.total), c.days.size, fmtNumber(c.total / c.days.size)]),
      footer: ['', 'Total das vacas', fmtNumber(cowsTotal), '', ''],
    })
  }

  return { title: 'Produção de leite', subtitle: period.label, sections }
}

// ── Ficha do animal ────────────────────────────────────────────────────

interface AnimalRow {
  id: string; code: string; customCode: string | null; name: string; species: string; gender: string; birthDate: string; status: string
  isCastrated: number | null; gta: string | null; observations: string | null; motherId: string | null; lowDate: string | null; lowReason: string | null
}

const toCow = (a: AnimalRow): CowLike => ({ id: a.id, code: a.code, name: a.name, species: a.species, gender: a.gender, status: a.status, birthDate: a.birthDate, motherId: a.motherId })
const classified = (a: AnimalRow) => ({ species: a.species, gender: a.gender, birthDate: a.birthDate, isCastrated: !!a.isCastrated })

function animalReport(farmId: string, animalId: string | null): Report | null {
  if (!animalId) return null
  const a = one<AnimalRow>('SELECT * FROM animals WHERE id = ? AND farmId = ?', [animalId, farmId])
  if (!a) return null
  const vaccinations = all<{ vaccineName: string; scheduledDate: string; appliedDate: string | null; batch: string | null; manufacturer: string | null }>(
    'SELECT * FROM vaccinations WHERE animalId = ? ORDER BY scheduledDate DESC', [a.id])
  const treatments = all<{ medicine: string; startDate: string; endDate: string | null; batch: string | null; description: string | null }>(
    'SELECT * FROM treatments WHERE animalId = ? ORDER BY startDate DESC', [a.id])
  const reproductions = all<{ coverageDate: string; maleName: string | null; expectedBirthDate: string | null; actualBirthDate: string | null; status: string }>(
    'SELECT * FROM reproductions WHERE femaleId = ? ORDER BY coverageDate DESC', [a.id])
  const milk = all<{ date: string; quantity: number }>('SELECT date, quantity FROM milk WHERE animalId = ? ORDER BY date DESC', [a.id])
  const calves = all<AnimalRow>('SELECT * FROM animals WHERE motherId = ? ORDER BY birthDate ASC', [a.id])
  const mother = a.motherId ? one<{ name: string; code: string }>('SELECT name, code FROM animals WHERE id = ?', [a.motherId]) : null
  const calving = cowCalving(toCow(a), calves.map(toCow))

  const byMonth = new Map<string, number>()
  for (const p of milk) {
    const month = isoDay(p.date).slice(0, 7)
    byMonth.set(month, (byMonth.get(month) ?? 0) + p.quantity)
  }

  const data: [string, string][] = [
    ['Código', a.code],
    ...(a.customCode ? [['Outro código', a.customCode] as [string, string]] : []),
    ['Nome', a.name],
    ['Espécie', animalCategory(classified(a))],
    ['Sexo', a.gender],
    ['Nascimento', fmtDate(a.birthDate)],
    ['Idade', ageLabel(a.birthDate)],
    ['Situação', a.status],
    ['GTA', a.gta || '—'],
  ]
  if (mother) data.push(['Mãe', `${mother.name} (${mother.code})`])
  if (calves.length) {
    data.push(['Crias', `${calves.length} em ${calving.calvings} parto${calving.calvings === 1 ? '' : 's'}`])
    if (calving.averageInterval !== null) data.push(['Intervalo médio entre partos', `${calving.averageInterval} meses`])
  }
  if (a.lowDate) data.push(['Data da baixa', fmtDate(a.lowDate)], ['Motivo da baixa', a.lowReason || '—'])
  if (a.observations) data.push(['Observações', a.observations])

  return {
    title: `Ficha do animal: ${a.name} (${a.code})`,
    subtitle: `Emitido em ${today()}`,
    sections: [
      { title: 'Dados', columns: ['Campo', 'Valor'], rows: data },
      {
        title: 'Vacinas',
        columns: ['Vacina', 'Prevista', 'Aplicada', 'Lote', 'Fabricante'],
        rows: vaccinations.map(v => [v.vaccineName, fmtDate(v.scheduledDate), fmtDate(v.appliedDate), v.batch || '—', v.manufacturer || '—']),
      },
      {
        title: 'Tratamentos',
        columns: ['Medicamento', 'Início', 'Fim', 'Lote', 'Descrição'],
        rows: treatments.map(t => [t.medicine, fmtDate(t.startDate), fmtDate(t.endDate), t.batch || '—', t.description || '—']),
      },
      {
        title: 'Reprodução',
        columns: ['Cobertura', 'Reprodutor', 'Parto previsto', 'Parto', 'Situação'],
        rows: reproductions.map(r => [fmtDate(r.coverageDate), r.maleName || '—', fmtDate(r.expectedBirthDate), fmtDate(r.actualBirthDate), r.status]),
      },
      ...(calves.length ? [{
        title: 'Crias',
        columns: ['Nascimento', 'Código', 'Cria', 'Sexo', 'Situação'],
        rows: calves.map(c => [fmtDate(c.birthDate), c.code, c.name, c.gender === 'Fêmea' ? 'Bezerra' : 'Bezerro', c.status]),
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

function vaccinationReport(farmId: string, period: Period): Report {
  const vaccinations = all<{ code: string | null; name: string | null; vaccineName: string; scheduledDate: string; appliedDate: string | null; batch: string | null; manufacturer: string | null }>(
    `SELECT v.*, a.code, a.name FROM vaccinations v LEFT JOIN animals a ON a.id = v.animalId
     WHERE v.farmId = ? AND ((${inPeriod('v.scheduledDate')}) OR (${inPeriod('v.appliedDate')})) ORDER BY v.scheduledDate ASC`,
    [farmId, period.from, period.to, period.from, period.to],
  )
  const now = todayISO()
  const status = (v: (typeof vaccinations)[number]) => (v.appliedDate ? 'Aplicada' : isoDay(v.scheduledDate) < now ? 'Atrasada' : 'Pendente')
  const applied = vaccinations.filter(v => v.appliedDate).length
  return {
    title: 'Vacinação do rebanho',
    subtitle: period.label,
    sections: [{
      columns: ['Código', 'Animal', 'Vacina', 'Prevista', 'Aplicada', 'Lote', 'Fabricante', 'Situação'],
      rows: vaccinations.map(v => [v.code ?? '—', v.name ?? '—', v.vaccineName, fmtDate(v.scheduledDate), fmtDate(v.appliedDate), v.batch || '—', v.manufacturer || '—', status(v)]),
      footer: ['', `${vaccinations.length} registros`, '', '', `${applied} aplicadas`, '', '', `${vaccinations.length - applied} pendentes`],
    }],
  }
}

// ── Fluxo de caixa ─────────────────────────────────────────────────────

function financeReport(farmId: string, period: Period): Report {
  const transactions = all<{ date: string; type: string; category: string; amount: number; description: string | null; animalName: string | null }>(
    `SELECT t.*, a.name AS animalName FROM transactions t LEFT JOIN animals a ON a.id = t.animalId
     WHERE t.farmId = ? AND ${inPeriod('t.date')} ORDER BY t.date ASC`, [farmId, period.from, period.to],
  )
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
      { title: 'Resumo', columns: ['Receitas', 'Despesas', 'Saldo'], numeric: [0, 1, 2], rows: [[fmtMoney(income), fmtMoney(expense), fmtMoney(income - expense)]] },
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
        rows: transactions.map(t => [fmtDate(t.date), t.type, t.category, t.description || '—', t.animalName || '—', fmtMoney(t.type === 'Receita' ? t.amount : -t.amount)]),
        footer: ['', '', '', '', 'Saldo', fmtMoney(income - expense)],
      },
    ],
  }
}

// ── Inventário do rebanho ──────────────────────────────────────────────

function herdReport(farmId: string): Report {
  const records = all<AnimalRow>('SELECT * FROM animals WHERE farmId = ? ORDER BY species ASC, name COLLATE NOCASE ASC', [farmId])
  const animals = records.map(a => ({ ...a, species: animalCategory(classified(a)) }))
  const statuses = [...new Set(animals.map(a => a.status))].sort()
  const bySpecies = new Map<string, Map<string, number>>()
  for (const a of animals) {
    const m = bySpecies.get(a.species) ?? new Map<string, number>()
    m.set(a.status, (m.get(a.status) ?? 0) + 1)
    bySpecies.set(a.species, m)
  }
  return {
    title: 'Inventário do rebanho',
    subtitle: `Posição em ${today()}`,
    sections: [
      {
        title: 'Resumo por espécie',
        columns: ['Espécie', ...statuses, 'Total'],
        numeric: statuses.map((_, i) => i + 1).concat(statuses.length + 1),
        rows: [...bySpecies.entries()].map(([species, m]) => [species, ...statuses.map(s => m.get(s) ?? 0), [...m.values()].reduce((x, y) => x + y, 0)]),
        footer: ['Total', ...statuses.map(s => animals.filter(a => a.status === s).length), animals.length],
      },
      {
        title: 'Animais',
        columns: ['Código', 'Nome', 'Espécie', 'Sexo', 'Nascimento', 'Idade', 'Situação', 'GTA'],
        rows: animals.map(a => [a.customCode ? `${a.code} · ${a.customCode}` : a.code, a.name, a.species, a.gender, fmtDate(a.birthDate), ageLabel(a.birthDate), a.status, a.gta || '—']),
      },
    ],
  }
}

// ── Crias e partos ─────────────────────────────────────────────────────

function calvingReport(farmId: string): Report {
  const animals = all<AnimalRow>('SELECT * FROM animals WHERE farmId = ? ORDER BY name COLLATE NOCASE ASC', [farmId])
  const open = all<{ femaleId: string }>("SELECT femaleId FROM reproductions WHERE farmId = ? AND actualBirthDate IS NULL AND status IN ('Coberta', 'Prenha')", [farmId])
  const herd = animals.map(toCow)
  const stats = herdCalving(herd, new Set(open.map(r => r.femaleId)))
  const byId = new Map(animals.map(a => [a.id, a]))
  const calves = animals.filter(a => a.motherId).sort((a, b) => isoDay(a.birthDate).localeCompare(isoDay(b.birthDate)))
  const months = (n: number | null) => (n === null ? '—' : String(n))
  const late = stats.late.filter(l => l.reason === 'sem-parir')
  return {
    title: 'Crias e partos',
    subtitle: `Posição em ${today()}`,
    sections: [
      {
        title: 'Resumo',
        columns: ['Vacas', 'Crias anotadas', 'Intervalo médio entre partos (meses)', 'Idade média na 1ª cria (meses)', 'Demorando para criar'],
        numeric: [0, 1, 2, 3, 4],
        rows: [[stats.cows.length, calves.length, months(stats.averageInterval), months(stats.averageAgeAtFirst), late.length]],
      },
      {
        title: 'Por vaca',
        columns: ['Código', 'Vaca', 'Crias', 'Partos', 'Último parto', 'Meses desde o último', 'Intervalo médio (meses)', 'Idade na 1ª cria (meses)'],
        numeric: [2, 3, 5, 6, 7],
        rows: stats.cows.map(c => [c.cow.code, c.cow.name, c.calves, c.calvings, c.lastCalving ? fmtDate(c.lastCalving) : '—', months(c.monthsSinceLast), months(c.averageInterval), months(c.ageAtFirstCalving)]),
      },
      {
        title: `Demorando para criar (mais de ${LATE_MONTHS} meses sem parir, sem prenhez anotada)`,
        columns: ['Código', 'Vaca', 'Último parto', 'Meses sem parir'],
        numeric: [3],
        rows: late.map(({ stats: s }) => [s.cow.code, s.cow.name, fmtDate(s.lastCalving), months(s.monthsSinceLast)]),
      },
      {
        title: 'Crias',
        columns: ['Nascimento', 'Mãe', 'Código', 'Cria', 'Sexo', 'Situação'],
        rows: calves.map(c => [fmtDate(c.birthDate), byId.get(c.motherId!)?.name ?? '—', c.code, c.name, c.gender === 'Fêmea' ? 'Bezerra' : 'Bezerro', c.status]),
      },
    ],
  }
}

// ── Estoque ────────────────────────────────────────────────────────────

function stockReport(farmId: string, period: Period): Report {
  const movements = all<{ date: string; type: string; quantity: number; description: string | null; name: string | null; unit: string | null }>(
    `SELECT m.*, s.name, s.unit FROM supply_movements m LEFT JOIN supplies s ON s.id = m.supplyId
     WHERE m.farmId = ? AND ${inPeriod('m.date')} ORDER BY m.date ASC`, [farmId, period.from, period.to],
  )
  const supplies = all<{ name: string; category: string; currentQuantity: number; minimumQuantity: number; unit: string }>(
    'SELECT * FROM supplies WHERE farmId = ? ORDER BY name COLLATE NOCASE ASC', [farmId])
  return {
    title: 'Movimentação de estoque',
    subtitle: period.label,
    sections: [
      {
        title: 'Entradas e saídas',
        columns: ['Data', 'Item', 'Tipo', 'Quantidade', 'Unidade', 'Descrição'],
        numeric: [3],
        rows: movements.map(m => [fmtDate(m.date), m.name ?? '—', m.type, fmtNumber(m.quantity, 2), m.unit ?? '', m.description || '—']),
      },
      {
        title: 'Saldo atual',
        columns: ['Item', 'Categoria', 'Quantidade', 'Mínimo', 'Unidade', 'Situação'],
        numeric: [2, 3],
        rows: supplies.map(s => [s.name, s.category, fmtNumber(s.currentQuantity, 2), fmtNumber(s.minimumQuantity, 2), s.unit, s.currentQuantity <= s.minimumQuantity ? 'Repor' : 'OK']),
      },
    ],
  }
}
