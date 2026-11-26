// Agenda do veterinário (GET /api/veterinario/agenda): os manejos de todas as propriedades que ele atende e as
// visitas marcadas. Usada no Painel (números do dia e urgentes) e na aba Agenda. Sem internet mostra a última cópia.
import { useCallback, useEffect, useState } from 'react'
import { api, NetworkError } from '@/api/client'
import { getCache, setCache } from '@/db'
import type { AgendaItem, AgendaKind } from '@/lib/agenda'
import { useT } from '@/lib/i18n'

const CACHE_KEY = 'vet_agenda'

export function useVetAgenda(enabled = true) {
  const t = useT()
  const [items, setItems] = useState<AgendaItem[] | null>(() => (enabled ? getCache<{ items: AgendaItem[] }>(CACHE_KEY)?.items ?? null : null))
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    if (!enabled) return
    try {
      const data = await api<{ today: string; items: AgendaItem[] }>('/api/veterinario/agenda')
      setCache(CACHE_KEY, data)
      setItems(data.items)
      setOffline(false)
    } catch (e) {
      if (e instanceof NetworkError) setOffline(true)
      else setError(e instanceof Error ? t(e.message) : t('Não foi possível carregar a agenda'))
    }
  }, [enabled, t])
  useEffect(() => { void reload() }, [reload])
  return { items, setItems, offline, error, setError, reload }
}

/** Tela do site de cada tipo (o veterinário abre a propriedade e segue para a tela equivalente do app) */
export const agendaSiteHref = (kind: AgendaKind) => (kind === 'vacina' ? '/vacinacao' : kind === 'carencia' ? '/veterinary-treatment' : '/reproducao')
