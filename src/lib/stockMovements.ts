// Regras das movimentações de estoque (entrada e saída), sem rede e sem banco.
// Usadas pela rota da API e pela tela, que salva sozinha enquanto a pessoa preenche.

export type MovementType = 'Entrada' | 'Saída'

export interface MovementInput {
  type: MovementType
  quantity: number
  /** Dia no formato AAAA-MM-DD */
  date: string
  description: string | null
}

/** Movimentação guardada no aparelho enquanto não há internet */
export interface PendingMovement extends MovementInput {
  supplyId: string
  farmId: string
  _pendingId: number
}

const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Valida o que veio do formulário ou da API. Devolve null quando falta algo. */
export function parseMovement(body: unknown): MovementInput | null {
  if (!body || typeof body !== 'object') return null
  const { type, quantity, date, description } = body as Record<string, unknown>
  if (type !== 'Entrada' && type !== 'Saída') return null
  const qty = typeof quantity === 'number' ? quantity : Number(String(quantity ?? '').trim().replace(',', '.'))
  if (!Number.isFinite(qty) || qty <= 0) return null
  const day = typeof date === 'string' ? date.slice(0, 10) : ''
  if (!DAY.test(day) || Number.isNaN(new Date(`${day}T00:00:00Z`).getTime())) return null
  const text = typeof description === 'string' ? description.trim() : ''
  return { type, quantity: Math.round(qty * 100) / 100, date: day, description: text || null }
}

/** Quanto a movimentação soma (entrada) ou tira (saída) do estoque */
export const signedQuantity = (m: { type: string; quantity: number }) => (m.type === 'Entrada' ? m.quantity : -m.quantity)

/** Quanto o estoque muda ao trocar uma movimentação por outra (null = não existia / foi apagada) */
export function movementDelta(before: { type: string; quantity: number } | null, after: { type: string; quantity: number } | null): number {
  const delta = (after ? signedQuantity(after) : 0) - (before ? signedQuantity(before) : 0)
  return Math.round(delta * 100) / 100
}

/** A tela está pronta para salvar: quantidade acima de zero e dia preenchido */
export const movementReady = (mov: { type: string; quantity: string; date: string }) => parseMovement(mov) !== null

interface SupplyLike { id: string; currentQuantity: number; movements: { id: string; type: string; quantity: number; date: string; description?: string | null }[] }

/** Lista do servidor com as movimentações ainda não enviadas aplicadas, para a tela já mostrar o saldo certo */
export function applyPendingMovements<T extends SupplyLike>(supplies: T[], pending: PendingMovement[]): T[] {
  if (!pending.length) return supplies
  return supplies.map((s) => {
    const mine = pending.filter((p) => p.supplyId === s.id)
    if (!mine.length) return s
    const delta = mine.reduce((sum, m) => sum + signedQuantity(m), 0)
    const rows = mine.map((m) => ({ id: `pending_${m._pendingId}`, type: m.type, quantity: m.quantity, date: `${m.date}T00:00:00.000Z`, description: m.description }))
    return { ...s, currentQuantity: Math.round((s.currentQuantity + delta) * 100) / 100, movements: [...rows, ...s.movements] }
  })
}
