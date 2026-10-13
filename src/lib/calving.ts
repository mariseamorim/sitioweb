// Contas de crias e partos, usadas na ficha da vaca, no painel da Reprodução e nos relatórios
import { animalToday, canAddCalf } from '@/lib/animalRules'

/** Crias nascidas com até estes dias de diferença são do mesmo parto (gêmeos) */
export const SAME_CALVING_DAYS = 30
/** Vaca sem parir há mais que isso (e sem prenhez anotada) aparece como "demorando para criar" */
export const LATE_MONTHS = 15
/** A partir desta idade, vaca sem nenhuma cria anotada também aparece no painel */
export const FIRST_CALVING_AGE_MONTHS = 36

const DAY = 24 * 60 * 60 * 1000
const time = (d: string | Date) => new Date(d).getTime()

/** Meses entre duas datas, arredondado */
export const monthsBetween = (a: string | Date, b: string | Date) => Math.round((time(b) - time(a)) / DAY / 30.44)

/** Datas de início de cada parto, a partir das datas de nascimento das crias (em ordem) */
export function calvingStarts(birthDates: (string | Date)[]): string[] {
  const starts: string[] = []
  for (const d of [...birthDates].map((x) => new Date(x).toISOString()).sort()) {
    const last = starts.at(-1)
    if (!last || (time(d) - time(last)) / DAY > SAME_CALVING_DAYS) starts.push(d)
  }
  return starts
}

export interface CowLike {
  id: string
  code: string
  name: string
  species: string
  gender: string
  status: string
  birthDate: string | Date
  motherId?: string | null
}

export interface CowCalving {
  cow: CowLike
  calves: number
  calvings: number
  intervals: number[]
  averageInterval: number | null
  lastCalving: string | null
  monthsSinceLast: number | null
  ageAtFirstCalving: number | null
  ageMonths: number
}

const average = (list: number[]) => (list.length ? Math.round(list.reduce((s, n) => s + n, 0) / list.length) : null)

export function cowCalving(cow: CowLike, herd: CowLike[], now = new Date()): CowCalving {
  const calves = herd.filter((a) => a.motherId === cow.id)
  const starts = calvingStarts(calves.map((c) => c.birthDate))
  const intervals = starts.slice(1).map((d, i) => monthsBetween(starts[i], d))
  const last = starts.at(-1) ?? null
  return {
    cow,
    calves: calves.length,
    calvings: starts.length,
    intervals,
    averageInterval: average(intervals),
    lastCalving: last,
    monthsSinceLast: last ? monthsBetween(last, now) : null,
    ageAtFirstCalving: starts[0] ? monthsBetween(cow.birthDate, starts[0]) : null,
    ageMonths: monthsBetween(cow.birthDate, now),
  }
}

export interface LateCow {
  stats: CowCalving
  /** "sem-parir": já criou e está demorando; "sem-cria": idade de criar e nenhuma cria anotada */
  reason: 'sem-parir' | 'sem-cria'
}

export interface HerdCalving {
  cows: CowCalving[]
  averageInterval: number | null
  averageAgeAtFirst: number | null
  late: LateCow[]
}

const isActiveCow = (a: CowLike, today: string) => canAddCalf(a, today) && a.status !== 'Morto' && a.status !== 'Vendido'

/**
 * Situação do rebanho. `pregnant`: vacas com cobertura/prenhez em aberto, que não contam como atrasadas.
 */
export function herdCalving(herd: CowLike[], pregnant: Set<string>, now = new Date()): HerdCalving {
  const cows = herd.filter(a => isActiveCow(a, animalToday(now))).map((c) => cowCalving(c, herd, now))
  const late: LateCow[] = []
  for (const s of cows) {
    if (pregnant.has(s.cow.id)) continue
    if (s.monthsSinceLast !== null && s.monthsSinceLast > LATE_MONTHS) late.push({ stats: s, reason: 'sem-parir' })
    else if (s.calvings === 0 && s.ageMonths >= FIRST_CALVING_AGE_MONTHS) late.push({ stats: s, reason: 'sem-cria' })
  }
  late.sort((a, b) => (b.stats.monthsSinceLast ?? b.stats.ageMonths) - (a.stats.monthsSinceLast ?? a.stats.ageMonths))
  return {
    cows,
    averageInterval: average(cows.flatMap((c) => c.intervals)),
    averageAgeAtFirst: average(cows.map((c) => c.ageAtFirstCalving).filter((n): n is number => n !== null)),
    late,
  }
}

/** Dias depois do parto para pedir a confirmação de prenhez (a partir da 1ª cria) */
export const PREGNANCY_CHECK_DAYS = 60
// Situações que respondem a pergunta "está prenha?" depois do parto
const ANSWERED = ['Prenha', 'Vazia', 'Perdida', 'Parida']

export interface ReproductionLike {
  id: string
  femaleId: string
  coverageDate: string | Date
  status: string
  observations?: string | null
}

export interface PregnancyCheck {
  cow: CowLike
  lastCalving: string
  daysSince: number
  /** Cobertura anotada depois do parto, ainda sem confirmação */
  openCoverage: ReproductionLike | null
}

/**
 * Vacas que já criaram e, 2 meses ou mais depois do último parto, ainda não têm prenhez confirmada
 * (nem foram dadas como vazias). Usado no sino e no painel da Reprodução.
 */
export function pregnancyChecks(herd: CowLike[], reproductions: ReproductionLike[], now = new Date()): PregnancyCheck[] {
  const today = animalToday(now)
  const checks: PregnancyCheck[] = []
  for (const cow of herd.filter((a) => isActiveCow(a, today))) {
    const last = calvingStarts(herd.filter((c) => c.motherId === cow.id).map((c) => c.birthDate)).at(-1)
    if (!last) continue
    const daysSince = Math.floor((now.getTime() - time(last)) / DAY)
    if (daysSince < PREGNANCY_CHECK_DAYS) continue
    const afterCalving = reproductions
      .filter((r) => r.femaleId === cow.id && time(r.coverageDate) > time(last))
      .sort((a, b) => time(b.coverageDate) - time(a.coverageDate))
    if (afterCalving.some((r) => ANSWERED.includes(r.status))) continue
    checks.push({ cow, lastCalving: last, daysSince, openCoverage: afterCalving.find((r) => r.status === 'Coberta') ?? null })
  }
  return checks.sort((a, b) => b.daysSince - a.daysSince)
}

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
export const monthsLabel = (n: number) => (n < 1 ? 'menos de 1 mês' : plural(n, 'mês', 'meses'))
