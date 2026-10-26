// Cobertura (Reprodução): como foi feita, o que se repete de uma fêmea para a outra e as contas da gestação.
// Regra pura, usada na tela e nas rotas; sem banco.

export const COVERAGE_METHODS = [
  { key: 'ia', label: 'Inseminação', hint: 'cio observado' },
  { key: 'iatf', label: 'IATF', hint: 'tempo fixo' },
  { key: 'natural', label: 'Monta natural', hint: 'touro no pasto' },
  { key: 'repasse', label: 'Repasse', hint: 'touro depois da IA' },
] as const

export type CoverageMethod = (typeof COVERAGE_METHODS)[number]['key']

export const isCoverageMethod = (v: unknown): v is CoverageMethod => COVERAGE_METHODS.some((m) => m.key === v)

export const methodLabel = (m: string | null | undefined) => COVERAGE_METHODS.find((x) => x.key === m)?.label ?? 'Cobertura'

/** Inseminação (com ou sem protocolo): tem partida de sêmen e inseminador. Monta e repasse são o touro. */
export const isInsemination = (m: string | null | undefined) => m === 'ia' || m === 'iatf'

/** Dias de gestação da vaca (280) */
export const GESTATION_DAYS = 280

const DAY = 86_400_000
const dayOf = (v: string | Date) => Date.parse(`${(typeof v === 'string' ? v : v.toISOString()).slice(0, 10)}T00:00:00Z`)

export function plusDays(isoDay: string, days: number) {
  const d = new Date(`${isoDay}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export interface Gestation {
  /** dias desde a cobertura */
  days: number
  /** dias até o parto previsto (negativo: atrasado) */
  toBirth: number
  /** 0 a 100 */
  percent: number
}

/** Dias de gestação e quanto falta para o parto, numa cobertura em andamento. null se não há parto previsto. */
export function gestation(coverageDate: string | Date, expectedBirthDate: string | Date | null | undefined, today: string): Gestation | null {
  if (!expectedBirthDate) return null
  const start = dayOf(coverageDate)
  const end = dayOf(expectedBirthDate)
  const now = dayOf(today)
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(now) || end <= start) return null
  const days = Math.max(Math.round((now - start) / DAY), 0)
  const toBirth = Math.round((end - now) / DAY)
  return { days, toBirth, percent: Math.min(Math.round((days / ((end - start) / DAY)) * 100), 100) }
}

export interface CoverageForm {
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
}

export const EMPTY_COVERAGE: Omit<CoverageForm, 'coverageDate'> = {
  femaleId: '', method: '', maleName: '', bullRegistry: '', semenBatch: '', inseminator: '', heatDate: '', status: 'Coberta', observations: '',
}

/**
 * "Salvar e repetir para outra fêmea": no dia de IATF o touro, a partida, o inseminador, a data e o tipo
 * são os mesmos para a fila toda; só a fêmea muda. Cio e observações são de cada animal.
 */
export function repeatCoverage(form: CoverageForm): CoverageForm {
  return { ...form, femaleId: '', heatDate: '', observations: '' }
}

/** O que foi mantido para a próxima fêmea, para a tela avisar */
export function repeatedFields(form: CoverageForm): string[] {
  const kept: string[] = ['data']
  if (form.method) kept.push(methodLabel(form.method).toLowerCase())
  if (form.maleName) kept.push(`touro ${form.maleName}`)
  if (form.semenBatch && isInsemination(form.method)) kept.push(`partida ${form.semenBatch}`)
  if (form.inseminator && isInsemination(form.method)) kept.push(`inseminador ${form.inseminator}`)
  return kept
}

export interface CoverageDetails {
  method: CoverageMethod | null
  /** yyyy-mm-dd */
  heatDate: string | null
  semenBatch: string | null
  bullRegistry: string | null
  inseminator: string | null
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

/** Campos da cobertura vindos do formulário (todos opcionais). Partida e inseminador só fazem sentido na inseminação. */
export function parseCoverageDetails(body: Record<string, unknown>): CoverageDetails {
  const text = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
  const method = isCoverageMethod(body.method) ? body.method : null
  const byBull = method === 'natural' || method === 'repasse'
  return {
    method,
    heatDate: typeof body.heatDate === 'string' && ISO_DAY.test(body.heatDate) ? body.heatDate : null,
    semenBatch: byBull ? null : text(body.semenBatch, 60),
    bullRegistry: text(body.bullRegistry, 60),
    inseminator: byBull ? null : text(body.inseminator, 80),
  }
}
