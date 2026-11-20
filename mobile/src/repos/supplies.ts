import { all, one, patchRow } from '@/db'
import { createLocal, deleteLocal, updateLocal } from '@/sync/local'

export interface Supply {
  id: string
  name: string
  category: string
  unit: string
  currentQuantity: number
  minimumQuantity: number
  packageKg: number | null
  unitPrice: number | null
  /** Validade (opcional), "AAAA-MM-DD..." */
  expiryDate: string | null
}

export interface Movement { id: string; supplyId: string; type: 'Entrada' | 'Saída'; quantity: number; date: string; description: string | null }

export const SUPPLY_CATEGORIES = ['Ração', 'Sal mineral', 'Medicamento', 'Vacina', 'Sementes', 'Adubo', 'Outro']
export const UNITS = ['kg', 'saco', 'litro', 'dose', 'frasco', 'unidade']

export const isLow = (s: Supply) => s.currentQuantity < s.minimumQuantity

/** Selo da situação (só aparência, como no site): abaixo do mínimo e acabou = Crítico, abaixo do mínimo = Baixo, senão OK */
export function supplyStatus(s: Supply): { label: 'Crítico' | 'Baixo' | 'OK'; tone: 'red' | 'amber' | 'green' } {
  if (!isLow(s)) return { label: 'OK', tone: 'green' }
  return s.currentQuantity <= 0 ? { label: 'Crítico', tone: 'red' } : { label: 'Baixo', tone: 'amber' }
}

export const listSupplies = (farmId: string) => all<Supply>('SELECT * FROM supplies WHERE farmId = ? ORDER BY name COLLATE NOCASE', [farmId])
export const getSupply = (id: string) => one<Supply>('SELECT * FROM supplies WHERE id = ?', [id])
export const listMovements = (supplyId: string) => all<Movement>('SELECT * FROM supply_movements WHERE supplyId = ? ORDER BY date DESC, createdAt DESC LIMIT 30', [supplyId])

export interface SupplyInput { name: string; category: string; unit: string; currentQuantity: number; minimumQuantity: number; packageKg: number | null; unitPrice: number | null; expiryDate: string | null }

/** Entra em "Próximos a vencer" com 30 dias ou menos até a validade */
export const EXPIRY_WARNING_DAYS = 30
/** Dias até a validade (negativo: já venceu); null sem validade */
export function daysToExpiry(s: Supply, today: string): number | null {
  return s.expiryDate ? Math.round((Date.parse(s.expiryDate.slice(0, 10)) - Date.parse(today)) / 86_400_000) : null
}

export function saveSupply(farmId: string, input: SupplyInput, id?: string): string {
  const base = { name: input.name.trim(), category: input.category, unit: input.unit, minimumQuantity: input.minimumQuantity, packageKg: input.packageKg, unitPrice: input.unitPrice, expiryDate: input.expiryDate }
  if (id) {
    updateLocal({ table: 'supplies', farmId, id, path: `/api/estoque/${id}`, body: base })
    return id
  }
  return createLocal({ table: 'supplies', farmId, path: '/api/estoque', body: { ...base, currentQuantity: input.currentQuantity } })
}

export function removeSupply(farmId: string, id: string) {
  deleteLocal({ table: 'supplies', farmId, id, path: `/api/estoque/${id}` })
}

/** Entrada ou saída: ajusta a quantidade local na hora e manda a movimentação para o servidor, que recalcula. */
export function addMovement(farmId: string, supply: Supply, input: { type: 'Entrada' | 'Saída'; quantity: number; date: string; description: string }) {
  const body = { type: input.type, quantity: input.quantity, date: input.date, description: input.description.trim() || null }
  createLocal({ table: 'supply_movements', farmId, path: `/api/estoque/${supply.id}/movimentacao`, body, row: { supplyId: supply.id } })
  patchRow('supplies', supply.id, { currentQuantity: supply.currentQuantity + (input.type === 'Entrada' ? input.quantity : -input.quantity) })
}
