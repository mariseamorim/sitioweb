// Indicadores de reprodução de uma propriedade: partos previstos por mês, taxa de prenhez por mês da cobertura,
// leite por mês e as frases de destaque. Só contas, sem banco: o site calcula no servidor e o aplicativo no aparelho
// (cópia idêntica em mobile/src/lib/reproInsights.ts — ao mudar um, mude o outro).

export interface CoverageRow {
  coverageDate: string
  status: string
  expectedBirthDate: string | null
  actualBirthDate: string | null
}

export interface MonthCount { month: string; count: number }
export interface MonthRate { month: string; diagnosed: number; pregnant: number; rate: number | null }
export interface MonthLiters { month: string; liters: number }

export interface Indicators {
  /** Partos previstos: mês atual e os 5 seguintes */
  births: MonthCount[]
  /** Últimos 12 meses pela data da cobertura: das diagnosticadas, quantas ficaram prenhas */
  pregnancy: MonthRate[]
  /** Litros por mês nos últimos 12 meses; null = sem acesso ao leite ou nada anotado */
  milk: MonthLiters[] | null
  /** Prenhez nos 12 meses, em %; null sem nenhum diagnóstico */
  rate12: number | null
  /** Coberturas ainda sem diagnóstico */
  awaiting: number
  insights: string[]
  /** Os mesmos destaques como modelo em português + variáveis, para a tela traduzir (t(text, vars)).
   *  Variáveis month, from e to são meses "AAAA-MM": a tela troca pelo nome do mês no idioma dela. */
  insightItems?: InsightItem[]
}

export interface InsightItem { text: string; vars?: Record<string, string | number> }

/** A perdida estava prenha quando foi diagnosticada */
const PREGNANT = ['Prenha', 'Parida', 'Perdida']
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
const DAY = 24 * 60 * 60 * 1000
/** Depois disso a cobertura já devia ter diagnóstico */
const LATE_DIAGNOSIS_DAYS = 45

const monthOf = (iso: string) => iso.slice(0, 7)

/** "2026-11" + 2 = "2027-01" */
export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number)
  const total = y * 12 + (m - 1) + delta
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

/** "2026-11" → "novembro" (ou "noviembre" com lang 'es') */
export const monthName = (month: string, lang: 'pt' | 'es' = 'pt') => (lang === 'es' ? MONTHS_ES : MONTHS)[Number(month.slice(5, 7)) - 1] ?? month
/** "2026-11" → "nov"; janeiro leva o ano ("jan/27") para marcar a virada */
export function monthShort(month: string, lang: 'pt' | 'es' = 'pt'): string {
  const name = monthName(month, lang).slice(0, 3)
  return month.endsWith('-01') ? `${name}/${month.slice(2, 4)}` : name
}

const percent = (part: number, whole: number) => (whole ? Math.round((part / whole) * 100) : null)

export function buildIndicators(coverages: CoverageRow[], milkByMonth: MonthLiters[] | null, today: string): Indicators {
  const current = monthOf(today)

  const birthMonths = Array.from({ length: 6 }, (_, i) => addMonths(current, i))
  const open = coverages.filter((c) => (c.status === 'Coberta' || c.status === 'Prenha') && !c.actualBirthDate && !!c.expectedBirthDate)
  const births = birthMonths.map((month) => ({ month, count: open.filter((c) => monthOf(c.expectedBirthDate!) === month).length }))

  const rateMonths = Array.from({ length: 12 }, (_, i) => addMonths(current, i - 11))
  const pregnancy = rateMonths.map((month) => {
    const diagnosed = coverages.filter((c) => monthOf(c.coverageDate) === month && c.status !== 'Coberta')
    const pregnant = diagnosed.filter((c) => PREGNANT.includes(c.status)).length
    return { month, diagnosed: diagnosed.length, pregnant, rate: percent(pregnant, diagnosed.length) }
  })
  const diagnosed12 = pregnancy.reduce((sum, m) => sum + m.diagnosed, 0)
  const rate12 = percent(pregnancy.reduce((sum, m) => sum + m.pregnant, 0), diagnosed12)

  const waiting = coverages.filter((c) => c.status === 'Coberta')
  const milk = milkByMonth && milkByMonth.some((m) => m.liters > 0)
    ? rateMonths.map((month) => ({ month, liters: Math.round(milkByMonth.find((m) => m.month === month)?.liters ?? 0) }))
    : null

  // Cada destaque é um modelo em português com variáveis: vira o texto pronto (insights) e o item para traduzir
  const items: InsightItem[] = []
  const add = (text: string, vars?: InsightItem['vars']) => items.push({ text, vars })

  const peak = births.reduce((best, m) => (m.count > best.count ? m : best), births[0])
  if (peak.count > 0) {
    const total = births.reduce((sum, m) => sum + m.count, 0)
    if (total === peak.count) add(peak.count === 1 ? '{n} parto previsto para {month}.' : '{n} partos previstos para {month}.', { n: peak.count, month: peak.month })
    else add('Maior concentração de partos em {month}: {n} dos {total} previstos nos próximos 6 meses.', { month: peak.month, n: peak.count, total })
  } else {
    add('Nenhum parto previsto nos próximos 6 meses.')
  }

  // Tendência da prenhez: os 3 meses mais recentes com diagnóstico contra os 3 anteriores
  const withRate = pregnancy.filter((m) => m.diagnosed > 0)
  if (withRate.length >= 4) {
    const rateOf = (months: MonthRate[]) => percent(months.reduce((s, m) => s + m.pregnant, 0), months.reduce((s, m) => s + m.diagnosed, 0))!
    const recent = rateOf(withRate.slice(-3))
    const before = rateOf(withRate.slice(-6, -3))
    if (Math.abs(recent - before) >= 10) {
      add(recent < before ? 'A taxa de concepção caiu de {before}% para {recent}% nas coberturas mais recentes.' : 'A taxa de concepção subiu de {before}% para {recent}% nas coberturas mais recentes.', { before, recent })
    }
  }

  const late = waiting.filter((c) => (Date.parse(today) - Date.parse(c.coverageDate.slice(0, 10))) / DAY > LATE_DIAGNOSIS_DAYS).length
  if (late > 0) add(late === 1 ? '{n} cobertura com mais de {days} dias ainda sem diagnóstico de gestação.' : '{n} coberturas com mais de {days} dias ainda sem diagnóstico de gestação.', { n: late, days: LATE_DIAGNOSIS_DAYS })

  // Leite: os dois últimos meses fechados (o mês atual ainda está pela metade)
  if (milk) {
    const last = milk[milk.length - 2]
    const previous = milk[milk.length - 3]
    if (last && previous && previous.liters > 0 && last.liters > 0) {
      const change = Math.round(((last.liters - previous.liters) / previous.liters) * 100)
      if (Math.abs(change) >= 10) add(change < 0 ? 'A produção de leite caiu {pct}% de {from} para {to}.' : 'A produção de leite subiu {pct}% de {from} para {to}.', { pct: Math.abs(change), from: previous.month, to: last.month })
    }
  }

  const insights = items.map((i) => fillInsight(i, (m) => monthName(m)))
  return { births, pregnancy, milk, rate12, awaiting: waiting.length, insights, insightItems: items }
}

const MONTH_VARS = ['month', 'from', 'to']
/** Monta o texto de um destaque: o modelo (já traduzido ou não) com as variáveis, e os meses pelo nome. */
export function fillInsight(item: InsightItem, month: (m: string) => string, template = item.text): string {
  const vars = item.vars ?? {}
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? (MONTH_VARS.includes(k) ? month(String(vars[k])) : String(vars[k])) : m))
}
