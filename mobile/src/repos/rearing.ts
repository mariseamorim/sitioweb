// Recria um a um: animais com rearingStart na cópia local, pesagens individuais (animal_weighings) e última cobertura.
// As escritas usam as subrotas de /api/animals/{id} pela fila (outbox) e aplicam a mudança na cópia local na hora.
import * as Crypto from 'expo-crypto'
import { all, deleteRow, one, upsert, type Row } from '@/db'
import { isoDay, todayISO } from '@/lib/format'
import { canEnterRearing, type RearingAnimal, type RearingWeighing } from '@/lib/rearing'
import { currentId, updateLocal } from '@/sync/local'
import type { Coverage, HerdAnimal } from './lots'

export type RearingRow = RearingAnimal & { reproductions: Coverage[] }

/** Pesagem anotada no aparelho e ainda não enviada (o servidor devolve o id definitivo na sincronização) */
export const isPendingWeighing = (id: string | undefined) => !!id && id.startsWith('pend_')

function weighingsOf(animalId: string): RearingWeighing[] {
  return all<Row>('SELECT * FROM animal_weighings WHERE animalId = ? ORDER BY date', [animalId])
    .map(w => ({ id: String(w.id), date: isoDay(w.date as string), weight: Number(w.weight), lotWeighingId: (w.lotWeighingId as string | null) ?? null }))
}

function lastCoverage(femaleId: string): Coverage[] {
  const c = one<Row>('SELECT * FROM reproductions WHERE femaleId = ? ORDER BY coverageDate DESC LIMIT 1', [femaleId])
  if (!c) return []
  return [{
    id: String(c.id), heatDate: c.heatDate ? isoDay(c.heatDate as string) : null, method: (c.method as string | null) ?? null,
    coverageDate: isoDay(c.coverageDate as string), expectedBirthDate: c.expectedBirthDate ? isoDay(c.expectedBirthDate as string) : null,
    semenBatch: (c.semenBatch as string | null) ?? null, bullRegistry: (c.bullRegistry as string | null) ?? null, inseminator: (c.inseminator as string | null) ?? null,
    maleName: (c.maleName as string | null) ?? null, status: String(c.status ?? ''),
  }]
}

function toRow(a: HerdAnimal): RearingRow {
  return {
    id: a.id, code: a.code, customCode: a.customCode, name: a.name, gender: a.gender, species: a.species, birthDate: isoDay(a.birthDate),
    status: a.status, lotId: a.lotId, rearingStart: a.rearingStart ? isoDay(a.rearingStart) : null, rearingEnd: a.rearingEnd ? isoDay(a.rearingEnd) : null,
    rearingTarget: a.rearingTarget === null || a.rearingTarget === undefined ? null : Number(a.rearingTarget),
    weighings: weighingsOf(a.id),
    reproductions: a.gender === 'Fêmea' ? lastCoverage(a.id) : [],
  }
}

/** Quem já entrou na recria (em andamento primeiro), como /api/recria */
export function listRearing(farmId: string): RearingRow[] {
  return all<HerdAnimal>('SELECT * FROM animals WHERE farmId = ? AND rearingStart IS NOT NULL ORDER BY (rearingEnd IS NULL) DESC, code', [farmId]).map(toRow)
}

export function getRearing(id: string): RearingRow | null {
  const a = one<HerdAnimal>('SELECT * FROM animals WHERE id = ?', [currentId(id)])
  return a ? toRow(a) : null
}

/** Bezerros, bezerras e bois jovens vivos que não estão em lote nem na recria */
export function eligibleForRearing(farmId: string, today = todayISO()): HerdAnimal[] {
  return all<HerdAnimal>("SELECT * FROM animals WHERE farmId = ? AND status = 'Vivo' ORDER BY code, name COLLATE NOCASE", [farmId])
    .filter(a => canEnterRearing({ ...a, isCastrated: !!a.isCastrated, birthDate: isoDay(a.birthDate) }, today))
}

const recriaPath = (id: string) => `/api/animals/${id}/recria`
const weighingsPath = (id: string) => `/api/animals/${id}/pesagens`

function insertWeighing(farmId: string, animalId: string, date: string, weight: number) {
  upsert('animal_weighings', farmId, { id: 'pend_' + Crypto.randomUUID(), animalId, date, weight, lotWeighingId: null, createdAt: new Date().toISOString() })
}

/** Entra na recria na data da desmama; o peso vira a primeira pesagem */
export function enterRearing(farmId: string, animalId: string, input: { start: string; weight: number | null; target: number | null }) {
  if (input.weight) insertWeighing(farmId, animalId, input.start, input.weight)
  updateLocal({
    table: 'animals', farmId, id: animalId, path: recriaPath(animalId), method: 'POST',
    body: { start: input.start, weight: input.weight, target: input.target },
    row: { rearingStart: input.start, rearingEnd: null, rearingTarget: input.target },
  })
}

export function addRearingWeighing(farmId: string, animalId: string, input: { date: string; weight: number }) {
  insertWeighing(farmId, animalId, input.date, input.weight)
  updateLocal({ table: 'animals', farmId, id: animalId, path: weighingsPath(animalId), method: 'POST', body: { date: input.date, weight: input.weight } })
}

export function removeRearingWeighing(farmId: string, animalId: string, weighingId: string) {
  deleteRow('animal_weighings', weighingId)
  updateLocal({ table: 'animals', farmId, id: animalId, path: weighingsPath(animalId), method: 'DELETE', body: { weighingId } })
}

export function setRearingTarget(farmId: string, animalId: string, target: number | null) {
  updateLocal({ table: 'animals', farmId, id: animalId, path: recriaPath(animalId), method: 'PATCH', body: { target }, row: { rearingTarget: target } })
}

/** Sai da recria (vendido, foi para a engorda ou virou matriz); `end` null reabre */
export function setRearingEnd(farmId: string, animalId: string, end: string | null) {
  updateLocal({ table: 'animals', farmId, id: animalId, path: recriaPath(animalId), method: 'PATCH', body: { end }, row: { rearingEnd: end } })
}
