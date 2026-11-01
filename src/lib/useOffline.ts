'use client'

// Estado de rede e fila de um módulo para a tela: online?, o que espera envio, e "enviar agora".
// Recarrega quando a internet volta ou quando a barra de sincronização terminou de enviar (SYNC_EVENT).

import { useCallback, useEffect, useState } from 'react'
import type { OfflineRecord } from './offlineStorage'
import { SYNC_EVENT, pendingOf, syncModule, type PendingRequest, type QueuedRequest, type SyncReport } from './offlineData'

export interface OfflineModule {
  online: boolean
  pending: PendingRequest[]
  pendingCount: number
  syncing: boolean
  /** Relê a fila (depois de guardar ou tirar algo) */
  refresh: () => void
  /** Envia a fila deste módulo agora */
  sync: () => Promise<SyncReport>
  /** Mensagem padrão para o rodapé de um formulário salvo sem internet */
  queuedMessage: string
}

/**
 * `onSynced` roda depois de cada envio que tirou algo da fila (desta tela ou da barra do topo): recarregue os dados.
 * `legacy` monta o pedido de registros antigos da fila, guardados antes de existir _url.
 */
export function useOfflineModule(module: string, onSynced?: () => void, legacy?: (record: OfflineRecord) => QueuedRequest | null): OfflineModule {
  const [online, setOnline] = useState(true)
  const [pending, setPending] = useState<PendingRequest[]>([])
  const [syncing, setSyncing] = useState(false)

  const refresh = useCallback(() => setPending(pendingOf(module)), [module])

  const sync = useCallback(async () => {
    setSyncing(true)
    try {
      const report = await syncModule(module, legacy)
      refresh()
      if (report.sent || report.rejected) onSynced?.()
      return report
    } finally {
      setSyncing(false)
    }
  }, [module, legacy, onSynced, refresh])

  useEffect(() => {
    setOnline(navigator.onLine)
    refresh()
    const up = () => { setOnline(true); void sync() }
    const down = () => setOnline(false)
    const synced = () => { refresh(); onSynced?.() }
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    window.addEventListener('storage', refresh)
    window.addEventListener(SYNC_EVENT, synced)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
      window.removeEventListener('storage', refresh)
      window.removeEventListener(SYNC_EVENT, synced)
    }
  }, [refresh, sync, onSynced])

  return {
    online,
    pending,
    pendingCount: pending.length,
    syncing,
    refresh,
    sync,
    queuedMessage: 'Salvo neste aparelho. Será enviado quando a internet voltar.',
  }
}
