// Dados sem internet, para qualquer tela: busca com cópia guardada no aparelho e envio com fila.
// Cobre os dois casos da roça: sem sinal (navigator.onLine false) e sinal fraco, em que o celular acha
// que está online mas o pedido não chega (a espera estoura em NET_TIMEOUT_MS e a tela usa a cópia).
//
// Fila: cada pedido guardado leva a própria URL e método (_url, _method, _body), então o envio é igual
// para todos os módulos (syncAll, chamado pela barra de sincronização quando a internet volta).
// Registros antigos, sem _url, continuam sendo enviados pela própria tela (parâmetro `legacy`).

import { addPendingRecord, getPendingRecords, removePendingRecord, type OfflineRecord } from './offlineStorage'

export const NET_TIMEOUT_MS = 8000

/** Disparado em window depois que a fila foi enviada: as telas abertas recarregam */
export const SYNC_EVENT = 'anotaai:synced'

const canStore = () => { try { return typeof localStorage !== 'undefined' } catch { return false } }

export function readCache<T>(key: string): T | null {
  if (!canStore()) return null
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function writeCache(key: string, data: unknown) {
  if (!canStore()) return
  try { localStorage.setItem(key, JSON.stringify(data)) } catch { /* sem espaço: a tela segue com internet */ }
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

const isOffline = () => typeof navigator !== 'undefined' && navigator.onLine === false

/** fetch que desiste depois de `timeoutMs` (sinal fraco). Lança TypeError/AbortError como falha de rede. */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = NET_TIMEOUT_MS): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(timer)
  }
}

const errorMessage = async (res: Response, fallback: string) => {
  const data = await res.json().catch(() => ({})) as { error?: string }
  return data.error || fallback
}

export interface Loaded<T> { data: T; fromCache: boolean }

/**
 * GET com cópia no aparelho. Com resposta boa, guarda e devolve. Sem sinal, demora ou erro do servidor (5xx),
 * devolve a cópia guardada. Erro 4xx (sem permissão, por exemplo) vira HttpError e não usa a cópia.
 * Sem cópia e sem rede, lança o erro da rede.
 */
export async function cachedGet<T>(key: string, url: string, opts: { timeoutMs?: number } = {}): Promise<Loaded<T>> {
  const cached = () => {
    const data = readCache<T>(key)
    return data === null ? null : { data, fromCache: true }
  }
  if (isOffline()) {
    const c = cached()
    if (c) return c
    throw new TypeError('Sem internet e sem cópia guardada')
  }
  try {
    const res = await fetchWithTimeout(url, {}, opts.timeoutMs)
    if (res.ok) {
      const data = (await res.json()) as T
      writeCache(key, data)
      return { data, fromCache: false }
    }
    if (res.status < 500) throw new HttpError(res.status, await errorMessage(res, `Erro ${res.status}`))
    const c = cached()
    if (c) return c
    throw new HttpError(res.status, await errorMessage(res, 'O servidor não respondeu'))
  } catch (err) {
    if (err instanceof HttpError) throw err
    const c = cached()
    if (c) return c
    throw err
  }
}

export type Method = 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface QueuedRequest { url: string; method: Method; body?: unknown }

/** Um pedido guardado na fila: o pedido em si (_url, _method, _body) mais campos só para mostrar na tela */
export interface PendingRequest extends OfflineRecord {
  _pendingId: number
  _type: string
  _url: string
  _method: Method
  _body: unknown
  /** id do registro no servidor, para 'update' e 'delete' */
  _id?: string
}

export type SendResult<T> =
  | { status: 'sent'; data: T }
  | { status: 'queued'; pendingId: number }
  | { status: 'rejected'; error: string; code: number }

/**
 * Envia agora ou guarda na fila do módulo. Vai para a fila quando não há sinal ou a rede falha (inclusive demora
 * e erro 5xx). Resposta 4xx é recusa do servidor: volta como 'rejected' com a mensagem, sem entrar na fila.
 * `local` são campos só para a tela mostrar o registro enquanto espera (o animal, o farmId...).
 */
export async function sendOrQueue<T = unknown>(
  module: string,
  req: QueuedRequest & { type: string; id?: string; local?: Record<string, unknown> },
  opts: { timeoutMs?: number } = {},
): Promise<SendResult<T>> {
  const queue = () => {
    addPendingRecord(module, { ...(req.local ?? {}), _type: req.type, _url: req.url, _method: req.method, _body: req.body ?? null, ...(req.id ? { _id: req.id } : {}) })
    const list = getPendingRecords(module)
    return { status: 'queued' as const, pendingId: Number(list[list.length - 1]?._pendingId) }
  }
  if (isOffline()) return queue()
  try {
    const res = await fetchWithTimeout(req.url, {
      method: req.method,
      headers: { 'Content-Type': 'application/json' },
      body: req.body === undefined ? undefined : JSON.stringify(req.body),
    }, opts.timeoutMs)
    if (res.ok) return { status: 'sent', data: (await res.json().catch(() => ({}))) as T }
    if (res.status < 500) return { status: 'rejected', error: await errorMessage(res, 'Não foi possível salvar'), code: res.status }
    return queue()
  } catch {
    return queue()
  }
}

export const pendingItemId = (p: { _pendingId: number }) => `pending_${p._pendingId}`
export const isPendingId = (id: string) => id.startsWith('pending_')
export const pendingIdOf = (id: string) => Number(id.slice('pending_'.length))

/** Fila do módulo. `where` filtra (ex.: só desta propriedade). */
export function pendingOf(module: string, where?: (p: PendingRequest) => boolean): PendingRequest[] {
  const list = getPendingRecords(module) as PendingRequest[]
  return where ? list.filter(where) : list
}

/**
 * Lista vinda do servidor (ou da cópia) com a fila por cima: 'delete' tira o registro, 'update' mescla o corpo
 * do pedido no registro, e os outros tipos (normalmente 'create') viram itens novos por `build`.
 */
export function withPending<T extends { id: string }>(list: T[], pending: PendingRequest[], build?: (p: PendingRequest) => T | null): T[] {
  let out = list.slice()
  const created: T[] = []
  for (const p of pending) {
    if (p._type === 'delete' && p._id) out = out.filter((item) => item.id !== p._id)
    else if (p._type === 'update' && p._id) out = out.map((item) => (item.id === p._id ? { ...item, ...(p._body as object), id: item.id } : item))
    else if (build) {
      const item = build(p)
      if (item) created.push(item)
    }
  }
  return [...out, ...created]
}

/** Altera um pedido que ainda está na fila (ex.: marcar como aplicada uma vacina guardada sem internet) */
export function updatePending(module: string, pendingId: number, patch: (p: PendingRequest) => PendingRequest) {
  if (!canStore()) return
  try {
    const list = (getPendingRecords(module) as PendingRequest[]).map((p) => (p._pendingId === pendingId ? patch(p) : p))
    localStorage.setItem(`pending_${module}`, JSON.stringify(list))
  } catch { /* sem espaço: fica como estava */ }
}

/** Fila que a tela ainda não pode mostrar (envio antigo, sem _url): só para contagem */
export const hasRequest = (p: OfflineRecord): p is PendingRequest => typeof p._url === 'string' && typeof p._method === 'string'

const syncing = new Set<string>()

export interface SyncReport { sent: number; rejected: number; stopped: boolean; errors: string[] }

/**
 * Envia a fila do módulo na ordem. Enviado ou recusado pelo servidor (4xx: já não existe, inválido) sai da fila;
 * falha de rede ou 5xx para o envio e guarda o resto para a próxima vez. Registros antigos sem _url passam por
 * `legacy`, que monta o pedido; sem `legacy` ficam na fila.
 */
export async function syncModule(module: string, legacy?: (record: OfflineRecord) => QueuedRequest | null): Promise<SyncReport> {
  const report: SyncReport = { sent: 0, rejected: 0, stopped: false, errors: [] }
  if (syncing.has(module) || isOffline()) return report
  syncing.add(module)
  try {
    for (const record of getPendingRecords(module)) {
      const req = hasRequest(record) ? { url: record._url, method: record._method, body: record._body } : legacy?.(record) ?? null
      if (!req) continue
      try {
        const res = await fetchWithTimeout(req.url, {
          method: req.method,
          headers: { 'Content-Type': 'application/json' },
          body: req.body === undefined || req.body === null ? undefined : JSON.stringify(req.body),
        })
        if (res.ok) {
          removePendingRecord(module, record._pendingId)
          report.sent++
        } else if (res.status < 500) {
          removePendingRecord(module, record._pendingId)
          report.rejected++
          report.errors.push(await errorMessage(res, `Recusado (${res.status})`))
        } else {
          report.stopped = true
          break
        }
      } catch {
        report.stopped = true
        break
      }
    }
  } finally {
    syncing.delete(module)
  }
  return report
}

/** Módulos com pedidos guardados que o envio geral sabe mandar (com _url) */
export function pendingModules(): string[] {
  if (!canStore()) return []
  const out: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith('pending_')) continue
      const list = getPendingRecords(key.slice('pending_'.length))
      if (list.some(hasRequest)) out.push(key.slice('pending_'.length))
    }
  } catch { /* dado corrompido: ignora */ }
  return out
}

/** Envia as filas de todos os módulos e avisa as telas abertas (SYNC_EVENT) se algo saiu da fila */
export async function syncAll(): Promise<{ sent: number; rejected: number }> {
  let sent = 0
  let rejected = 0
  for (const mod of pendingModules()) {
    const r = await syncModule(mod)
    sent += r.sent
    rejected += r.rejected
  }
  if ((sent || rejected) && typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: { sent, rejected } }))
  return { sent, rejected }
}
