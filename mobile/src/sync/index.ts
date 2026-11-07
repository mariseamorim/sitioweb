// Sincronismo com o servidor: primeiro envia a fila (outbox), na ordem; depois baixa as listas e substitui a cópia local.
// Só baixa quando a fila foi toda enviada, para a cópia do servidor não apagar o que foi feito no aparelho.
import NetInfo from '@react-native-community/netinfo'
import { AppState } from 'react-native'
import { useEffect, useState } from 'react'
import { api, HttpError, NetworkError } from '@/api/client'
import { all, deleteRow, getMeta, one, replaceFromServer, run, setCache, setMeta, transaction, upsert, TABLES, type Row, type TableName } from '@/db'
import { notifyChange } from '@/db/events'
import { isLocalId, pendingCount, type OutboxRow } from './local'
import { setSyncTrigger } from './trigger'

export interface SyncState {
  online: boolean
  syncing: boolean
  pending: number
  failed: number
  lastSyncAt: string | null
  error: string | null
  /** O servidor recusou o token: precisa entrar de novo */
  unauthorized: boolean
}

let state: SyncState = { online: true, syncing: false, pending: 0, failed: 0, lastSyncAt: null, error: null, unauthorized: false }
const listeners = new Set<(s: SyncState) => void>()
function setState(patch: Partial<SyncState>) {
  state = { ...state, ...patch }
  for (const l of listeners) l(state)
}

export function useSyncState(): SyncState {
  const [s, setS] = useState(state)
  useEffect(() => { listeners.add(setS); return () => { listeners.delete(setS) } }, [])
  return s
}

export function refreshCounts(farmId: string) {
  setState({ ...pendingCount(farmId), lastSyncAt: getMeta(`lastSync:${farmId}`) })
}

/** Troca ids locais (de registros criados no aparelho) pelos definitivos, no caminho e no corpo do pedido. */
function resolveIds(text: string): { text: string; unresolved: string | null } {
  let unresolved: string | null = null
  const out = text.replace(/local_[0-9a-f-]{36}/g, (localId) => {
    const m = one<{ serverId: string }>('SELECT serverId FROM id_map WHERE localId = ?', [localId])
    if (!m) { unresolved = localId; return localId }
    return m.serverId
  })
  return { text: out, unresolved }
}

/** Colunas que apontam para outros registros e precisam trocar o id local pelo definitivo. */
const REF_COLUMNS = ['animalId', 'supplyId', 'motherId']

function adoptServerRow(table: TableName, farmId: string, localId: string, serverRow: Row) {
  const serverId = String(serverRow.id)
  transaction(() => {
    run('INSERT OR REPLACE INTO id_map (localId, serverId) VALUES (?, ?)', [localId, serverId])
    deleteRow(table, localId)
    upsert(table, farmId, serverRow)
    for (const [name, t] of Object.entries(TABLES)) {
      for (const col of REF_COLUMNS) {
        if ((t.columns as readonly string[]).includes(col)) run(`UPDATE ${name} SET ${col} = ? WHERE ${col} = ?`, [serverId, localId])
      }
    }
    run('UPDATE outbox SET localId = ? WHERE localId = ?', [serverId, localId])
  })
}

/** Envia a fila. Devolve false se parou por falta de internet. */
export async function pushOutbox(farmId: string): Promise<boolean> {
  const rows = all<OutboxRow>('SELECT * FROM outbox WHERE farmId = ? AND failed = 0 ORDER BY seq', [farmId])
  for (const row of rows) {
    const path = resolveIds(row.path)
    const body = row.body ? resolveIds(row.body) : { text: null, unresolved: null }
    const unresolved = path.unresolved ?? body.unresolved
    if (unresolved) {
      run('UPDATE outbox SET failed = 1, lastError = ? WHERE seq = ?', ['Depende de um registro que o servidor recusou', row.seq])
      continue
    }
    try {
      const res = await api<Row>(path.text, { method: row.method, body: body.text ? JSON.parse(body.text) : undefined })
      if (row.method === 'POST' && row.localId && isLocalId(row.localId) && row.tbl) {
        // Movimentação de estoque devolve { movement, supply }; o resto devolve o próprio registro
        const created = (res && typeof res === 'object' && 'movement' in res ? (res as { movement: Row }).movement : res) as Row | null
        if (created && created.id) adoptServerRow(row.tbl, farmId, row.localId, created)
        if (res && typeof res === 'object' && 'supply' in res) upsert('supplies', farmId, (res as { supply: Row }).supply)
      } else if (row.tbl && row.localId && res && typeof res === 'object' && 'id' in res && res.id === row.localId) {
        // Alteração (ou subrota de lote) que devolve o registro inteiro: atualiza a cópia local
        upsert(row.tbl, farmId, res)
      }
      run('DELETE FROM outbox WHERE seq = ?', [row.seq])
      notifyChange()
    } catch (e) {
      if (e instanceof NetworkError) return false
      if (e instanceof HttpError && e.status === 401) { setState({ unauthorized: true }); return false }
      const message = e instanceof Error ? e.message : 'Erro'
      run('UPDATE outbox SET failed = 1, attempts = attempts + 1, lastError = ? WHERE seq = ?', [message, row.seq])
      notifyChange()
    } finally {
      refreshCounts(farmId)
    }
  }
  return true
}

/** Baixa as listas dos módulos permitidos e substitui a cópia local. */
export async function pullAll(farmId: string, canAccess: (module: string) => boolean) {
  const admin = canAccess('admin')
  // Uma rota recusada (403, 500) não impede as outras; só a falta de internet interrompe tudo
  const tolerant = async (fn: () => Promise<void>) => {
    try { await fn() } catch (e) { if (e instanceof NetworkError || (e instanceof HttpError && e.status === 401)) throw e }
  }
  for (const [name, t] of Object.entries(TABLES) as [TableName, (typeof TABLES)[TableName]][]) {
    if (!t.list || (t.module && !canAccess(t.module))) continue
    await tolerant(async () => {
      const path = name === 'farms' && admin ? '/api/admin/propriedades' : t.list!
      const res = await api<unknown>(path)
      let rows: Row[]
      if (name === 'offers') {
        const r = res as { offers: Row[]; lowCategories?: string[] }
        rows = r.offers ?? []
        setMeta(`lowCategories:${farmId}`, JSON.stringify(r.lowCategories ?? []))
      } else {
        rows = Array.isArray(res) ? (res as Row[]) : []
      }
      replaceFromServer(name, farmId, rows)
      if (name === 'supplies') {
        // A lista de estoque já traz as movimentações de cada produto
        const movements = rows.flatMap(r => (Array.isArray(r.movements) ? (r.movements as Row[]) : []))
        replaceFromServer('supply_movements', farmId, movements)
      }
      notifyChange()
    })
  }
  if (canAccess('animais')) {
    // Recria um a um: as pesagens individuais vêm dentro de cada animal
    await tolerant(async () => {
      const rearing = await api<Row[]>('/api/recria')
      const weighings = rearing.flatMap(r => (Array.isArray(r.weighings) ? (r.weighings as Row[]).map(w => ({ ...w, animalId: r.id })) : []))
      replaceFromServer('animal_weighings', farmId, weighings)
      notifyChange()
    })
  }
  if (canAccess('leite')) {
    await tolerant(async () => {
      const price = await api<{ price: number | null }>('/api/milk-production/price')
      setMeta(`milkPrice:${farmId}`, price.price === null ? '' : String(price.price))
    })
  }
  await tolerant(async () => setCache('perfil', await api('/api/perfil')))
  if (admin) {
    for (const [key, path] of [['admin_accounts', '/api/admin/usuarios'], ['admin_vendors', '/api/fornecedores'], ['admin_orgs', '/api/organizacoes']] as const) {
      await tolerant(async () => setCache(key, await api(path)))
    }
  }
  notifyChange()
}

let running: Promise<void> | null = null

/** Sincroniza (envia e baixa). Chamadas simultâneas esperam a mesma execução. */
export function syncNow(farmId: string, canAccess: (module: string) => boolean): Promise<void> {
  if (running) return running
  running = (async () => {
    setState({ syncing: true, error: null })
    try {
      const sent = await pushOutbox(farmId)
      if (sent && !state.unauthorized) {
        await pullAll(farmId, canAccess)
        const now = new Date().toISOString()
        setMeta(`lastSync:${farmId}`, now)
        setState({ lastSyncAt: now, online: true })
      } else if (!sent && !state.unauthorized) {
        setState({ online: false })
      }
    } catch (e) {
      if (e instanceof NetworkError) setState({ online: false })
      else if (e instanceof HttpError && e.status === 401) setState({ unauthorized: true })
      else setState({ error: e instanceof Error ? e.message : 'Falha ao sincronizar' })
    } finally {
      refreshCounts(farmId)
      setState({ syncing: false })
      running = null
    }
  })()
  return running
}

/** Liga a sincronização automática: ao voltar a internet e ao trazer o app para frente. */
export function startAutoSync(farmId: string, canAccess: (module: string) => boolean) {
  const unsubNet = NetInfo.addEventListener((s) => {
    const online = !!s.isConnected && s.isInternetReachable !== false
    const was = state.online
    setState({ online })
    if (online && !was) void syncNow(farmId, canAccess)
  })
  const sub = AppState.addEventListener('change', (st) => { if (st === 'active') void syncNow(farmId, canAccess) })
  // Cada gravação no aparelho pede o envio logo em seguida (ver sync/local.ts)
  setSyncTrigger(() => { if (state.online) void syncNow(farmId, canAccess) })
  refreshCounts(farmId)
  void syncNow(farmId, canAccess)
  return () => { unsubNet(); sub.remove(); setSyncTrigger(null) }
}

export function clearUnauthorized() {
  setState({ unauthorized: false })
}
