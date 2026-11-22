// Agenda: o que fazer em cada dia (visitas e manejos do rebanho), a partir dos registros.
// Sem banco: cópia de src/lib/agenda.ts do site (o servidor e o app usam a mesma regra).
import { DRY_OFF_DAYS, PRE_CALVING_DAYS } from '@/lib/calvingPrep'

export type AgendaKind = 'visita' | 'vacina' | 'parto' | 'secagem' | 'preparto' | 'diagnostico' | 'cio' | 'carencia'

/** Ordem dos tipos no mesmo dia e nos filtros */
export const AGENDA_KINDS: { kind: AgendaKind; label: string }[] = [
  { kind: 'visita', label: 'Visitas' },
  { kind: 'vacina', label: 'Vacinas' },
  { kind: 'parto', label: 'Partos' },
  { kind: 'secagem', label: 'Secagem' },
  { kind: 'preparto', label: 'Pré-parto' },
  { kind: 'diagnostico', label: 'Diagnóstico' },
  { kind: 'cio', label: 'Retorno ao cio' },
  { kind: 'carencia', label: 'Carência' },
]

/** Diagnóstico de gestação: a partir de 28 dias depois da cobertura */
export const DIAGNOSIS_DAYS = 28
/** Retorno ao cio esperado se a vaca não emprenhou: 21 dias depois da cobertura */
export const HEAT_RETURN_DAYS = 21
/** Retorno ao cio, secagem e pré-parto somem da agenda 3 dias depois da data (o app não sabe se já foi feito) */
const AFTER = 3
/** Partos e diagnósticos atrasados ficam na agenda até registrar, mas não para sempre */
const LATE_LIMIT_DAYS = 90

export interface AgendaItem {
  /** Único na lista: tipo + registro de origem */
  key: string
  kind: AgendaKind
  /** Dia ("AAAA-MM-DD") */
  date: string
  /** A data já passou e ainda está pendente */
  late: boolean
  /** Texto com {variáveis}, para traduzir na tela */
  label: string
  vars: Record<string, string | number>
  detail?: string
  detailVars?: Record<string, string | number>
  /** Registro de origem: vacinação, cobertura, tratamento ou visita */
  refId: string
  animalId?: string
  farmId?: string
  farmName?: string
  /** Horário da visita ("14:30") */
  time?: string | null
}

export interface AgendaAnimal { id: string; name: string | null; code?: string | null; species: string; motherId?: string | null }
export interface AgendaReproduction { id: string; femaleId: string; coverageDate: string; status: string; expectedBirthDate: string | null; actualBirthDate: string | null }
export interface AgendaVaccination { id: string; animalId: string; vaccineName: string; scheduledDate: string; appliedDate: string | null }
export interface AgendaTreatment { id: string; animalId: string; medicine: string; startDate: string; endDate: string | null; milkWithdrawalDays: number | null; meatWithdrawalDays: number | null }

export interface AgendaInput {
  /** Hoje ("AAAA-MM-DD") */
  today: string
  /** Último dia mostrado */
  until: string
  /** Propriedade de leite: só nela a vaca é secada */
  dairy: boolean
  animals: AgendaAnimal[]
  reproductions?: AgendaReproduction[]
  vaccinations?: AgendaVaccination[]
  treatments?: AgendaTreatment[]
  farmId?: string
  farmName?: string
}

const DAY = 86_400_000
export const shiftDay = (day: string, days: number) => new Date(Date.parse(`${day.slice(0, 10)}T00:00:00.000Z`) + days * DAY).toISOString().slice(0, 10)
/** "AAAA-MM-DD" → "DD/MM" */
export const ddmm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`

/** Manejos com data entre `today` (e os atrasados) e `until`, ordenados por dia */
export function buildAgenda(input: AgendaInput): AgendaItem[] {
  const { today, until } = input
  const items: AgendaItem[] = []
  const byId = new Map(input.animals.map((a) => [a.id, a]))
  const mothers = new Set(input.animals.map((a) => a.motherId).filter(Boolean))
  const nameOf = (id: string) => { const a = byId.get(id); return a?.name || a?.code || '—' }
  const where = { farmId: input.farmId, farmName: input.farmName }
  const add = (item: Omit<AgendaItem, 'late' | 'farmId' | 'farmName'>, lateOk: boolean, lateLimit = LATE_LIMIT_DAYS) => {
    if (item.date > until) return
    const late = item.date < today
    if (late && (!lateOk || item.date < shiftDay(today, -lateLimit))) return
    items.push({ ...item, late, ...where })
  }

  for (const v of input.vaccinations ?? []) {
    if (v.appliedDate || !byId.has(v.animalId)) continue
    add({ key: `vacina:${v.id}`, kind: 'vacina', date: v.scheduledDate.slice(0, 10), label: 'Vacinar {animal}: {vaccine}', vars: { animal: nameOf(v.animalId), vaccine: v.vaccineName }, refId: v.id, animalId: v.animalId }, true, 180)
  }

  for (const r of input.reproductions ?? []) {
    if (r.actualBirthDate || !byId.has(r.femaleId)) continue
    const animal = nameOf(r.femaleId)
    const base = { refId: r.id, animalId: r.femaleId }
    if (r.status === 'Coberta') {
      const covered = r.coverageDate.slice(0, 10)
      add({ ...base, key: `cio:${r.id}`, kind: 'cio', date: shiftDay(covered, HEAT_RETURN_DAYS), label: 'Observar retorno ao cio: {animal}', vars: { animal }, detail: 'Coberta em {date}', detailVars: { date: ddmm(covered) } }, true, AFTER)
      add({ ...base, key: `diagnostico:${r.id}`, kind: 'diagnostico', date: shiftDay(covered, DIAGNOSIS_DAYS), label: 'Diagnóstico de gestação: {animal}', vars: { animal }, detail: 'Coberta em {date}', detailVars: { date: ddmm(covered) } }, true)
    }
    if ((r.status === 'Coberta' || r.status === 'Prenha') && r.expectedBirthDate) {
      const birth = r.expectedBirthDate.slice(0, 10)
      const detailVars = { date: ddmm(birth) }
      add({ ...base, key: `parto:${r.id}`, kind: 'parto', date: birth, label: 'Parto previsto: {animal}', vars: { animal } }, true)
      const a = byId.get(r.femaleId)!
      if (input.dairy && (mothers.has(r.femaleId) || a.species === 'Vaca')) {
        add({ ...base, key: `secagem:${r.id}`, kind: 'secagem', date: shiftDay(birth, -DRY_OFF_DAYS), label: 'Secar {animal}', vars: { animal }, detail: 'Parto previsto em {date}', detailVars }, true, AFTER)
      }
      add({ ...base, key: `preparto:${r.id}`, kind: 'preparto', date: shiftDay(birth, -PRE_CALVING_DAYS), label: 'Levar ao pré-parto: {animal}', vars: { animal }, detail: 'Parto previsto em {date}', detailVars }, true, AFTER)
    }
  }

  for (const t of input.treatments ?? []) {
    if (!byId.has(t.animalId)) continue
    const end = (t.endDate ?? t.startDate).slice(0, 10)
    const animal = nameOf(t.animalId)
    // Carência contada do fim do tratamento: o último dia bloqueado é fim + dias; libera no dia seguinte
    if (t.milkWithdrawalDays) add({ key: `carencia-leite:${t.id}`, kind: 'carencia', date: shiftDay(end, t.milkWithdrawalDays + 1), label: 'Leite de {animal} pode voltar ao tanque', vars: { animal }, detail: 'Carência de {medicine}', detailVars: { medicine: t.medicine }, refId: t.id, animalId: t.animalId }, false)
    if (t.meatWithdrawalDays) add({ key: `carencia-abate:${t.id}`, kind: 'carencia', date: shiftDay(end, t.meatWithdrawalDays + 1), label: '{animal} liberado para o abate', vars: { animal }, detail: 'Carência de {medicine}', detailVars: { medicine: t.medicine }, refId: t.id, animalId: t.animalId }, false)
  }

  return sortAgenda(items)
}

const kindOrder = new Map(AGENDA_KINDS.map((k, i) => [k.kind, i]))
export const sortAgenda = (items: AgendaItem[]) =>
  [...items].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? '') || kindOrder.get(a.kind)! - kindOrder.get(b.kind)!)

export type AgendaGroupKey = 'atrasados' | 'hoje' | 'amanha' | 'semana' | 'depois'
export const AGENDA_GROUPS: { key: AgendaGroupKey; label: string }[] = [
  { key: 'atrasados', label: 'Atrasados' },
  { key: 'hoje', label: 'Hoje' },
  { key: 'amanha', label: 'Amanhã' },
  { key: 'semana', label: 'Próximos 7 dias' },
  { key: 'depois', label: 'Depois' },
]

export function agendaGroup(item: AgendaItem, today: string): AgendaGroupKey {
  if (item.date < today) return 'atrasados'
  if (item.date === today) return 'hoje'
  if (item.date === shiftDay(today, 1)) return 'amanha'
  if (item.date <= shiftDay(today, 7)) return 'semana'
  return 'depois'
}

/** Itens por grupo, na ordem dos grupos; grupos vazios ficam de fora */
export function groupAgenda(items: AgendaItem[], today: string) {
  return AGENDA_GROUPS.map((g) => ({ ...g, items: items.filter((i) => agendaGroup(i, today) === g.key) })).filter((g) => g.items.length)
}

/** Quantos itens em cada dia (para a faixa da semana e o mês) */
export function countByDay(items: AgendaItem[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const i of items) m.set(i.date, (m.get(i.date) ?? 0) + 1)
  return m
}

/** Texto para mandar pelo WhatsApp: um item por linha, com o dia e a propriedade */
export function agendaShareText(items: AgendaItem[], title: string, t: (text: string, vars?: Record<string, string | number>) => string): string {
  const lines = items.map((i) => `• ${ddmm(i.date)}${i.time ? ` ${i.time}` : ''} – ${t(i.label, i.vars)}${i.farmName ? ` (${i.farmName})` : ''}${i.late ? ` – ${t('atrasado')}` : ''}`)
  return [`*${title}*`, ...lines].join('\n')
}
