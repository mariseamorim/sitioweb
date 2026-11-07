// Escritas feitas no aparelho: gravam no banco local na hora e entram na fila de envio (outbox).
// Registros novos recebem um id "local_<uuid>" até o servidor responder com o id definitivo (ver sync/index.ts).
import * as Crypto from 'expo-crypto'
import { all, deleteRow, one, patchRow, run, transaction, upsert, type Row, type TableName, TABLES } from '@/db'
import { notifyChange } from '@/db/events'
import { requestSync } from './trigger'

export const isLocalId = (id: string) => id.startsWith('local_')

/** Id atual de um registro: um id local já enviado vira o id do servidor (a tela pode ter guardado o antigo). */
export function currentId(id: string): string {
  if (!isLocalId(id)) return id
  return one<{ serverId: string }>('SELECT serverId FROM id_map WHERE localId = ?', [id])?.serverId ?? id
}

export interface OutboxRow {
  seq: number
  farmId: string
  module: string
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  body: string | null
  localId: string | null
  tbl: TableName | null
  createdAt: string
  attempts: number
  lastError: string | null
  failed: number
}

function enqueue(o: { farmId: string; module: string; method: OutboxRow['method']; path: string; body?: unknown; localId?: string | null; tbl?: TableName | null }) {
  run('INSERT INTO outbox (farmId, module, method, path, body, localId, tbl, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [
    o.farmId, o.module, o.method, o.path, o.body === undefined ? null : JSON.stringify(o.body), o.localId ?? null, o.tbl ?? null, new Date().toISOString(),
  ])
}

/** Cria um registro no aparelho e agenda o POST. Devolve o id local. */
export function createLocal(o: { table: TableName; farmId: string; path: string; body: Row; row?: Row }): string {
  const id = 'local_' + Crypto.randomUUID()
  const now = new Date().toISOString()
  transaction(() => {
    upsert(o.table, o.farmId, { ...o.body, ...(o.row ?? {}), id, createdAt: now, updatedAt: now })
    enqueue({ farmId: o.farmId, module: TABLES[o.table].module, method: 'POST', path: o.path, body: o.body, localId: id, tbl: o.table })
  })
  notifyChange()
  requestSync()
  return id
}

/**
 * Altera um registro no aparelho. Se ele ainda não foi enviado (id local), a alteração entra no próprio POST
 * pendente; senão agenda um PUT. `path` pode conter o id local: é trocado pelo definitivo na hora do envio.
 */
export function updateLocal(o: { table: TableName; farmId: string; id: string; path: string; body: Row; row?: Row }) {
  const id = currentId(o.id)
  const path = o.path.split(o.id).join(id)
  transaction(() => {
    patchRow(o.table, id, { ...o.body, ...(o.row ?? {}), updatedAt: new Date().toISOString() })
    const pending = isLocalId(id)
      ? one<OutboxRow>("SELECT * FROM outbox WHERE localId = ? AND method = 'POST' AND failed = 0", [id])
      : null
    if (pending) {
      const merged = { ...(pending.body ? JSON.parse(pending.body) : {}), ...o.body }
      run('UPDATE outbox SET body = ? WHERE seq = ?', [JSON.stringify(merged), pending.seq])
    } else {
      enqueue({ farmId: o.farmId, module: TABLES[o.table].module, method: 'PUT', path, body: o.body, localId: id, tbl: o.table })
    }
  })
  notifyChange()
  requestSync()
}

/** Apaga no aparelho. Registro ainda não enviado some da fila; registro do servidor agenda o DELETE. */
export function deleteLocal(o: { table: TableName; farmId: string; id: string; path: string }) {
  const id = currentId(o.id)
  const path = o.path.split(o.id).join(id)
  transaction(() => {
    deleteRow(o.table, id)
    if (isLocalId(id)) {
      run('DELETE FROM outbox WHERE localId = ? OR path LIKE ?', [id, `%${id}%`])
    } else {
      // Alterações pendentes do mesmo registro não fazem mais sentido
      run("DELETE FROM outbox WHERE localId = ? AND method IN ('PUT', 'PATCH') AND failed = 0", [id])
      enqueue({ farmId: o.farmId, module: TABLES[o.table].module, method: 'DELETE', path, localId: id, tbl: o.table })
    }
  })
  notifyChange()
  requestSync()
}

export function pendingCount(farmId: string): { pending: number; failed: number } {
  const r = one<{ pending: number; failed: number }>('SELECT SUM(failed = 0) AS pending, SUM(failed = 1) AS failed FROM outbox WHERE farmId = ?', [farmId])
  return { pending: r?.pending ?? 0, failed: r?.failed ?? 0 }
}

export function listOutbox(farmId: string): OutboxRow[] {
  return all<OutboxRow>('SELECT * FROM outbox WHERE farmId = ? ORDER BY seq', [farmId])
}

/** Descarta um envio que o servidor recusou (o registro local continua como está; a próxima sincronização refaz a cópia). */
export function discardOutbox(seq: number) {
  run('DELETE FROM outbox WHERE seq = ?', [seq])
  notifyChange()
}

export function retryFailed(farmId: string) {
  run('UPDATE outbox SET failed = 0, lastError = NULL WHERE farmId = ? AND failed = 1', [farmId])
  notifyChange()
}
