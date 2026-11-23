// Estoque do próprio veterinário (medicamentos, sêmen, material), como em Consultoria › Meu estoque do site.
// Vem de /api/veterinario/estoque; sem internet mostra a última cópia. Cadastrar, entrada e saída precisam de conexão.
import { useCallback, useEffect, useState } from 'react'
import { api, NetworkError } from '@/api/client'
import { getCache, setCache } from '@/db'

export interface VetMove { id: string; type: 'entrada' | 'saida'; quantity: number; date: string; farmName: string | null; note: string | null }
export interface VetSupply {
  id: string; name: string; kind: string; bullName: string | null; bullBreed: string | null; semenBatch: string | null
  unit: string; quantity: number; minimum: number | null; expiry: string | null; moves: VetMove[]
}

const CACHE_KEY = 'vet_stock'

export function useVetStock(enabled = true) {
  const [items, setItems] = useState<VetSupply[]>(() => getCache<VetSupply[]>(CACHE_KEY) ?? [])
  const [offline, setOffline] = useState(false)
  const reload = useCallback(async () => {
    if (!enabled) return
    try {
      const data = await api<VetSupply[]>('/api/veterinario/estoque')
      setCache(CACHE_KEY, data)
      setItems(data)
      setOffline(false)
    } catch (e) {
      if (e instanceof NetworkError) setOffline(true)
    }
  }, [enabled])
  useEffect(() => { void reload() }, [reload])
  return { items, offline, reload, setItems }
}

export const saveVetSupply = (body: Record<string, unknown>, id?: string) =>
  api(id ? `/api/veterinario/estoque/${id}` : '/api/veterinario/estoque', { method: id ? 'PATCH' : 'POST', body })

export const moveVetSupply = (id: string, body: { type: 'entrada' | 'saida'; quantity: number; date: string; farmName?: string; note?: string }) =>
  api(`/api/veterinario/estoque/${id}/movimentos`, { method: 'POST', body })

export const removeVetSupply = (id: string) => api(`/api/veterinario/estoque/${id}`, { method: 'DELETE' })
