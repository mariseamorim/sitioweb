// Resumo do Painel por período: o mês atual e o ano, mês a mês. Regras puras (sem banco).
// As datas dos lançamentos ficam gravadas à meia-noite UTC, então o mês é lido em UTC.

export interface PeriodInput {
  transactions: { type: string; amount: number; date: string | Date }[]
  milk: { quantity: number; date: string | Date }[]
  births: { date: string | Date }[]
  /** Preço do litro cadastrado na propriedade, para estimar o valor do leite */
  milkPrice: number | null
}

export interface PeriodTotals {
  liters: number
  /** Litros × preço do litro (null sem preço cadastrado) */
  milkValue: number | null
  income: number
  expense: number
  balance: number
  births: number
}

export interface MonthTotals extends PeriodTotals { month: string; label: string }

export interface PeriodSummary {
  month: PeriodTotals & { label: string }
  year: PeriodTotals & { label: string; months: MonthTotals[] }
}

export const MONTHS_PT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const MONTHS_LONG = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

const round1 = (n: number) => Math.round(n * 10) / 10
const round2 = (n: number) => Math.round(n * 100) / 100
const monthOf = (d: string | Date) => (typeof d === 'string' ? d : d.toISOString()).slice(0, 7)

/** Limites do ano no banco (datas em UTC): de 1º de janeiro a 31 de dezembro */
export function yearBounds(now: Date): { start: Date; end: Date } {
  const y = now.getFullYear()
  return { start: new Date(Date.UTC(y, 0, 1)), end: new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999)) }
}

function totals(input: PeriodInput, keep: (month: string) => boolean): PeriodTotals {
  const liters = round1(input.milk.filter((m) => keep(monthOf(m.date))).reduce((s, m) => s + m.quantity, 0))
  const tx = input.transactions.filter((t) => keep(monthOf(t.date)))
  const income = round2(tx.filter((t) => t.type === 'Receita').reduce((s, t) => s + t.amount, 0))
  const expense = round2(tx.filter((t) => t.type !== 'Receita').reduce((s, t) => s + t.amount, 0))
  return {
    liters,
    milkValue: input.milkPrice ? round2(liters * input.milkPrice) : null,
    income,
    expense,
    balance: round2(income - expense),
    births: input.births.filter((b) => keep(monthOf(b.date))).length,
  }
}

/** Mês atual e ano com os meses até o atual (os futuros ficam de fora) */
export function summarizePeriod(input: PeriodInput, now: Date): PeriodSummary {
  const y = now.getFullYear()
  const m = now.getMonth()
  const key = (i: number) => `${y}-${String(i + 1).padStart(2, '0')}`
  const months: MonthTotals[] = []
  for (let i = 0; i <= m; i++) months.push({ month: key(i), label: MONTHS_PT[i], ...totals(input, (k) => k === key(i)) })
  return {
    month: { label: `${MONTHS_LONG[m]} de ${y}`, ...totals(input, (k) => k === key(m)) },
    year: { label: String(y), months, ...totals(input, (k) => k.startsWith(`${y}-`)) },
  }
}
