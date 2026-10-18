// Dados do Anota Aí Leite guardados no aparelho e fila de envio.
// A tela sempre lê daqui; o servidor só recebe e devolve a cópia oficial.
import type { LiteChange, LiteData, LiteEntry, LiteSheet, LiteSheetChange, LiteSplit, LiteSplitChange, PointKind } from '@/lib/lite'

const CACHE_KEY = 'lite_cache_v1'
const QUEUE_KEY = 'lite_queue_v1'
const POINTS_KEY = 'lite_points_queue_v1'
const SHEETS_KEY = 'lite_sheets_queue_v1'
const SPLITS_KEY = 'lite_splits_queue_v1'

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
    // "Não coletado" (motivo) fica como 0 L com o motivo; sem litros e sem motivo apaga
    if (c.liters === null && !c.skipReason) map.delete(keyOf(c))
    else map.set(keyOf(c), { pointId: c.pointId, date: c.date, liters: c.skipReason ? 0 : c.liters ?? 0, skipReason: c.skipReason ?? null, note: c.note ?? null })
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

export type SyncResult = 'ok' | 'offline' | 'auth' | 'error' | 'conflict'

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
  if (res.status === 409) return 'conflict'
  if (!res.ok) return 'error'

  const queue = read<Queue>(QUEUE_KEY, {})
  for (const c of sent) {
    const current = queue[keyOf(c)]
    // Só sai da fila se não mudou durante o envio (litros, motivo e observação)
    if (current && current.liters === c.liters && (current.skipReason ?? null) === (c.skipReason ?? null) && (current.note ?? null) === (c.note ?? null)) delete queue[keyOf(c)]
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

/** Quantos itens aguardam envio (locais, anotações, folhas do motorista e divisões da nota) */
export function pendingCount(): number {
  return pendingPointOps().length + pendingChanges().length + pendingSheets().length + pendingSplits().length
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

// ── Folha do motorista (conferência) ────────────────────────────────────

type SheetQueue = Record<string, LiteSheetChange>

export function pendingSheets(): LiteSheetChange[] {
  return Object.values(read<SheetQueue>(SHEETS_KEY, {}))
}

export function applySheets(data: LiteData, changes: LiteSheetChange[]): LiteData {
  const map = new Map<string, LiteSheet>((data.sheets ?? []).map((s) => [s.date, s]))
  for (const c of changes) {
    if (c.liters === null) map.delete(c.date)
    else map.set(c.date, { ...map.get(c.date), date: c.date, liters: c.liters, ...(c.temperature !== undefined && { temperature: c.temperature }), ...(c.sampleNumber !== undefined && { sampleNumber: c.sampleNumber }), ...(c.rulerValue !== undefined && { rulerValue: c.rulerValue }), ...(c.photo ? { hasPhoto: true } : {}) })
  }
  return { ...data, sheets: [...map.values()] }
}

/** Guarda a folha na fila. Para o mesmo dia, vale a última. */
export function enqueueSheet(change: LiteSheetChange) {
  const queue = read<SheetQueue>(SHEETS_KEY, {})
  queue[change.date] = change
  write(SHEETS_KEY, queue)
  const cache = readCache()
  if (cache) writeCache(applySheets(cache, [change]))
}

async function flushSheets(): Promise<SyncResult> {
  const sent = pendingSheets()
  if (sent.length === 0) return 'ok'
  let res: Response
  try {
    res = await fetch('/api/lite/folha', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: sent }),
    })
  } catch {
    return 'offline'
  }
  if (res.status === 401) return 'auth'
  if (!res.ok) return 'error'
  const queue = read<SheetQueue>(SHEETS_KEY, {})
  for (const c of sent) if (queue[c.date]?.liters === c.liters) delete queue[c.date]
  write(SHEETS_KEY, queue)
  return 'ok'
}

// ── Divisão da nota (litros de cada nome na coleta) ─────────────────────

type SplitQueue = Record<string, LiteSplitChange>
const splitKey = (c: { payeeId: string; date: string }) => `${c.payeeId}|${c.date}`

export function pendingSplits(): LiteSplitChange[] {
  return Object.values(read<SplitQueue>(SPLITS_KEY, {}))
}

export function applySplits(data: LiteData, changes: LiteSplitChange[]): LiteData {
  const map = new Map<string, LiteSplit>((data.splits ?? []).map((s) => [splitKey(s), s]))
  for (const c of changes) {
    if (c.liters === null) map.delete(splitKey(c))
    else map.set(splitKey(c), { payeeId: c.payeeId, date: c.date, liters: c.liters })
  }
  return { ...data, splits: [...map.values()] }
}

/** Guarda a divisão na fila. Para o mesmo nome e dia, vale a última. */
export function enqueueSplits(changes: LiteSplitChange[]) {
  const queue = read<SplitQueue>(SPLITS_KEY, {})
  for (const c of changes) queue[splitKey(c)] = c
  write(SPLITS_KEY, queue)
  const cache = readCache()
  if (cache) writeCache(applySplits(cache, changes))
}

async function flushSplits(): Promise<SyncResult> {
  const sent = pendingSplits()
  if (sent.length === 0) return 'ok'
  let res: Response
  try {
    res = await fetch('/api/lite/divisao', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changes: sent }),
    })
  } catch {
    return 'offline'
  }
  if (res.status === 401) return 'auth'
  if (!res.ok) return 'error'
  const queue = read<SplitQueue>(SPLITS_KEY, {})
  for (const c of sent) if (queue[splitKey(c)]?.liters === c.liters) delete queue[splitKey(c)]
  write(SPLITS_KEY, queue)
  return 'ok'
}

/** Envia o que estiver pendente e busca a cópia oficial. Sem internet, devolve o que há no aparelho. */
export async function syncLite(): Promise<{ data: LiteData | null; result: SyncResult }> {
  // Locais primeiro: as anotações podem ser de um local criado sem internet
  const points = await flushPoints()
  if (points === 'auth') return { data: readCache(), result: 'auth' }
  const queued = points === 'ok' ? await flushQueue() : points
  if (queued === 'auth') return { data: readCache(), result: 'auth' }
  // A folha e a divisão não dependem das anotações: vão mesmo se elas tiverem conflito
  const sheets = points === 'ok' ? await flushSheets() : 'ok'
  if (sheets === 'auth') return { data: readCache(), result: 'auth' }
  const splits = points === 'ok' ? await flushSplits() : 'ok'
  if (splits === 'auth') return { data: readCache(), result: 'auth' }
  const flushed = queued !== 'ok' ? queued : sheets !== 'ok' ? sheets : splits

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
  return data ? applySplits(applySheets(applyChanges(applyPointOps(data, pendingPointOps()), pendingChanges()), pendingSheets()), pendingSplits()) : null
}
