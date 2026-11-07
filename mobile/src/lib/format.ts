// Datas e números no formato brasileiro. As datas do servidor vêm em ISO (UTC, meia-noite); o app trabalha com "AAAA-MM-DD".

const TZ = 'America/Sao_Paulo'

/** Hoje em Brasília, como "AAAA-MM-DD" (o celular pode estar em outro fuso). */
export function todayISO(now = new Date()): string {
  return now.toLocaleDateString('en-CA', { timeZone: TZ })
}

/** "2026-11-07T00:00:00.000Z" ou "2026-11-07" → "2026-11-07" */
export function isoDay(value: string | null | undefined): string {
  if (!value) return ''
  return value.slice(0, 10)
}

/** "2026-11-07" → "07/11/2026" */
export function brDate(value: string | null | undefined): string {
  const day = isoDay(value)
  if (!day) return '—'
  const [y, m, d] = day.split('-')
  return `${d}/${m}/${y}`
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
export function weekday(value: string): string {
  const day = isoDay(value)
  if (!day) return ''
  return WEEKDAYS[new Date(day + 'T12:00:00Z').getUTCDay()]
}

export function addDays(day: string, days: number): string {
  const d = new Date(day + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function brNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value.toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function brMoney(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** "12,5" ou "12.5" → 12.5; vazio → null; inválido → NaN */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(/\./g, '').replace(',', '.')
  if (!t) return null
  return Number(t)
}

/** Idade em texto curto a partir da data de nascimento. */
export function ageText(birthDate: string | null | undefined, today = todayISO()): string {
  const b = isoDay(birthDate)
  if (!b) return ''
  const months = (Number(today.slice(0, 4)) - Number(b.slice(0, 4))) * 12 + (Number(today.slice(5, 7)) - Number(b.slice(5, 7)))
  if (months < 1) return 'recém-nascido'
  if (months < 24) return `${months} ${months === 1 ? 'mês' : 'meses'}`
  return `${Math.floor(months / 12)} anos`
}
