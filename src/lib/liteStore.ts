// Dados do Anota Aí Leite guardados no aparelho e fila de envio.
// A tela sempre lê daqui; o servidor só recebe e devolve a cópia oficial.
import type { LiteChange, LiteData, LiteEntry } from '@/lib/lite'

const CACHE_KEY = 'lite_cache_v1'
const QUEUE_KEY = 'lite_queue_v1'

type Queue = Record<string, LiteChange>

const keyOf = (c: { pointId: string; date: string }) => `${c.pointId}|${c.date}`

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Sem espaço ou armazenamento bloqueado: a fila em memória da tela ainda segura o dado
  }
}

export function readCache(): LiteData | null {
  return read<LiteData | null>(CACHE_KEY, null)
}

export function writeCache(data: LiteData) {
  write(CACHE_KEY, data)
}

export function pendingChanges(): LiteChange[] {
  return Object.values(read<Queue>(QUEUE_KEY, {}))
}

/** Aplica alterações sobre os dados (usado para mostrar na hora o que ainda não foi enviado). */
export function applyChanges(data: LiteData, changes: LiteChange[]): LiteData {
  const map = new Map<string, LiteEntry>(data.entries.map((e) => [keyOf(e), e]))
  for (const c of changes) {
    if (c.liters === null) map.delete(keyOf(c))
    else map.set(keyOf(c), { pointId: c.pointId, date: c.date, liters: c.liters })
  }
  return { ...data, entries: [...map.values()] }
}

/** Guarda alterações na fila. Para o mesmo local e dia, vale a última. */
export function enqueue(changes: LiteChange[]) {
  const queue = read<Queue>(QUEUE_KEY, {})
  for (const c of changes) queue[keyOf(c)] = c
  write(QUEUE_KEY, queue)
  const cache = readCache()
  if (cache) writeCache(applyChanges(cache, changes))
}

export type SyncResult = 'ok' | 'offline' | 'auth' | 'error'

/** Envia a fila. Só remove o que o servidor confirmou e que não mudou durante o envio. */
export async function flushQueue(): Promise<SyncResult> {
  const sent = pendingChanges()
  if (sent.length === 0) return 'ok'
  let res: Response
  try {
    res = await fetch('/api/lite', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: sent }),
    })
  } catch {
    return 'offline'
  }
  if (res.status === 401) return 'auth'
  if (!res.ok) return 'error'

  const queue = read<Queue>(QUEUE_KEY, {})
  for (const c of sent) {
    const current = queue[keyOf(c)]
    if (current && current.liters === c.liters) delete queue[keyOf(c)]
  }
  write(QUEUE_KEY, queue)
  return 'ok'
}

/** Envia o que estiver pendente e busca a cópia oficial. Sem internet, devolve o que há no aparelho. */
export async function syncLite(): Promise<{ data: LiteData | null; result: SyncResult }> {
  const flushed = await flushQueue()
  if (flushed === 'auth') return { data: readCache(), result: 'auth' }

  try {
    const res = await fetch('/api/lite', { cache: 'no-store' })
    if (res.status === 401) return { data: readCache(), result: 'auth' }
    if (!res.ok) return { data: withPending(readCache()), result: 'error' }
    const fresh = (await res.json()) as LiteData
    writeCache(fresh)
    return { data: withPending(fresh), result: flushed }
  } catch {
    return { data: withPending(readCache()), result: 'offline' }
  }
}

function withPending(data: LiteData | null): LiteData | null {
  return data ? applyChanges(data, pendingChanges()) : null
}
