// Recria por animal, sem lote: quem pode entrar, as contas de cada animal e o que fica na fila sem internet.
// Regra pura (tela e servidor); o banco fica nas rotas.

import { animalCategory, isBovine } from './animalRules'
import { animalGain, daysBetween, projectTarget } from './lots'

export interface RearingWeighing { id?: string; date: string; weight: number; lotWeighingId?: string | null }

export interface RearingAnimal {
  id: string
  code: string
  customCode: string | null
  name: string
  gender: string
  species: string
  /** yyyy-mm-dd ou ISO completo */
  birthDate: string
  status?: string
  lotId?: string | null
  rearingStart: string | null
  rearingEnd: string | null
  rearingTarget: number | null
  weighings: RearingWeighing[]
}

export const day = (v: string | null | undefined) => (v ? v.slice(0, 10) : '')

/** Está na recria por animal (entrou e ainda não saiu) */
export const isInRearing = (a: { rearingStart?: string | null; rearingEnd?: string | null }) => !!a.rearingStart && !a.rearingEnd

/**
 * Pode entrar na recria: bovino vivo, ainda não é vaca nem touro (bezerro, bezerra ou boi jovem),
 * não está em recria nem num lote. A classificação acompanha a idade.
 */
export function canEnterRearing(a: { species: string; gender: string; birthDate: string | Date; isCastrated?: boolean; status?: string; lotId?: string | null; rearingStart?: string | null; rearingEnd?: string | null }, today?: string) {
  if (!isBovine(a.species) || (a.status && a.status !== 'Vivo') || a.lotId || isInRearing(a)) return false
  const category = animalCategory(a, today)
  return category !== 'Vaca' && category !== 'Touro'
}

/** Entrada na recria: desmama entre o nascimento e hoje; peso e alvo opcionais, em kg */
export function rearingEntryError(input: { start: string; birthDate: string; today: string; weight?: number | null; target?: number | null }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.start)) return 'Informe a data da desmama'
  if (input.start > input.today) return 'A desmama não pode ser no futuro'
  if (input.start < day(input.birthDate)) return 'A desmama não pode ser antes do nascimento'
  if (input.weight != null && (!(input.weight > 0) || input.weight > 2000)) return 'Peso inválido: use kg, por exemplo 180'
  if (input.target != null && (!(input.target > 0) || input.target > 2000)) return 'Peso-alvo inválido: use kg, por exemplo 320'
  return null
}

export interface RearingSummary {
  /** meses de idade */
  months: number
  /** dias desde a entrada */
  days: number
  entry: RearingWeighing | null
  last: RearingWeighing | null
  gainKg: number | null
  gmd: number | null
  /** quando chega ao peso-alvo no ritmo atual */
  projection: { remainingKg: number; days: number; date: string } | null
}

/** Idade, tempo na recria, ganho e previsão do peso-alvo. Só conta as pesagens a partir da entrada. */
export function rearingSummary(a: RearingAnimal, today: string): RearingSummary {
  const start = day(a.rearingStart)
  const end = day(a.rearingEnd) || today
  const since = a.weighings.filter((w) => !start || w.date >= start)
  const gain = animalGain(since)
  const projection = a.rearingEnd || !gain.last || gain.gmd === null
    ? null
    : projectTarget({ entry: null, last: { date: gain.last.date, headCount: 1, avgWeight: gain.last.weight }, days: 0, gainKg: gain.gainKg, gmd: gain.gmd }, a.rearingTarget)
  return {
    months: Math.max(Math.floor(daysBetween(day(a.birthDate), today) / 30.44), 0),
    days: start ? Math.max(daysBetween(start, end), 0) : 0,
    entry: gain.entry,
    last: gain.last,
    gainKg: gain.gainKg,
    gmd: gain.gmd,
    projection,
  }
}

// ── Fila sem internet ───────────────────────────────────────────────────

export type RearingPending =
  | { _type: 'entrar'; animalId: string; farmId: string; start: string; weight: number | null; target: number | null }
  | { _type: 'pesar'; animalId: string; farmId: string; date: string; weight: number }
  | { _type: 'sair'; animalId: string; farmId: string; end: string }

/** Rota e corpo de cada item da fila */
export function pendingRequest(p: RearingPending): { url: string; method: 'POST' | 'PATCH'; body: Record<string, unknown> } {
  if (p._type === 'entrar') return { url: `/api/animals/${p.animalId}/recria`, method: 'POST', body: { start: p.start, weight: p.weight, target: p.target } }
  if (p._type === 'pesar') return { url: `/api/animals/${p.animalId}/pesagens`, method: 'POST', body: { date: p.date, weight: p.weight } }
  return { url: `/api/animals/${p.animalId}/recria`, method: 'PATCH', body: { end: p.end } }
}

/**
 * A lista da recria como vai ficar depois que a fila subir: quem entrou aparece, pesagens entram na ordem,
 * quem saiu fica encerrado. `herd` serve para montar o animal que entrou sem internet.
 */
export interface HerdRef { id: string; code: string; customCode: string | null; name: string; species: string; gender?: string; birthDate?: string; status?: string; lotId?: string | null }

export function applyPending(list: RearingAnimal[], pending: RearingPending[], herd: HerdRef[]): RearingAnimal[] {
  const byId = new Map(list.map((a) => [a.id, { ...a, weighings: [...a.weighings] }]))
  for (const p of pending) {
    let a = byId.get(p.animalId)
    if (p._type === 'entrar') {
      const base = a ?? herd.find((h) => h.id === p.animalId)
      if (!base) continue
      a = { ...base, gender: base.gender ?? '', birthDate: base.birthDate ?? '', weighings: a?.weighings ?? [], rearingStart: p.start, rearingEnd: null, rearingTarget: p.target }
      if (p.weight) a.weighings = [...a.weighings, { date: p.start, weight: p.weight }].sort((x, y) => x.date.localeCompare(y.date))
      byId.set(a.id, a)
    } else if (!a) {
      continue
    } else if (p._type === 'pesar') {
      a.weighings = [...a.weighings, { date: p.date, weight: p.weight }].sort((x, y) => x.date.localeCompare(y.date))
    } else {
      a.rearingEnd = p.end
    }
  }
  return [...byId.values()]
}
