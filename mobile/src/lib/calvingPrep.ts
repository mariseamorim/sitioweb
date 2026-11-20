// Lembretes antes do parto, a partir do parto previsto da cobertura em andamento:
// - secagem: parar de ordenhar a vaca 60 dias antes do parto (só vaca que já pariu, em propriedade de leite);
// - pré-parto: levar para o lote de pré-parto 21 dias antes do parto (vacas e novilhas).
// O lembrete aparece 7 dias antes da data e some 3 dias depois dela (o sistema não sabe se já foi feito).
// Cópia de src/lib/calvingPrep.ts do site: mudar os dois juntos.

export const DRY_OFF_DAYS = 60
export const PRE_CALVING_DAYS = 21
const AHEAD = 7
const AFTER = 3
const DAY = 86_400_000

export type PrepKind = 'secagem' | 'preparto'
export interface PrepStep {
  kind: PrepKind
  /** Dia de fazer ("AAAA-MM-DD") */
  date: string
  /** A data já passou */
  late: boolean
}

const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00.000Z`) + days * DAY).toISOString().slice(0, 10)

/** Partos previstos que podem ter lembrete hoje: buscar as coberturas com o parto previsto entre `from` e `to` */
export function prepRange(today: string): { from: string; to: string } {
  return { from: shift(today, PRE_CALVING_DAYS - AFTER), to: shift(today, DRY_OFF_DAYS + AHEAD) }
}

/** Lembretes de hoje para um parto previsto. `canDryOff`: vaca em lactação numa propriedade de leite. */
export function prepSteps(expectedBirth: string, today: string, canDryOff: boolean): PrepStep[] {
  const steps: PrepStep[] = []
  const add = (kind: PrepKind, daysBefore: number) => {
    const date = shift(expectedBirth.slice(0, 10), -daysBefore)
    if (date <= shift(today, AHEAD) && date >= shift(today, -AFTER)) steps.push({ kind, date, late: date < today })
  }
  if (canDryOff) add('secagem', DRY_OFF_DAYS)
  add('preparto', PRE_CALVING_DAYS)
  return steps
}
