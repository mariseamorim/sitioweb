import { all, one } from '@/db'
import { addDays, isoDay, todayISO } from '@/lib/format'
import { createLocal, deleteLocal, updateLocal } from '@/sync/local'

export interface Treatment {
  id: string
  animalId: string
  startDate: string
  endDate: string | null
  medicine: string
  milkWithdrawalDays: number | null
  meatWithdrawalDays: number | null
  batch: string | null
  manufacturer: string | null
  description: string | null
  observations: string | null
  animalName: string | null
  animalCode: string | null
}

/** Até quando o leite (ou a carne) fica em carência: dias contados do fim do tratamento (ou do início, sem fim). */
export function withdrawalUntil(t: Pick<Treatment, 'startDate' | 'endDate'>, days: number | null): string | null {
  if (days === null || days === undefined) return null
  return addDays(isoDay(t.endDate ?? t.startDate), days)
}

export const milkBlockedToday = (t: Treatment, today = todayISO()) => { const u = withdrawalUntil(t, t.milkWithdrawalDays); return !!u && u >= today }

export function listTreatments(farmId: string): Treatment[] {
  return all<Treatment>(
    `SELECT t.*, a.name AS animalName, coalesce(a.customCode, a.code) AS animalCode FROM treatments t LEFT JOIN animals a ON a.id = t.animalId
     WHERE t.farmId = ? ORDER BY t.startDate DESC`, [farmId],
  )
}

export const getTreatment = (id: string) => one<Treatment>(
  'SELECT t.*, a.name AS animalName, coalesce(a.customCode, a.code) AS animalCode FROM treatments t LEFT JOIN animals a ON a.id = t.animalId WHERE t.id = ?', [id],
)

export interface TreatmentInput {
  animalId: string; startDate: string; endDate: string; medicine: string; milkWithdrawalDays: string; meatWithdrawalDays: string
  batch: string; manufacturer: string; description: string; observations: string
}

const days = (s: string) => (s.trim() === '' ? null : Number(s))

export function saveTreatment(farmId: string, input: TreatmentInput, id?: string): string {
  const body = {
    animalId: input.animalId, startDate: input.startDate, endDate: input.endDate || null, medicine: input.medicine.trim(),
    milkWithdrawalDays: days(input.milkWithdrawalDays), meatWithdrawalDays: days(input.meatWithdrawalDays),
    batch: input.batch.trim() || null, manufacturer: input.manufacturer.trim() || null, description: input.description.trim() || null, observations: input.observations.trim() || null,
  }
  if (id) {
    updateLocal({ table: 'treatments', farmId, id, path: `/api/veterinary-treatment/${id}`, body })
    return id
  }
  return createLocal({ table: 'treatments', farmId, path: '/api/veterinary-treatment', body })
}

export function removeTreatment(farmId: string, id: string) {
  deleteLocal({ table: 'treatments', farmId, id, path: `/api/veterinary-treatment/${id}` })
}
