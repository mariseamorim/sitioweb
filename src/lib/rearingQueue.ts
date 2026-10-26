// Recria por animal no aparelho: a lista guardada para abrir sem internet e a fila do que ainda não subiu.
// Só no navegador (localStorage).

import { addPendingRecord, getPendingRecords, removePendingRecord } from './offlineStorage'
import { type HerdRef, type RearingAnimal, type RearingPending, applyPending, pendingRequest } from './rearing'

const MODULE = 'recria'
const cacheKey = (farmId: string) => `recria_cache_${farmId}`

export function readRearingCache(farmId: string): RearingAnimal[] {
  try {
    const list = JSON.parse(localStorage.getItem(cacheKey(farmId)) || '[]')
    return Array.isArray(list) ? list : []
  } catch {
    return []
  }
}

export function writeRearingCache(farmId: string, list: RearingAnimal[]) {
  try { localStorage.setItem(cacheKey(farmId), JSON.stringify(list)) } catch { /* sem espaço: segue só com internet */ }
}

export const pendingRearing = (farmId: string) => getPendingRecords(MODULE).filter((r) => r.farmId === farmId) as (RearingPending & { _pendingId: number })[]

export const queueRearing = (record: RearingPending) => addPendingRecord(MODULE, record)

/** Uma lista vinda do servidor mais o que ainda está na fila */
export const applyPendingTo = (farmId: string, list: RearingAnimal[], herd: HerdRef[]) => applyPending(list, pendingRearing(farmId), herd)

/** A lista como vai ficar depois da fila subir (cache + pendentes) */
export function rearingWithPending(farmId: string, herd: HerdRef[]) {
  return applyPending(readRearingCache(farmId), pendingRearing(farmId), herd)
}

/** Sobe a fila na ordem. Para no primeiro erro de rede; um erro de regra (400) descarta o item para não travar os outros. */
export async function syncRearing(farmId: string): Promise<{ sent: number; failed: number }> {
  let sent = 0
  let failed = 0
  for (const record of pendingRearing(farmId)) {
    const { url, method, body } = pendingRequest(record)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (res.ok || res.status === 400 || res.status === 404) {
        removePendingRecord(MODULE, record._pendingId)
        if (res.ok) sent++
        else failed++
      } else {
        failed++
        break
      }
    } catch {
      failed++
      break
    }
  }
  return { sent, failed }
}
