// Vacas em lactação, pelos lançamentos de leite (sem banco; cópia de src/lib/lactating.ts do site).
// Num dia: o maior entre "vacas ordenhadas" do lançamento total e as vacas com leite anotado uma a uma.
// Hoje: o dia mais recente com leite nos últimos 7 dias. Por mês: a média dos dias com leite.

export interface LactatingMilk { date: string; animalId?: string | null; cowsMilked?: number | null }

function byDay(milk: LactatingMilk[]): Map<string, number> {
  const total = new Map<string, number>()
  const cows = new Map<string, Set<string>>()
  for (const m of milk) {
    const day = m.date.slice(0, 10)
    if (m.animalId) cows.set(day, (cows.get(day) ?? new Set()).add(m.animalId))
    else if (m.cowsMilked) total.set(day, Math.max(total.get(day) ?? 0, m.cowsMilked))
  }
  const days = new Set([...total.keys(), ...cows.keys()])
  return new Map([...days].map((d) => [d, Math.max(total.get(d) ?? 0, cows.get(d)?.size ?? 0)]))
}

/** Vacas em lactação agora (dia mais recente com leite nos últimos 7 dias); null sem dado */
export function lactatingNow(milk: LactatingMilk[], today: string): number | null {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - 6 * 86_400_000).toISOString().slice(0, 10)
  const days = [...byDay(milk).entries()].filter(([d, n]) => d >= from && d <= today && n > 0).sort((a, b) => b[0].localeCompare(a[0]))
  return days[0]?.[1] ?? null
}

/** Média de vacas em lactação em cada mês ("AAAA-MM"); null no mês sem dado */
export function lactatingByMonth(milk: LactatingMilk[], months: string[]): (number | null)[] {
  const days = [...byDay(milk).entries()].filter(([, n]) => n > 0)
  return months.map((m) => {
    const own = days.filter(([d]) => d.startsWith(m))
    return own.length ? Math.round(own.reduce((s, [, n]) => s + n, 0) / own.length) : null
  })
}

/** Meta válida: número inteiro de 1 a 10.000; null apaga; 'invalid' com valor errado */
export function parseGoal(v: unknown): number | null | 'invalid' {
  if (v === null || v === '' || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(String(v).trim())
  return Number.isInteger(n) && n >= 1 && n <= 10000 ? n : 'invalid'
}
