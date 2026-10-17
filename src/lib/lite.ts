// Tipos e regras compartilhados do Anota Aí Leite (tela, API e fila offline)

export type PointKind = 'sitio' | 'tanque'

export interface LitePoint {
  id: string
  name: string
  kind: PointKind
  active: boolean
  /** Propriedade Pro ligada a este sítio da rota do motorista */
  farm?: { id: string; name: string; city: string | null; state: string | null } | null
  /** Ponto de coleta do laticínio (o motorista não edita; vem pronto nas rotas) */
  org?: { name: string } | null
  contactName?: string | null
  phone?: string | null
  address?: string | null
  accessNotes?: string | null
  /** Rotas do laticínio em que este ponto é parada, com a posição na sequência */
  routes?: { id: string; name: string; days: number[]; position: number }[]
}

/** Coleta do motorista num sítio ligado à propriedade (o produtor Pro vê) */
export interface LiteCollection {
  date: string
  liters: number
  driverName: string
  pointId: string
  pointName: string
}

/** No modo fazenda, o único "local" é a própria propriedade */
export const FARM_POINT_ID = 'fazenda'

export interface LiteEntry {
  pointId: string
  /** yyyy-mm-dd */
  date: string
  liters: number
  /** Coleta não realizada (laticínio): motivo; os litros ficam 0 */
  skipReason?: string | null
  note?: string | null
}

export interface LiteData {
  userName: string
  /** 'lite' (produtor) e 'motorista' usam só o Anota Aí Leite; outros perfis também têm o app completo */
  role: string
  /** "pessoal": locais próprios (produtor lite e motorista). "fazenda": grava na Produção de leite da propriedade (Pro) */
  mode: 'pessoal' | 'fazenda'
  /** Identifica a propriedade da fila para sincronizar também pela tela completa. */
  farmId?: string
  /** No modo fazenda, se pode anotar (editor/admin) ou só ver */
  canEdit: boolean
  points: LitePoint[]
  entries: LiteEntry[]
  /** Modo fazenda: coletas dos motoristas nos sítios ligados à propriedade */
  collections: LiteCollection[]
  /** Valor do litro informado (opcional), para estimar quanto vai receber */
  milkPrice: number | null
  /** Versão completa: animais com leite em carência de medicamento (não vai para o tanque) */
  milkWithdrawals?: { animalName: string; medicine: string; until: string }[]
  /** Produtor: litros da folha do motorista em cada coleta, para conferir (o motorista não usa) */
  sheets?: LiteSheet[]
  /** Motorista de laticínio: dia da semana de hoje (0 = domingo), para mostrar as rotas do dia */
  todayWeekday?: number
  /** Nomes da nota do laticínio (quem recebe uma parte do leite) e a divisão de cada coleta */
  payees?: LitePayee[]
  splits?: LiteSplit[]
}

/** Uma anotação a enviar: liters null apaga o valor daquele local no dia. */
export interface LiteChange {
  pointId: string
  date: string
  liters: number | null
  /** Coleta não realizada, com motivo (litros ficam 0) */
  skipReason?: string | null
  note?: string | null
}

/** Litros que a folha do motorista diz que ele levou numa coleta */
export interface LiteSheet {
  /** yyyy-mm-dd */
  date: string
  liters: number
}

/** Folha a enviar: liters null apaga a coleta daquele dia. */
export interface LiteSheetChange {
  date: string
  liters: number | null
}

/** Diferença entre a folha e a anotação, em %, a partir da qual a conferência chama atenção.
 *  Régua do tanque e balde nunca batem exato; diferença pequena é normal. */
export const SHEET_ALERT_PERCENT = 5

export interface SheetCheck {
  /** Dia da coleta */
  date: string
  /** Primeiro dia anotado que entra nesta coleta (o dia seguinte à coleta anterior) */
  from: string | null
  sheet: number
  /** Soma do que o produtor anotou de `from` até o dia da coleta; null na primeira coleta (não há início) */
  noted: number | null
  /** Folha menos anotado: negativo = a folha diz menos do que você anotou */
  diff: number | null
  percent: number | null
  alert: boolean
}

const nextDay = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}

/** Confere cada coleta: a folha contra o que foi anotado desde o dia seguinte à coleta anterior até o dia dela. */
export function checkSheets(sheets: LiteSheet[], entries: { date: string; liters: number }[]): SheetCheck[] {
  const byDay = new Map<string, number>()
  for (const e of entries) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.liters)
  const sorted = [...sheets].sort((a, b) => a.date.localeCompare(b.date))
  return sorted.map((s, i) => {
    const from = i > 0 ? nextDay(sorted[i - 1].date) : null
    if (!from) return { date: s.date, from, sheet: s.liters, noted: null, diff: null, percent: null, alert: false }
    let noted = 0
    for (const [day, liters] of byDay) if (day >= from && day <= s.date) noted += liters
    noted = Math.round(noted * 10) / 10
    const diff = Math.round((s.liters - noted) * 10) / 10
    const percent = noted > 0 ? Math.round((diff / noted) * 1000) / 10 : null
    // Sem anotação no período não há o que comparar; com anotação, chama atenção acima do limite
    const alert = noted > 0 && Math.abs(diff / noted) * 100 > SHEET_ALERT_PERCENT
    return { date: s.date, from, sheet: s.liters, noted, diff, percent, alert }
  }).reverse()
}

// ── Nota do laticínio com mais de um nome ───────────────────────────────
// O mesmo tanque pode gerar mais de uma nota (dois produtores cadastrados no laticínio).
// O produtor anota o total do dia como sempre; no dia da coleta diz quanto vai para cada nome.

export interface LitePayee {
  id: string
  /** Local do Anota Aí Leite; no modo fazenda é FARM_POINT_ID */
  pointId: string
  name: string
  /** Código do produtor no laticínio */
  producerCode: string | null
  /** Sequência na folha de coleta */
  sequence: string | null
  active: boolean
  position: number
}

/** Litros de um nome numa coleta */
export interface LiteSplit {
  payeeId: string
  /** yyyy-mm-dd, dia da coleta */
  date: string
  liters: number
}

/** Divisão a enviar: liters null apaga a parte daquele nome no dia. */
export interface LiteSplitChange {
  payeeId: string
  date: string
  liters: number | null
}

/** Dias em que houve divisão da nota num local */
export function splitDates(splits: LiteSplit[], payees: LitePayee[], pointId: string): string[] {
  const ids = new Set(payees.filter((p) => p.pointId === pointId).map((p) => p.id))
  return [...new Set(splits.filter((s) => ids.has(s.payeeId)).map((s) => s.date))].sort()
}

/** Litros anotados no local desde a coleta anterior (dia seguinte a ela) até o dia da coleta.
 *  Sem coleta anterior anotada, conta só o dia. O produtor pode corrigir o total na tela. */
export function litersSinceLastSplit(entries: { pointId: string; date: string; liters: number }[], splits: LiteSplit[], payees: LitePayee[], pointId: string, date: string): { liters: number; from: string } {
  const previous = splitDates(splits, payees, pointId).filter((d) => d < date).pop()
  const from = previous ? nextDay(previous) : date
  let liters = 0
  for (const e of entries) if (e.pointId === pointId && e.date >= from && e.date <= date) liters += e.liters
  return { liters: Math.round(liters * 10) / 10, from }
}

/** Divisão da coleta anterior do local (para sugerir a mesma proporção) */
export function lastSplit(splits: LiteSplit[], payees: LitePayee[], pointId: string, before: string): LiteSplit[] {
  const previous = splitDates(splits, payees, pointId).filter((d) => d < before).pop()
  if (!previous) return []
  const ids = new Set(payees.filter((p) => p.pointId === pointId).map((p) => p.id))
  return splits.filter((s) => s.date === previous && ids.has(s.payeeId))
}

/** Reparte o total entre os nomes. Com proporções (da última coleta) usa-as; sem, divide igual.
 *  Arredonda a 0,1 L e deixa a diferença no último nome, para a soma bater sempre com o total. */
export function suggestSplit(total: number, payees: LitePayee[], proportions: { payeeId: string; liters: number }[] = []): Record<string, number> {
  const result: Record<string, number> = {}
  if (!payees.length) return result
  const base = proportions.filter((p) => payees.some((x) => x.id === p.payeeId))
  const baseTotal = base.reduce((s, p) => s + p.liters, 0)
  let given = 0
  payees.forEach((p, i) => {
    const share = baseTotal > 0 ? (base.find((b) => b.payeeId === p.id)?.liters ?? 0) / baseTotal : 1 / payees.length
    const liters = i === payees.length - 1 ? Math.round((total - given) * 10) / 10 : Math.round(total * share * 10) / 10
    result[p.id] = Math.max(0, liters)
    given += result[p.id]
  })
  return result
}

/** Total de cada nome num período (o que cada um vai receber do laticínio) */
export function totalsByPayee(splits: LiteSplit[], from: string, to: string): Map<string, number> {
  const totals = new Map<string, number>()
  for (const s of splits) if (s.date >= from && s.date <= to) totals.set(s.payeeId, Math.round(((totals.get(s.payeeId) ?? 0) + s.liters) * 10) / 10)
  return totals
}

export const KIND_LABEL: Record<PointKind, string> = { sitio: 'Sítio', tanque: 'Tanque comunitário' }

/** Quantos dias de histórico o app guarda no aparelho */
export const LITE_HISTORY_DAYS = 90

export function parseLiters(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = typeof value === 'number' ? value : parseFloat(String(value).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 10) / 10 : null
}

/** Motorista anota a rota (vários locais); os demais anotam a própria produção. */
export function isDriverRole(role: string | undefined) {
  return role === 'motorista'
}

/** Perfis que usam só o Anota Aí Leite, sem o app completo */
export function isLiteOnlyRole(role: string | undefined) {
  return role === 'lite' || role === 'motorista'
}

/** Quem tem propriedade (versão Pro) anota direto na Produção de leite dela, não em locais próprios. */
export function usesFarmMode(user: { role: string; effectiveFarmId: string | null }) {
  return !isLiteOnlyRole(user.role) && !!user.effectiveFarmId
}
