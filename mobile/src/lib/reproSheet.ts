// Ficha reprodutiva: uma linha por fêmea em idade de reprodução, como a planilha que o veterinário leva ao curral.
// Último parto, DEL, última IA, nº de IAs, dias desde a IA, touro/sêmen, status, dias de prenhez e parto previsto.
// Sem banco: cópia de src/lib/reproSheet.ts do site (o servidor e o app usam a mesma regra).
import { calvingStarts } from '@/lib/calving'

export type SheetStatus = 'Prenha' | 'Inseminada' | 'Vazia' | 'Em aberto' | 'Seca'

export const SHEET_STATUSES: { key: SheetStatus; label: string }[] = [
  { key: 'Inseminada', label: 'Inseminadas (a diagnosticar)' },
  { key: 'Em aberto', label: 'Em aberto (sem cobertura)' },
  { key: 'Vazia', label: 'Vazias' },
  { key: 'Prenha', label: 'Prenhas' },
  { key: 'Seca', label: 'Secas' },
]

export interface SheetFemale { id: string; code: string; customCode?: string | null; name: string; status?: string | null; motherId?: string | null }
export interface SheetCalf { motherId: string | null; birthDate: string }
export interface SheetCoverage {
  id: string; femaleId: string; coverageDate: string; status: string
  maleName?: string | null; bullBreed?: string | null; semenBatch?: string | null; method?: string | null
  expectedBirthDate?: string | null; actualBirthDate?: string | null
}

export interface SheetRow {
  femaleId: string
  animal: string
  lastCalving: string | null
  /** Dias em lactação (do parto até hoje, ou até a secagem) */
  del: number | null
  lastIA: string | null
  /** Coberturas desde o último parto */
  iaCount: number
  /** Dias desde a última cobertura */
  daysSinceIA: number | null
  bull: string
  status: SheetStatus
  /** Dias de prenhez (só prenha) */
  daysPregnant: number | null
  expectedBirth: string | null
}

const DAY = 86_400_000
const day = (v: string) => v.slice(0, 10)
const between = (from: string, to: string) => Math.max(0, Math.round((Date.parse(`${day(to)}T00:00:00Z`) - Date.parse(`${day(from)}T00:00:00Z`)) / DAY))

/**
 * `females`: fêmeas em idade de reprodução (a tela escolhe quais entram).
 * `dried`: secagens marcadas como feitas na agenda, por cobertura ("secagem:<id>" → dia).
 */
export function buildReproSheet(females: SheetFemale[], calves: SheetCalf[], coverages: SheetCoverage[], today: string, dried: Map<string, string> = new Map()): SheetRow[] {
  return females.filter((f) => f.status !== 'Morto' && f.status !== 'Vendido').map((f) => {
    const own = coverages.filter((c) => c.femaleId === f.id).sort((a, b) => a.coverageDate.localeCompare(b.coverageDate))
    // Último parto: pela cria registrada ou pelo parto anotado na cobertura
    const births = [...calves.filter((c) => c.motherId === f.id).map((c) => c.birthDate), ...own.flatMap((c) => (c.actualBirthDate ? [c.actualBirthDate] : []))]
    const lastCalving = calvingStarts(births).at(-1) ?? null
    const after = lastCalving ? own.filter((c) => day(c.coverageDate) > day(lastCalving)) : own
    const last = after.at(-1) ?? null

    let status: SheetStatus = 'Em aberto'
    if (last?.status === 'Prenha') status = 'Prenha'
    else if (last?.status === 'Coberta') status = 'Inseminada'
    else if (last && (last.status === 'Vazia' || last.status === 'Perdida')) status = 'Vazia'
    const driedOn = last ? dried.get(last.id) : undefined
    if (driedOn && status === 'Prenha') status = 'Seca'

    const bull = last ? [last.maleName, last.bullBreed, last.semenBatch ? `partida ${last.semenBatch}` : null].filter(Boolean).join(' · ') : ''
    return {
      femaleId: f.id,
      animal: `${f.customCode || f.code} ${f.name}`.trim(),
      lastCalving: lastCalving ? day(lastCalving) : null,
      del: lastCalving ? between(lastCalving, driedOn ?? today) : null,
      lastIA: last ? day(last.coverageDate) : null,
      iaCount: after.length,
      daysSinceIA: last ? between(last.coverageDate, today) : null,
      bull,
      status,
      daysPregnant: (status === 'Prenha' || status === 'Seca') && last ? between(last.coverageDate, today) : null,
      expectedBirth: (status === 'Prenha' || status === 'Seca' || status === 'Inseminada') && last?.expectedBirthDate ? day(last.expectedBirthDate) : null,
    }
  }).sort((a, b) => a.animal.localeCompare(b.animal, 'pt-BR', { numeric: true }))
}

/** Resumo do topo: quantas em cada status e o DEL médio das que estão em lactação */
export function sheetSummary(rows: SheetRow[]) {
  const count = (s: SheetStatus) => rows.filter((r) => r.status === s).length
  const lactating = rows.filter((r) => r.del !== null && r.status !== 'Seca')
  return {
    total: rows.length,
    prenha: count('Prenha') + count('Seca'),
    inseminada: count('Inseminada'),
    emAberto: count('Em aberto'),
    vazia: count('Vazia'),
    delMedio: lactating.length ? Math.round(lactating.reduce((s, r) => s + r.del!, 0) / lactating.length) : null,
  }
}
