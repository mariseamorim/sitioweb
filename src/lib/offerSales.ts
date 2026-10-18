// Vendas por oferta do fornecedor: contatos (clique no WhatsApp), vendas confirmadas e perdidas,
// ranking das ofertas que mais venderam e totais por mês. Sem rede e sem banco.

export type ContactStatus = 'contato' | 'venda' | 'perdido'

export interface OfferContactRow {
  id: string
  promotionId: string
  status: ContactStatus | string
  source: string
  saleValue: number | null
  quantity: number | null
  soldAt: string | Date | null
  createdAt: string | Date
}

export interface OfferRow {
  id: string
  title: string
  category: string
  price: number | null
  unit: string | null
}

export interface ClosedRequestRow { status: string; replyPrice: number | null; updatedAt: string | Date }

/** Período fechado nos dois lados, dias no formato AAAA-MM-DD */
export interface DayRange { from: string; to: string }

export interface OfferSales {
  id: string
  title: string
  category: string
  price: number | null
  unit: string | null
  contacts: number
  sales: number
  lost: number
  /** Vendas ÷ contatos, de 0 a 100 (null sem contato no período) */
  rate: number | null
  revenue: number
  quantity: number
}

export interface MonthSales { month: string; contacts: number; sales: number; revenue: number }

export interface SalesReport {
  range: DayRange
  totals: { contacts: number; sales: number; lost: number; rate: number | null; revenue: number }
  /** Da que mais vendeu para a que menos vendeu; só ofertas com algum movimento no período */
  byOffer: OfferSales[]
  byMonth: MonthSales[]
  /** Pedidos de orçamento marcados como atendidos no período (vendas fora das ofertas) */
  requestsClosed: { count: number; value: number }
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
export const dayOf = (d: string | Date) => (typeof d === 'string' ? d : d.toISOString()).slice(0, 10)
const round2 = (n: number) => Math.round(n * 100) / 100

/** Dia que conta para o período: a venda pelo dia em que fechou, o resto pelo dia do contato */
export const effectiveDay = (c: Pick<OfferContactRow, 'status' | 'soldAt' | 'createdAt'>) =>
  dayOf(c.status === 'venda' && c.soldAt ? c.soldAt : c.createdAt)

export const inRange = (day: string, range: DayRange) => day >= range.from && day <= range.to

/** Valida o período; sem informar, o mês atual (pelo relógio de quem pede) */
export function parseRange(from: unknown, to: unknown, now = new Date()): DayRange | null {
  if (from === undefined && to === undefined) {
    const y = now.getFullYear(), m = now.getMonth()
    const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
    const last = new Date(y, m + 1, 0).getDate()
    return { from: start, to: `${y}-${String(m + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}` }
  }
  if (typeof from !== 'string' || typeof to !== 'string' || !DAY.test(from) || !DAY.test(to) || from > to) return null
  return { from, to }
}

export function buildSalesReport(offers: OfferRow[], contacts: OfferContactRow[], requests: ClosedRequestRow[], range: DayRange): SalesReport {
  const inPeriod = contacts.filter((c) => inRange(effectiveDay(c), range))
  const byOffer = offers
    .map((o) => {
      const mine = inPeriod.filter((c) => c.promotionId === o.id)
      const sold = mine.filter((c) => c.status === 'venda')
      const contactsCount = mine.length
      return {
        id: o.id, title: o.title, category: o.category, price: o.price, unit: o.unit,
        contacts: contactsCount,
        sales: sold.length,
        lost: mine.filter((c) => c.status === 'perdido').length,
        rate: contactsCount ? Math.round((sold.length / contactsCount) * 100) : null,
        revenue: round2(sold.reduce((s, c) => s + (c.saleValue ?? 0), 0)),
        quantity: round2(sold.reduce((s, c) => s + (c.quantity ?? 0), 0)),
      }
    })
    .filter((o) => o.contacts > 0)
    .sort((a, b) => b.sales - a.sales || b.revenue - a.revenue || b.contacts - a.contacts || a.title.localeCompare(b.title, 'pt-BR'))

  const months = new Map<string, MonthSales>()
  for (const c of inPeriod) {
    const month = effectiveDay(c).slice(0, 7)
    const row = months.get(month) ?? { month, contacts: 0, sales: 0, revenue: 0 }
    row.contacts++
    if (c.status === 'venda') { row.sales++; row.revenue = round2(row.revenue + (c.saleValue ?? 0)) }
    months.set(month, row)
  }

  const sales = inPeriod.filter((c) => c.status === 'venda')
  const closed = requests.filter((r) => r.status === 'fechado' && inRange(dayOf(r.updatedAt), range))
  return {
    range,
    totals: {
      contacts: inPeriod.length,
      sales: sales.length,
      lost: inPeriod.filter((c) => c.status === 'perdido').length,
      rate: inPeriod.length ? Math.round((sales.length / inPeriod.length) * 100) : null,
      revenue: round2(sales.reduce((s, c) => s + (c.saleValue ?? 0), 0)),
    },
    byOffer,
    byMonth: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
    requestsClosed: { count: closed.length, value: round2(closed.reduce((s, r) => s + (r.replyPrice ?? 0), 0)) },
  }
}

/** "1.250,50" (milhar com ponto), "12,5" ou "12.5"; vazio = null; inválido = undefined */
export function parseMoney(raw: unknown): number | null | undefined {
  if (raw === null || raw === undefined) return null
  const text = String(raw).trim()
  if (!text) return null
  const n = Number(text.includes(',') ? text.replace(/\./g, '').replace(',', '.') : text)
  return Number.isFinite(n) && n >= 0 ? round2(n) : undefined
}

export interface SaleInput { saleValue: number | null; quantity: number | null; soldAt: string; buyerName: string | null; note: string | null }

/** Dados de uma venda (confirmada a partir de um contato ou registrada à mão). Devolve a mensagem do erro. */
export function parseSale(body: Record<string, unknown>, today: string): SaleInput | string {
  const saleValue = parseMoney(body.saleValue)
  if (saleValue === undefined) return 'Valor inválido'
  const quantity = parseMoney(body.quantity)
  if (quantity === undefined) return 'Quantidade inválida'
  const soldAt = body.soldAt === undefined || body.soldAt === null || body.soldAt === '' ? today : String(body.soldAt).slice(0, 10)
  if (!DAY.test(soldAt) || Number.isNaN(new Date(`${soldAt}T00:00:00Z`).getTime())) return 'Data inválida'
  if (soldAt > today) return 'A data da venda não pode ser no futuro'
  const buyerName = typeof body.buyerName === 'string' && body.buyerName.trim() ? body.buyerName.trim().slice(0, 120) : null
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 500) : null
  return { saleValue, quantity, soldAt, buyerName, note }
}
