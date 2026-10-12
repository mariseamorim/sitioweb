export function milkNumber(value: unknown) {
  if (typeof value !== 'number' && typeof value !== 'string') return NaN
  const text = String(value).trim().replace(',', '.')
  return /^\d+(?:\.\d+)?$/.test(text) ? Number(text) : NaN
}

export function milkPrice(value: unknown): number | null | undefined {
  if (value === null || value === '') return null
  const price = milkNumber(value)
  return Number.isFinite(price) && price > 0 && price < 1000 ? Math.round(price * 10000) / 10000 : undefined
}

export function milkDay(value: unknown): Date | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null
}
