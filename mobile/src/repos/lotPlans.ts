// Planos de recria/engorda no app: a lista vem de GET /api/lotes/planos e fica guardada no aparelho (cache) para
// os lotes e o desempenho funcionarem sem internet. Criar, alterar e excluir plano precisa de conexão (vai direto
// ao servidor, sem fila), como a agenda do veterinário.
import { useCallback, useEffect, useState } from 'react'
import { api, NetworkError } from '@/api/client'
import { getCache, setCache } from '@/db'
import { notifyChange } from '@/db/events'
import type { LotPlan, PlanStage } from '@/lib/lotPlans'

const cacheKey = (farmId: string) => `lot_plans:${farmId}`

/** Última cópia guardada dos planos da propriedade (vazia se nunca carregou) */
export function cachedPlans(farmId: string): LotPlan[] {
  return getCache<LotPlan[]>(cacheKey(farmId)) ?? []
}

/** Planos ativos, para escolher no lote */
export const activePlans = (plans: LotPlan[]) => plans.filter(p => p.active)

/** Mesma ordem da API: ativos primeiro, depois por nome */
const sortPlans = (plans: LotPlan[]) => [...plans].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))

function store(farmId: string, plans: LotPlan[]) {
  setCache(cacheKey(farmId), sortPlans(plans))
  notifyChange()
}

/** Planos da propriedade: mostra a cópia do aparelho na hora e atualiza pela internet; `offline` quando não deu */
export function usePlans(farmId: string) {
  const [plans, setPlans] = useState<LotPlan[]>(() => cachedPlans(farmId))
  const [offline, setOffline] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    try {
      const data = await api<LotPlan[]>('/api/lotes/planos')
      const list = Array.isArray(data) ? data.map(p => ({ ...p, stages: Array.isArray(p.stages) ? p.stages : [] })) : []
      setCache(cacheKey(farmId), list)
      setPlans(list)
      setOffline(false)
      setError('')
    } catch (e) {
      // Sem internet: fica a última cópia guardada; outro erro do servidor aparece como aviso
      if (e instanceof NetworkError) setOffline(true)
      else setError(e instanceof Error ? e.message : 'Não foi possível carregar os planos')
      setPlans(cachedPlans(farmId))
    } finally {
      setLoaded(true)
    }
  }, [farmId])
  useEffect(() => { void reload() }, [reload])
  return { plans, offline, error, loaded, reload, setPlans }
}

export interface PlanInput { name: string; description: string; active: boolean; stages: PlanStage[]; targetWeight: number | null }

/** Cria (sem id) ou altera o plano no servidor e atualiza a cópia do aparelho. Lança NetworkError sem internet. */
export async function savePlan(farmId: string, input: PlanInput, id?: string): Promise<LotPlan[]> {
  const body = { ...input, description: input.description.trim() || null }
  const saved = id
    ? await api<LotPlan>(`/api/lotes/planos/${id}`, { method: 'PUT', body })
    : await api<LotPlan>('/api/lotes/planos', { method: 'POST', body })
  const list = [...cachedPlans(farmId).filter(p => p.id !== saved.id), saved]
  store(farmId, list)
  return cachedPlans(farmId)
}

/** Exclui o plano no servidor; os lotes que usavam ficam sem plano (o servidor faz isso; a próxima sincronização traz) */
export async function deletePlan(farmId: string, id: string): Promise<LotPlan[]> {
  await api(`/api/lotes/planos/${id}`, { method: 'DELETE' })
  store(farmId, cachedPlans(farmId).filter(p => p.id !== id))
  return cachedPlans(farmId)
}
