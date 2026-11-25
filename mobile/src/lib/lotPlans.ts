// Cópia de src/lib/lotPlans.ts do site (regra pura, sem banco): mantenha as duas iguais.
// Plano de recria/engorda: etapas com ganho por dia (GMD), dias e peso ao fim, e a meta de peso final.
// O desempenho do lote compara o lote com o plano (Performance em mobile/app/engorda/[id].tsx).

export interface PlanStage {
  /** Nome livre: cria, recria, engorda, terminação... */
  name: string
  /** Ganho médio diário esperado (kg/dia) */
  gmd: number | null
  /** Duração da etapa (dias) */
  days: number | null
  /** Peso esperado ao fim da etapa (kg) */
  weight: number | null
}

export interface LotPlan {
  id: string
  name: string
  description: string | null
  active: boolean
  stages: PlanStage[]
  targetWeight: number | null
}

export const MAX_STAGES = 5

/** Duração do plano: soma dos dias das etapas */
export const planDays = (plan: Pick<LotPlan, 'stages'>) => plan.stages.reduce((sum, s) => sum + (s.days ?? 0), 0)

const num = (v: unknown, max: number): number | null => {
  if (v === null || v === undefined || v === '') return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n <= max ? Math.round(n * 1000) / 1000 : null
}

/** Etapas recebidas do formulário: só as que têm nome ou algum número, no máximo 5 */
export function parseStages(value: unknown): PlanStage[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, MAX_STAGES).map((raw) => {
    const s = (raw ?? {}) as Record<string, unknown>
    return {
      name: typeof s.name === 'string' ? s.name.trim().slice(0, 60) : '',
      gmd: num(s.gmd, 10),
      days: num(s.days, 3650) === null ? null : Math.round(num(s.days, 3650)!),
      weight: num(s.weight, 2000),
    }
  }).filter((s) => s.name || s.gmd !== null || s.days !== null || s.weight !== null)
}

/**
 * Peso esperado pelo plano depois de `days` dias no lote, partindo do peso de entrada:
 * soma o GMD de cada etapa pelos dias percorridos. null se o plano não tem GMD.
 */
export function expectedWeight(plan: Pick<LotPlan, 'stages'>, entryWeight: number, days: number): number | null {
  if (!plan.stages.some((s) => s.gmd !== null && s.days !== null)) return null
  let weight = entryWeight
  let left = days
  for (const s of plan.stages) {
    if (left <= 0 || s.gmd === null || s.days === null) continue
    const d = Math.min(left, s.days)
    weight += s.gmd * d
    left -= d
  }
  return Math.round(weight * 10) / 10
}
