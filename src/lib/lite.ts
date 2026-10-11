// Tipos e regras compartilhados do Anota Aí Leite (tela, API e fila offline)

export type PointKind = 'sitio' | 'tanque'

export interface LitePoint {
  id: string
  name: string
  kind: PointKind
  active: boolean
  /** Propriedade Pro ligada a este sítio da rota do motorista */
  farm?: { id: string; name: string; city: string | null; state: string | null } | null
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
}

export interface LiteData {
  userName: string
  /** 'lite' (produtor) e 'motorista' usam só o Anota Aí Leite; outros perfis também têm o app completo */
  role: string
  /** "pessoal": locais próprios (produtor lite e motorista). "fazenda": grava na Produção de leite da propriedade (Pro) */
  mode: 'pessoal' | 'fazenda'
  /** No modo fazenda, se pode anotar (editor/admin) ou só ver */
  canEdit: boolean
  points: LitePoint[]
  entries: LiteEntry[]
  /** Modo fazenda: coletas dos motoristas nos sítios ligados à propriedade */
  collections: LiteCollection[]
  /** Valor do litro informado (opcional), para estimar quanto vai receber */
  milkPrice: number | null
}

/** Uma anotação a enviar: liters null apaga o valor daquele local no dia. */
export interface LiteChange {
  pointId: string
  date: string
  liters: number | null
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
