// Reprodução: coberturas, prenhez e partos. Lê do SQLite e grava pela fila (outbox), como os outros módulos.
import { all, one, patchRow } from '@/db'
import { notifyChange } from '@/db/events'
import { canBreed } from '@/lib/animalRules'
import { GESTATION_DAYS, parseCoverageDetails, plusDays } from '@/lib/coverage'
import { isoDay, todayISO } from '@/lib/format'
import { nextCode, type Animal } from '@/repos/animals'
import { createLocal, deleteLocal, updateLocal } from '@/sync/local'

export interface Reproduction {
  id: string
  femaleId: string
  maleName: string | null
  method: string | null
  heatDate: string | null
  semenBatch: string | null
  bullRegistry: string | null
  inseminator: string | null
  coverageDate: string
  expectedBirthDate: string | null
  actualBirthDate: string | null
  status: string
  calfId: string | null
  observations: string | null
  /** Da fêmea (JOIN com animals) */
  femaleName: string | null
  femaleCode: string | null
  femaleCustomCode: string | null
}

export const STATUS_LIST = ['Coberta', 'Prenha', 'Parida', 'Vazia', 'Perdida']
const OPEN_STATUSES = ['Coberta', 'Prenha']

/** Cor do selo de situação, como no site (Coberta azul, Prenha roxo, Parida verde, Vazia cinza, Perdida vermelho) */
export function statusTone(status: string): 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'muted' {
  if (status === 'Coberta') return 'blue'
  if (status === 'Prenha') return 'purple'
  if (status === 'Parida') return 'green'
  if (status === 'Perdida') return 'red'
  return 'muted'
}

/** Cobertura em andamento (ainda sem parto) */
export const isOpen = (r: Pick<Reproduction, 'status' | 'actualBirthDate'>) => OPEN_STATUSES.includes(r.status) && !r.actualBirthDate

const SELECT = `SELECT r.*, a.name AS femaleName, a.code AS femaleCode, a.customCode AS femaleCustomCode
  FROM reproductions r LEFT JOIN animals a ON a.id = r.femaleId`

export function listReproductions(farmId: string): Reproduction[] {
  return all<Reproduction>(`${SELECT} WHERE r.farmId = ? ORDER BY r.coverageDate DESC, r.createdAt DESC`, [farmId])
}

export const getReproduction = (id: string) => one<Reproduction>(`${SELECT} WHERE r.id = ?`, [id])

/** Partos esperados nos próximos 30 dias (coberturas em aberto com previsão até lá) */
export function birthSoon(r: Reproduction, today = todayISO()): boolean {
  return isOpen(r) && !!r.expectedBirthDate && isoDay(r.expectedBirthDate) <= plusDays(today, 30)
}

export type HerdAnimal = Animal & { lotId: string | null; rearingStart: string | null; rearingEnd: string | null }

export function listHerd(farmId: string): HerdAnimal[] {
  return all<HerdAnimal>('SELECT * FROM animals WHERE farmId = ? ORDER BY name COLLATE NOCASE', [farmId])
}

/** Novilha na recria (lote de recria em aberto ou acompanhada um a um) pode ser coberta a partir de 13 meses */
export function isInRearing(a: HerdAnimal, farmId: string): boolean {
  if (a.rearingStart && !a.rearingEnd) return true
  if (!a.lotId) return false
  const lot = one<{ phase: string | null; endDate: string | null }>('SELECT phase, endDate FROM lots WHERE id = ? AND farmId = ?', [a.lotId, farmId])
  return !!lot && lot.phase === 'recria' && !lot.endDate
}

/** Fêmeas aptas à cobertura, para o seletor do formulário */
export function breedableFemales(farmId: string): HerdAnimal[] {
  const today = todayISO()
  return listHerd(farmId).filter(a => canBreed({ ...a, isCastrated: !!a.isCastrated }, today, { inRearingLot: isInRearing(a, farmId) }))
}

export interface CoverageInput {
  femaleId: string
  coverageDate: string
  method: string
  maleName: string
  bullRegistry: string
  semenBatch: string
  inseminator: string
  heatDate: string
  status: string
  observations: string
  /** Previsão digitada (edição); vazio = calcular pela cobertura */
  expectedBirthDate?: string
}

/** Mesma conta do servidor: cobertura em andamento tem parto previsto 280 dias depois; Vazia/Perdida não têm */
function expectedFor(coverageDate: string, status: string, typed?: string): string | null {
  if (!OPEN_STATUSES.includes(status)) return null
  if (typed && /^\d{4}-\d{2}-\d{2}$/.test(typed)) return typed
  return plusDays(coverageDate, GESTATION_DAYS)
}

/** Registrar cobertura (POST /api/reproducao). Devolve o id local. */
export function createCoverage(farmId: string, input: CoverageInput): string {
  const details = parseCoverageDetails({ ...input })
  const status = input.status || 'Coberta'
  const body = {
    femaleId: input.femaleId, coverageDate: input.coverageDate, maleName: input.maleName.trim() || null, status,
    observations: input.observations.trim() || null, ...details,
    ...(input.expectedBirthDate ? { expectedBirthDate: input.expectedBirthDate } : {}),
  }
  const row = { expectedBirthDate: expectedFor(input.coverageDate, status, input.expectedBirthDate), actualBirthDate: null, calfId: null }
  return createLocal({ table: 'reproductions', farmId, path: '/api/reproducao', body, row })
}

/** Corrigir o registro (PUT parcial): datas, reprodutor, como foi, sêmen, registro do touro e observações */
export function updateCoverage(farmId: string, current: Reproduction, input: CoverageInput) {
  const details = parseCoverageDetails({ ...input })
  const body = {
    coverageDate: input.coverageDate, maleName: input.maleName.trim() || null, observations: input.observations.trim() || null,
    status: current.status, ...details, ...(input.expectedBirthDate ? { expectedBirthDate: input.expectedBirthDate } : {}),
  }
  const row = { expectedBirthDate: expectedFor(input.coverageDate, current.status, input.expectedBirthDate) }
  updateLocal({ table: 'reproductions', farmId, id: current.id, path: `/api/reproducao/${current.id}`, body, row })
}

/** Atualizar a situação (com data do parto quando Parida) */
export function updateStatus(farmId: string, id: string, status: string, actualBirthDate: string, observations?: string | null) {
  const body: Record<string, unknown> = { status, actualBirthDate: actualBirthDate || null }
  if (observations !== undefined) body.observations = observations
  const row: Record<string, unknown> = {}
  if (status === 'Vazia' || status === 'Perdida') row.expectedBirthDate = null
  updateLocal({ table: 'reproductions', farmId, id, path: `/api/reproducao/${id}`, body, row })
}

export function removeReproduction(farmId: string, id: string) {
  deleteLocal({ table: 'reproductions', farmId, id, path: `/api/reproducao/${id}` })
}

/** "Confirmar prenhez" sem cobertura anotada: vaca dada como vazia depois do parto */
export function markEmptyAfterCalving(farmId: string, femaleId: string) {
  return createCoverage(farmId, {
    femaleId, coverageDate: todayISO(), status: 'Vazia', observations: 'Confirmada vazia depois do parto',
    method: '', maleName: '', bullRegistry: '', semenBatch: '', inseminator: '', heatDate: '',
  })
}

export interface CalfInput { name: string; gender: 'Fêmea' | 'Macho'; birthDate: string; status: string }

/**
 * Mesma regra de src/lib/calves.ts do site: a cria fecha as coberturas em aberto da mãe até a data do parto
 * (a mais recente leva a cria). O servidor faz isso sozinho; a cópia local recebe o mesmo para a tela refletir na hora.
 */
function closeOpenLocally(motherId: string, calfId: string, birthDate: string) {
  const open = all<{ id: string }>(
    `SELECT id FROM reproductions WHERE femaleId = ? AND actualBirthDate IS NULL AND status IN ('Coberta', 'Prenha') AND substr(coverageDate, 1, 10) <= ? ORDER BY coverageDate DESC`,
    [motherId, isoDay(birthDate)],
  )
  open.forEach((r, i) => patchRow('reproductions', r.id, { actualBirthDate: isoDay(birthDate), status: 'Parida', ...(i === 0 ? { calfId } : {}), updatedAt: new Date().toISOString() }))
  notifyChange()
}

/** Registrar parto anotando a cria nova: ela entra no rebanho ligada à mãe (POST /api/animals). Devolve o id local da cria. */
export function registerBirth(farmId: string, reproduction: Reproduction, calf: CalfInput): string {
  const body = { name: calf.name.trim(), species: 'Bezerro', gender: calf.gender, birthDate: calf.birthDate, status: calf.status, motherId: reproduction.femaleId }
  const calfId = createLocal({ table: 'animals', farmId, path: '/api/animals', body, row: { code: nextCode(farmId), isCastrated: 0, acquisitionType: 'nascimento' } })
  closeOpenLocally(reproduction.femaleId, calfId, calf.birthDate)
  return calfId
}

/** Registrar parto ligando uma cria já cadastrada à mãe (PATCH /api/animals/{id} { motherId }) */
export function linkExistingCalf(farmId: string, reproduction: Reproduction, calf: Pick<Animal, 'id' | 'birthDate'>) {
  updateLocal({ table: 'animals', farmId, id: calf.id, path: `/api/animals/${calf.id}`, body: { motherId: reproduction.femaleId }, method: 'PATCH' })
  closeOpenLocally(reproduction.femaleId, calf.id, calf.birthDate)
}

/** Para ligar uma cria já cadastrada: animais sem mãe, mais novos que a vaca */
export function calfCandidates(farmId: string, mother: Pick<Animal, 'id' | 'birthDate'>): HerdAnimal[] {
  return listHerd(farmId)
    .filter(a => !a.motherId && a.id !== mother.id && isoDay(a.birthDate) > isoDay(mother.birthDate))
    .sort((a, b) => isoDay(b.birthDate).localeCompare(isoDay(a.birthDate)))
}
