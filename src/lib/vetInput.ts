// Leitura dos campos que chegam nos formulários do veterinário (agenda, recibos e estoque)
import { isVetSupplyKind } from '@/lib/vetSupplyKinds'
import { validAnimalDate } from '@/lib/animalRules'

export const text = (v: unknown, max = 500) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

/** "2026-11-18" → meia-noite UTC desse dia; null se a data não for válida */
export function day(v: unknown): Date | null {
  const iso = validAnimalDate(v)
  return iso ? new Date(`${iso}T00:00:00.000Z`) : null
}

/** Número positivo. Com vírgula, o ponto é separador de milhar ("1.250,50"); sem vírgula, o ponto é decimal ("12.5") */
export function positive(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

export const hour = (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null)

/** Tipo do item do estoque do veterinário e, para sêmen, touro, raça e partida (os outros tipos ficam sem esses campos) */
export function kindFields(body: Record<string, unknown>) {
  const kind = isVetSupplyKind(body.kind) ? body.kind : 'outro'
  const semen = kind === 'semen'
  return { kind, bullName: semen ? text(body.bullName, 80) : null, bullBreed: semen ? text(body.bullBreed, 40) : null, semenBatch: semen ? text(body.semenBatch, 60) : null }
}
