import { all, one } from '@/db'
import { addDays, isoDay, todayISO } from '@/lib/format'
import { createLocal, deleteLocal, updateLocal } from '@/sync/local'

export interface Vaccination {
  id: string
  animalId: string
  vaccineName: string
  scheduledDate: string
  appliedDate: string | null
  batch: string | null
  manufacturer: string | null
  observations: string | null
  animalName: string | null
  animalCode: string | null
}

export type VaccStatus = 'Pendente' | 'Aplicada' | 'Vencida'

export function vaccStatus(v: Pick<Vaccination, 'scheduledDate' | 'appliedDate'>, today = todayISO()): VaccStatus {
  if (v.appliedDate) return 'Aplicada'
  return isoDay(v.scheduledDate) < today ? 'Vencida' : 'Pendente'
}

/** Vencida ou vence nos próximos 7 dias, sem aplicação. */
export const dueSoon = (v: Pick<Vaccination, 'scheduledDate' | 'appliedDate'>, today = todayISO()) => !v.appliedDate && isoDay(v.scheduledDate) <= addDays(today, 7)

export function listVaccinations(farmId: string): Vaccination[] {
  return all<Vaccination>(
    `SELECT v.*, a.name AS animalName, coalesce(a.customCode, a.code) AS animalCode FROM vaccinations v LEFT JOIN animals a ON a.id = v.animalId
     WHERE v.farmId = ? ORDER BY v.scheduledDate DESC`, [farmId],
  )
}

export const getVaccination = (id: string) => one<Vaccination>(
  'SELECT v.*, a.name AS animalName, coalesce(a.customCode, a.code) AS animalCode FROM vaccinations v LEFT JOIN animals a ON a.id = v.animalId WHERE v.id = ?', [id],
)

export interface VaccinationInput { animalId: string; vaccineName: string; scheduledDate: string; appliedDate: string; batch: string; manufacturer: string; observations: string }

export function saveVaccination(farmId: string, input: VaccinationInput, id?: string): string {
  const body = {
    animalId: input.animalId, vaccineName: input.vaccineName.trim(), scheduledDate: input.scheduledDate, appliedDate: input.appliedDate || null,
    batch: input.batch.trim() || null, manufacturer: input.manufacturer.trim() || null, observations: input.observations.trim() || null,
  }
  if (id) {
    updateLocal({ table: 'vaccinations', farmId, id, path: `/api/vacinacao/${id}`, body })
    return id
  }
  return createLocal({ table: 'vaccinations', farmId, path: '/api/vacinacao', body })
}

export function removeVaccination(farmId: string, id: string) {
  deleteLocal({ table: 'vaccinations', farmId, id, path: `/api/vacinacao/${id}` })
}
