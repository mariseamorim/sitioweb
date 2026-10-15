// Troca de propriedade no aparelho (produtor com mais de uma propriedade).
// As filas sem internet gravam na propriedade aberta: com algo pendente, trocar mandaria
// a anotação para a propriedade errada. Por isso só troca com tudo enviado.
import { countAllPendingOnDevice } from '@/lib/offlineStorage'

/** O que fica guardado no aparelho e é da propriedade aberta (some ao trocar) */
const FARM_CACHES = ['cached_user', 'cached_tasks', 'lite_cache_v1']

export const PENDING_MESSAGE = 'Ainda há anotações salvas só no celular. Conecte-se à internet e espere o "Tudo enviado" antes de trocar de propriedade.'

export function hasPendingOnDevice() {
  return countAllPendingOnDevice() > 0
}

/** Depois que o servidor já abriu outra propriedade: limpa o que era da anterior e recarrega no painel. */
export function reloadInFarm() {
  try { for (const key of FARM_CACHES) localStorage.removeItem(key) } catch {}
  window.location.href = '/'
}

/** Abre outra propriedade. Devolve a mensagem de erro, se não deu. */
export async function switchFarm(farmId: string): Promise<string | null> {
  if (hasPendingOnDevice()) return PENDING_MESSAGE
  try {
    const res = await fetch('/api/auth/switch-farm', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farmId }),
    })
    if (!res.ok) return (await res.json().catch(() => ({}))).error || 'Não foi possível abrir esta propriedade.'
  } catch {
    return 'Sem internet. Para trocar de propriedade, conecte-se e tente de novo.'
  }
  reloadInFarm()
  return null
}
