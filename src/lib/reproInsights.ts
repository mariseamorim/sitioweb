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
}

/** A perdida estava prenha quando foi diagnosticada */
const PREGNANT = ['Prenha', 'Parida', 'Perdida']
const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
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

/** "2026-11" → "novembro" */
export const monthName = (month: string) => MONTHS[Number(month.slice(5, 7)) - 1] ?? month
/** "2026-11" → "nov"; janeiro leva o ano ("jan/27") para marcar a virada */
export function monthShort(month: string): string {
  const name = monthName(month).slice(0, 3)
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

  const insights: string[] = []

  const peak = births.reduce((best, m) => (m.count > best.count ? m : best), births[0])
  if (peak.count > 0) {
    const total = births.reduce((sum, m) => sum + m.count, 0)
    insights.push(total === peak.count
      ? `${peak.count} ${peak.count === 1 ? 'parto previsto' : 'partos previstos'} para ${monthName(peak.month)}.`
      : `Maior concentração de partos em ${monthName(peak.month)}: ${peak.count} dos ${total} previstos nos próximos 6 meses.`)
  } else {
    insights.push('Nenhum parto previsto nos próximos 6 meses.')
  }

  // Tendência da prenhez: os 3 meses mais recentes com diagnóstico contra os 3 anteriores
  const withRate = pregnancy.filter((m) => m.diagnosed > 0)
  if (withRate.length >= 4) {
    const rateOf = (months: MonthRate[]) => percent(months.reduce((s, m) => s + m.pregnant, 0), months.reduce((s, m) => s + m.diagnosed, 0))!
    const recent = rateOf(withRate.slice(-3))
    const before = rateOf(withRate.slice(-6, -3))
    if (Math.abs(recent - before) >= 10) {
      insights.push(`A taxa de concepção ${recent < before ? 'caiu' : 'subiu'} de ${before}% para ${recent}% nas coberturas mais recentes.`)
    }
  }

  const late = waiting.filter((c) => (Date.parse(today) - Date.parse(c.coverageDate.slice(0, 10))) / DAY > LATE_DIAGNOSIS_DAYS).length
  if (late > 0) insights.push(`${late} ${late === 1 ? 'cobertura com' : 'coberturas com'} mais de ${LATE_DIAGNOSIS_DAYS} dias ainda sem diagnóstico de gestação.`)

  // Leite: os dois últimos meses fechados (o mês atual ainda está pela metade)
  if (milk) {
    const last = milk[milk.length - 2]
    const previous = milk[milk.length - 3]
    if (last && previous && previous.liters > 0 && last.liters > 0) {
      const change = Math.round(((last.liters - previous.liters) / previous.liters) * 100)
      if (Math.abs(change) >= 10) insights.push(`A produção de leite ${change < 0 ? 'caiu' : 'subiu'} ${Math.abs(change)}% de ${monthName(previous.month)} para ${monthName(last.month)}.`)
    }
  }

  return { births, pregnancy, milk, rate12, awaiting: waiting.length, insights }
}
