// Dados do painel do laticínio (resposta de GET /api/laticinio)

export interface Driver { id: string; name: string; email: string; phone: string | null; vehicle: string | null }

export interface Point {
  id: string
  name: string
  kind: 'sitio' | 'tanque'
  active: boolean
  contactName: string | null
  phone: string | null
  address: string | null
  tankLiters: number | null
  accessNotes: string | null
}

export interface Route {
  id: string
  name: string
  days: number[]
  driverId: string | null
  active: boolean
  stops: { pointId: string; position: number }[]
}

export interface Entry {
  pointId: string
  date: string
  liters: number
  skipReason: string | null
  note: string | null
  collectedAt: string | null
  collectedBy: { id: string; name: string } | null
}

export interface Reception { id: string; date: string; routeId: string | null; liters: number; note: string | null }

export interface TodayStop {
  routeId: string
  routeName: string
  driverName: string | null
  pointId: string
  pointName: string
  position: number
  status: 'pendente' | 'coletado' | 'nao-coletado'
  liters: number | null
  skipReason: string | null
}

export interface DairyPanel {
  organization: { id: string; name: string; status: 'pendente' | 'aprovado' | 'bloqueado' }
  period: { from: string; to: string }
  today: string
  drivers: Driver[]
  points: Point[]
  routes: Route[]
  entries: Entry[]
  receptions: Reception[]
  todayStops: TodayStop[]
}

export const field = 'mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
export const fmtL = (n: number) => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} L`
export const fmtDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00Z`).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

/** Envia JSON e devolve { ok, data } com a mensagem de erro do servidor quando houver */
export async function send(url: string, method: string, body?: unknown): Promise<{ ok: boolean; data: { error?: string } & Record<string, unknown> }> {
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    return { ok: res.ok, data: await res.json().catch(() => ({})) }
  } catch {
    return { ok: false, data: { error: 'Sem conexão. Tente de novo.' } }
  }
}
