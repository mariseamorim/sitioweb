// Tipos e regras compartilhados do Anota Aí Leite (tela, API e fila offline)

export type PointKind = 'sitio' | 'tanque'

export interface LitePoint {
  id: string
  name: string
  kind: PointKind
  active: boolean
}

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
  points: LitePoint[]
  entries: LiteEntry[]
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
