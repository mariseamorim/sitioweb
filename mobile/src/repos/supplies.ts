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
}

export interface Movement { id: string; supplyId: string; type: 'Entrada' | 'Saída'; quantity: number; date: string; description: string | null }

export const SUPPLY_CATEGORIES = ['Ração', 'Sal mineral', 'Medicamento', 'Vacina', 'Sementes', 'Adubo', 'Outro']
export const UNITS = ['kg', 'saco', 'litro', 'dose', 'frasco', 'unidade']

export const isLow = (s: Supply) => s.currentQuantity < s.minimumQuantity

export const listSupplies = (farmId: string) => all<Supply>('SELECT * FROM supplies WHERE farmId = ? ORDER BY name COLLATE NOCASE', [farmId])
export const getSupply = (id: string) => one<Supply>('SELECT * FROM supplies WHERE id = ?', [id])
export const listMovements = (supplyId: string) => all<Movement>('SELECT * FROM supply_movements WHERE supplyId = ? ORDER BY date DESC, createdAt DESC LIMIT 30', [supplyId])

export interface SupplyInput { name: string; category: string; unit: string; currentQuantity: number; minimumQuantity: number; packageKg: number | null; unitPrice: number | null }

export function saveSupply(farmId: string, input: SupplyInput, id?: string): string {
  const base = { name: input.name.trim(), category: input.category, unit: input.unit, minimumQuantity: input.minimumQuantity, packageKg: input.packageKg, unitPrice: input.unitPrice }
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
