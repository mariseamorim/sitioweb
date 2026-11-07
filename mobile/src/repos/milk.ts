import { all, getMeta, setMeta } from '@/db'
import { notifyChange } from '@/db/events'
import { isoDay } from '@/lib/format'
import { createLocal, deleteLocal, updateLocal } from '@/sync/local'
import { api } from '@/api/client'

export interface Milk {
  id: string
  animalId: string | null
  date: string
  quantity: number
  pricePerLiter: number | null
  cowsMilked: number | null
  source: string | null
  observations: string | null
  animalName: string | null
}

export function listMilk(farmId: string, from: string, to: string): Milk[] {
  return all<Milk>(
    `SELECT m.*, a.name AS animalName FROM milk m LEFT JOIN animals a ON a.id = m.animalId
     WHERE m.farmId = ? AND substr(m.date, 1, 10) >= ? AND substr(m.date, 1, 10) <= ? ORDER BY m.date DESC, m.createdAt DESC`,
    [farmId, from, to],
  )
}

export interface MilkDay { day: string; total: number; cows: number | null; value: number; items: Milk[] }

/** Agrupa por dia: total de litros, vacas (do lançamento do dia) e valor pelos preços de cada lançamento. */
export function groupByDay(items: Milk[]): MilkDay[] {
  const map = new Map<string, MilkDay>()
  for (const m of items) {
    const day = isoDay(m.date)
    let g = map.get(day)
    if (!g) { g = { day, total: 0, cows: null, value: 0, items: [] }; map.set(day, g) }
    g.total += m.quantity
    g.value += m.quantity * (m.pricePerLiter ?? 0)
    if (m.cowsMilked) g.cows = (g.cows ?? 0) + m.cowsMilked
    g.items.push(m)
  }
  return [...map.values()].sort((a, b) => (a.day < b.day ? 1 : -1))
}

export function getMilkPrice(farmId: string): number | null {
  const v = getMeta(`milkPrice:${farmId}`)
  return v ? Number(v) : null
}

export async function setMilkPrice(farmId: string, price: number | null) {
  setMeta(`milkPrice:${farmId}`, price === null ? '' : String(price))
  notifyChange()
  await api('/api/milk-production/price', { method: 'PUT', body: { price } })
}

export interface MilkInput { date: string; quantity: number; cowsMilked: number | null; animalId: string | null; pricePerLiter: number | null; observations: string }

export function saveMilk(farmId: string, input: MilkInput, id?: string): string {
  const body = {
    date: input.date, quantity: input.quantity, cowsMilked: input.animalId ? null : input.cowsMilked, animalId: input.animalId || null,
    pricePerLiter: input.pricePerLiter, observations: input.observations.trim() || null,
  }
  if (id) {
    updateLocal({ table: 'milk', farmId, id, path: `/api/milk-production/${id}`, body })
    return id
  }
  return createLocal({ table: 'milk', farmId, path: '/api/milk-production', body })
}

export function removeMilk(farmId: string, id: string) {
  deleteLocal({ table: 'milk', farmId, id, path: `/api/milk-production/${id}` })
}
