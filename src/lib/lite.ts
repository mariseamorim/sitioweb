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
  /** Produtor: litros da folha do motorista em cada coleta, para conferir (o motorista não usa) */
  sheets?: LiteSheet[]
  /** Motorista de laticínio: dia da semana de hoje (0 = domingo), para mostrar as rotas do dia */
  todayWeekday?: number
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
