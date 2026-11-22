// Resultado do leite e gastos fora do normal (sem banco: usado pelo servidor e pelo app).
// Cópia de src/lib/milkResult.ts do site.
//
// Resultado do leite por mês:
// - litros: tudo o que foi anotado na produção de leite;
// - receita: lançamentos "Venda de Leite"; sem nenhum no mês, estimada pelos litros × preço do litro anotado;
// - custos: as despesas do mês, menos as ligadas a um lote de recria/engorda (são do gado de corte);
// - custo por litro = custos ÷ litros; sobra por litro = (receita − custos) ÷ litros.
//
// Gasto acima do normal: cada categoria de despesa do mês atual comparada com a média dos 3 meses anteriores.

export const MILK_SALE = 'Venda de Leite'

export interface ResultTransaction { type: string; category: string; date: string; amount: number; lotId?: string | null }
export interface ResultMilk { date: string; quantity: number; pricePerLiter?: number | null }

export interface MilkMonth {
  /** "AAAA-MM" */
  month: string
  liters: number
  revenue: number
  /** Sem venda de leite lançada: receita estimada pelo preço do litro */
  revenueEstimated: boolean
  costs: number
  /** Receita − custos */
  result: number
  costPerLiter: number | null
  marginPerLiter: number | null
}

const monthOf = (date: string) => date.slice(0, 7)
const round2 = (n: number) => Math.round(n * 100) / 100

/** Os `n` meses até o de `today` (o mais antigo primeiro) */
export function lastMonths(today: string, n: number): string[] {
  const [y, m] = today.slice(0, 7).split('-').map(Number)
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1))
    return d.toISOString().slice(0, 7)
  })
}

/** Despesa que conta como custo do leite: não está ligada a um lote de recria/engorda */
export const isMilkCost = (t: ResultTransaction) => t.type === 'Despesa' && !t.lotId

export function milkResultByMonth(transactions: ResultTransaction[], milk: ResultMilk[], months: string[]): MilkMonth[] {
  return months.map((month) => {
    const ownMilk = milk.filter((m) => monthOf(m.date) === month)
    const liters = ownMilk.reduce((s, m) => s + m.quantity, 0)
    const own = transactions.filter((t) => monthOf(t.date) === month)
    const sales = own.filter((t) => t.type === 'Receita' && t.category === MILK_SALE)
    const estimated = ownMilk.reduce((s, m) => s + m.quantity * (m.pricePerLiter ?? 0), 0)
    const revenueEstimated = !sales.length && estimated > 0
    const revenue = round2(sales.length ? sales.reduce((s, t) => s + t.amount, 0) : estimated)
    const costs = round2(own.filter(isMilkCost).reduce((s, t) => s + t.amount, 0))
    const result = round2(revenue - costs)
    return {
      month, liters: Math.round(liters * 10) / 10, revenue, revenueEstimated, costs, result,
      costPerLiter: liters > 0 && costs > 0 ? round2(costs / liters) : null,
      marginPerLiter: liters > 0 && (revenue > 0 || costs > 0) ? round2(result / liters) : null,
    }
  })
}

export interface SpendingAlert {
  category: string
  /** Gasto da categoria no mês atual (até hoje) */
  current: number
  /** Média dos 3 meses anteriores */
  average: number
  /** Quanto passou da média, em % */
  percent: number
}

/** A partir de quanto acima da média vira aviso */
export const ALERT_PERCENT = 30
/** Diferenças pequenas não avisam */
const ALERT_MIN_DIFF = 200

/**
 * Categorias de despesa que no mês atual já passaram da média dos 3 meses anteriores em 30% ou mais
 * (e pelo menos R$ 200). Precisa de despesa da categoria em pelo menos 2 dos 3 meses, para a média valer.
 */
export function spendingAlerts(transactions: ResultTransaction[], today: string): SpendingAlert[] {
  const [prev3, prev2, prev1, current] = lastMonths(today, 4)
  const before = [prev3, prev2, prev1]
  const byCat = new Map<string, Map<string, number>>()
  for (const t of transactions) {
    if (t.type !== 'Despesa' || t.date.slice(0, 10) > today) continue
    const month = monthOf(t.date)
    if (month !== current && !before.includes(month)) continue
    const m = byCat.get(t.category) ?? new Map<string, number>()
    m.set(month, (m.get(month) ?? 0) + t.amount)
    byCat.set(t.category, m)
  }
  const alerts: SpendingAlert[] = []
  for (const [category, m] of byCat) {
    const past = before.map((mo) => m.get(mo) ?? 0)
    if (past.filter((v) => v > 0).length < 2) continue
    const average = past.reduce((s, v) => s + v, 0) / 3
    const now = m.get(current) ?? 0
    if (average <= 0 || now - average < ALERT_MIN_DIFF) continue
    const percent = Math.round(((now - average) / average) * 100)
    if (percent >= ALERT_PERCENT) alerts.push({ category, current: round2(now), average: round2(average), percent })
  }
  return alerts.sort((a, b) => b.current - b.average - (a.current - a.average))
}
