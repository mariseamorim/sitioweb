// Concepção por touro e por inseminador: das coberturas dos últimos 12 meses que já têm diagnóstico,
// quantas ficaram prenhas. Mesma conta da taxa de concepção (src/lib/reproInsights.ts), agrupada.
// Sem banco; cópia de src/lib/conceptionBy.ts do site.

export interface ConceptionCoverage {
  coverageDate: string
  status: string
  maleName?: string | null
  bullBreed?: string | null
  inseminator?: string | null
}

export interface GroupRate {
  /** Nome como foi anotado mais vezes */
  label: string
  /** Raça do touro (a anotada mais vezes), quando houver */
  breed: string | null
  diagnosed: number
  pregnant: number
  /** Prenhas ÷ diagnosticadas, em %; null sem diagnóstico */
  rate: number | null
  /** Coberturas ainda sem diagnóstico */
  awaiting: number
  /** Menos de 5 diagnósticos: a taxa ainda varia muito */
  fewData: boolean
}

export interface ConceptionBy {
  bulls: GroupRate[]
  inseminators: GroupRate[]
  /** Coberturas diagnosticadas sem touro anotado (para a tela pedir que anotem) */
  withoutBull: number
}

/** A perdida estava prenha quando foi diagnosticada (como em reproInsights) */
const PREGNANT = ['Prenha', 'Parida', 'Perdida']
const MIN_DIAGNOSED = 5

/** "  Netuno  FIV " e "netuno fiv" contam como o mesmo touro */
const keyOf = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('pt-BR')

const mostCommon = (values: string[]) => {
  const count = new Map<string, number>()
  for (const v of values) count.set(v, (count.get(v) ?? 0) + 1)
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
}

function group(coverages: ConceptionCoverage[], nameOf: (c: ConceptionCoverage) => string | null | undefined, withBreed: boolean): GroupRate[] {
  const groups = new Map<string, ConceptionCoverage[]>()
  for (const c of coverages) {
    const name = nameOf(c)?.trim()
    if (!name) continue
    const k = keyOf(name)
    groups.set(k, [...(groups.get(k) ?? []), c])
  }
  return [...groups.values()].map((list) => {
    const diagnosed = list.filter((c) => c.status !== 'Coberta')
    const pregnant = diagnosed.filter((c) => PREGNANT.includes(c.status)).length
    return {
      label: mostCommon(list.map((c) => nameOf(c)!.trim().replace(/\s+/g, ' ')))!,
      breed: !withBreed ? null : mostCommon(list.map((c) => c.bullBreed?.trim()).filter((b): b is string => !!b)),
      diagnosed: diagnosed.length,
      pregnant,
      rate: diagnosed.length ? Math.round((pregnant / diagnosed.length) * 100) : null,
      awaiting: list.length - diagnosed.length,
      fewData: diagnosed.length < MIN_DIAGNOSED,
    }
  }).sort((a, b) => Number(a.fewData) - Number(b.fewData) || (b.rate ?? -1) - (a.rate ?? -1) || b.diagnosed - a.diagnosed)
}

/** Coberturas a partir de `from` ("AAAA-MM-DD"), agrupadas por touro e por inseminador */
export function conceptionBy(coverages: ConceptionCoverage[], from: string): ConceptionBy {
  const recent = coverages.filter((c) => c.coverageDate.slice(0, 10) >= from)
  return {
    bulls: group(recent, (c) => c.maleName, true),
    inseminators: group(recent, (c) => c.inseminator, false),
    withoutBull: recent.filter((c) => c.status !== 'Coberta' && !c.maleName?.trim()).length,
  }
}
