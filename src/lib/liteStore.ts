// Dados do Anota Aí Leite guardados no aparelho e fila de envio.
// A tela sempre lê daqui; o servidor só recebe e devolve a cópia oficial.
import type { LiteChange, LiteData, LiteEntry, PointKind } from '@/lib/lite'

const CACHE_KEY = 'lite_cache_v1'
const QUEUE_KEY = 'lite_queue_v1'
const POINTS_KEY = 'lite_points_queue_v1'

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

// ── Locais criados ou alterados sem internet ────────────────────────────

/** Criação ou alteração de um local. O id é gerado no aparelho para funcionar sem internet. */
export interface PointOp {
  id: string
  create?: boolean
  name?: string
  kind?: PointKind
  active?: boolean
}

type PointQueue = Record<string, PointOp>

export function newPointId(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().replace(/-/g, '')
    : Date.now().toString(36) + Math.random().toString(36).slice(2)
  return `lp${random}`.slice(0, 40)
}

export function pendingPointOps(): PointOp[] {
  return Object.values(read<PointQueue>(POINTS_KEY, {}))
}

/** Quantos itens aguardam envio (locais e anotações) */
export function pendingCount(): number {
  return pendingPointOps().length + pendingChanges().length
}

export function applyPointOps(data: LiteData, ops: PointOp[]): LiteData {
  const points = [...data.points]
  for (const op of ops) {
    const i = points.findIndex((p) => p.id === op.id)
    if (i === -1) {
      if (op.create) points.push({ id: op.id, name: op.name ?? '', kind: op.kind ?? 'sitio', active: op.active ?? true, farm: null })
      continue
    }
    points[i] = {
      ...points[i],
      ...(op.name !== undefined && { name: op.name }),
      ...(op.kind !== undefined && { kind: op.kind }),
      ...(op.active !== undefined && { active: op.active }),
    }
  }
  return { ...data, points }
}

/** Guarda a operação na fila (juntando com o que já estava pendente para o mesmo local). */
export function enqueuePoint(op: PointOp) {
  const queue = read<PointQueue>(POINTS_KEY, {})
  const previous = queue[op.id]
  queue[op.id] = { ...previous, ...op, create: previous?.create || op.create }
  write(POINTS_KEY, queue)
  const cache = readCache()
  if (cache) writeCache(applyPointOps(cache, [op]))
}

async function flushPoints(): Promise<SyncResult> {
  for (const op of pendingPointOps()) {
    let res: Response
    try {
      const { id, create, ...fields } = op
      res = await fetch(create ? '/api/lite/locais' : `/api/lite/locais/${id}`, {
        method: create ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(create ? { id, ...fields } : fields),
      })
    } catch {
      return 'offline'
    }
    if (res.status === 401) return 'auth'
    if (!res.ok) return 'error'
    // Só tira da fila se nada mudou enquanto enviava
    const queue = read<PointQueue>(POINTS_KEY, {})
    if (JSON.stringify(queue[op.id]) === JSON.stringify(op)) delete queue[op.id]
    write(POINTS_KEY, queue)
  }
  return 'ok'
}

/** Envia o que estiver pendente e busca a cópia oficial. Sem internet, devolve o que há no aparelho. */
export async function syncLite(): Promise<{ data: LiteData | null; result: SyncResult }> {
  // Locais primeiro: as anotações podem ser de um local criado sem internet
  const points = await flushPoints()
  if (points === 'auth') return { data: readCache(), result: 'auth' }
  const flushed = points === 'ok' ? await flushQueue() : points
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
  return data ? applyChanges(applyPointOps(data, pendingPointOps()), pendingChanges()) : null
}
