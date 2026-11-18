// Índices zootécnicos do rebanho: taxa de serviço, concepção, prenhez, IEP, IPP e DPP. Só contas, sem banco:
// o site calcula no servidor e o aplicativo no aparelho (cópia idêntica em src/lib/herdIndices.ts do site —
// ao mudar um, mude o outro).

export interface HerdAnimal {
  id: string
  species: string
  gender: string
  status: string
  birthDate: string
  motherId: string | null
}

export interface HerdCoverage {
  femaleId: string
  coverageDate: string
  status: string
  actualBirthDate: string | null
}

export interface HerdIndices {
  /** Fêmeas bovinas vivas em idade de cobertura */
  females: number
  /** Com prenhez confirmada em aberto */
  pregnant: number
  /** Taxa de serviço: das vacas aptas (vazias e fora do período de espera pós-parto), quantas foram cobertas nos últimos 21 dias, em % */
  serviceRate: number | null
  eligible: number
  served: number
  /** Taxa de concepção: das coberturas diagnosticadas em 12 meses, quantas deram prenhez, em % */
  conceptionRate: number | null
  /** Taxa de prenhez em 21 dias: serviço × concepção, em % */
  pregnancyRate: number | null
  /** Intervalo entre partos, média em meses, e quantos intervalos entraram na conta */
  iep: number | null
  iepCount: number
  /** Idade ao primeiro parto, média em meses, e quantas vacas entraram na conta */
  ipp: number | null
  ippCount: number
  /** Dias pós-parto das vacas que já pariram e ainda não têm prenhez confirmada (média), e quantas são */
  dpp: number | null
  dppCount: number
}

const BOVINE = ['Vaca', 'Boi', 'Boi de engorda', 'Touro', 'Bezerro', 'Bezerra']
const DAY = 24 * 60 * 60 * 1000
/** Ciclo da vaca: a janela da taxa de serviço */
export const CYCLE_DAYS = 21
/** Período de espera voluntário depois do parto, antes de voltar a cobrir */
export const WAITING_DAYS = 45
const BREEDING_AGE_DAYS = 730
/** Crias nascidas com até estes dias de diferença são do mesmo parto (gêmeos) */
const SAME_CALVING_DAYS = 30

const time = (iso: string) => Date.parse(iso.slice(0, 10))
const average = (list: number[]) => (list.length ? list.reduce((sum, n) => sum + n, 0) / list.length : null)
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10)

/**
 * `conceptionRate` vem dos indicadores de reprodução (a mesma conta do gráfico), para os dois números baterem.
 * `today` é "AAAA-MM-DD".
 */
export function buildHerdIndices(animals: HerdAnimal[], coverages: HerdCoverage[], conceptionRate: number | null, today: string): HerdIndices {
  const now = time(today)
  const females = animals.filter((a) => a.gender === 'Fêmea' && BOVINE.includes(a.species) && a.status !== 'Morto' && a.status !== 'Vendido'
    && now - time(a.birthDate) >= BREEDING_AGE_DAYS * DAY)

  // Partos de cada vaca, pelas datas de nascimento das crias
  const calvingsOf = new Map<string, number[]>()
  for (const calf of animals) {
    if (!calf.motherId) continue
    const list = calvingsOf.get(calf.motherId) ?? []
    list.push(time(calf.birthDate))
    calvingsOf.set(calf.motherId, list)
  }
  const starts = (id: string) => {
    const out: number[] = []
    for (const t of (calvingsOf.get(id) ?? []).sort((a, b) => a - b)) if (!out.length || (t - out[out.length - 1]) / DAY > SAME_CALVING_DAYS) out.push(t)
    return out
  }

  const pregnantIds = new Set(coverages.filter((c) => c.status === 'Prenha' && !c.actualBirthDate).map((c) => c.femaleId))
  const windowStart = now - CYCLE_DAYS * DAY
  const servedIds = new Set(coverages.filter((c) => time(c.coverageDate) >= windowStart && time(c.coverageDate) <= now).map((c) => c.femaleId))
  // Prenha de uma cobertura anterior à janela não estava disponível para ser coberta nela
  const pregnantBefore = new Set(coverages.filter((c) => c.status === 'Prenha' && !c.actualBirthDate && time(c.coverageDate) < windowStart).map((c) => c.femaleId))

  const intervals: number[] = []
  const firstAges: number[] = []
  const open: number[] = []
  let eligible = 0
  let served = 0
  for (const cow of females) {
    const calvings = starts(cow.id)
    for (let i = 1; i < calvings.length; i++) intervals.push((calvings[i] - calvings[i - 1]) / DAY / 30.44)
    if (calvings.length) firstAges.push((calvings[0] - time(cow.birthDate)) / DAY / 30.44)
    const last = calvings.length ? calvings[calvings.length - 1] : null
    const daysSince = last === null ? null : (now - last) / DAY
    if (daysSince !== null && daysSince >= 0 && !pregnantIds.has(cow.id)) open.push(daysSince)
    if (!pregnantBefore.has(cow.id) && (daysSince === null || daysSince >= WAITING_DAYS)) {
      eligible++
      if (servedIds.has(cow.id)) served++
    }
  }

  const serviceRate = eligible ? Math.round((served / eligible) * 100) : null
  const dpp = average(open)
  return {
    females: females.length,
    pregnant: females.filter((f) => pregnantIds.has(f.id)).length,
    serviceRate,
    eligible,
    served,
    conceptionRate,
    pregnancyRate: serviceRate === null || conceptionRate === null ? null : Math.round((serviceRate * conceptionRate) / 100),
    iep: round1(average(intervals)),
    iepCount: intervals.length,
    ipp: round1(average(firstAges)),
    ippCount: firstAges.length,
    dpp: dpp === null ? null : Math.round(dpp),
    dppCount: open.length,
  }
}
