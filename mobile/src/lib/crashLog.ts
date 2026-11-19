// Último erro grave do JavaScript, guardado no banco local para aparecer na próxima abertura (tela de entrada).
// Importado antes de tudo em app/_layout.tsx. Sem isso, um erro na abertura deixava o app parado na logo, sem pista.
import { getMeta, setMeta } from '@/db'

const KEY = 'lastCrash'

type Handler = (error: unknown, isFatal?: boolean) => void
const g = globalThis as unknown as { ErrorUtils?: { getGlobalHandler: () => Handler; setGlobalHandler: (h: Handler) => void } }

export function describeError(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}\n${(error.stack ?? '').split('\n').slice(0, 6).join('\n')}`
  return String(error)
}

export function saveCrash(error: unknown) {
  try { setMeta(KEY, `${new Date().toISOString()}\n${describeError(error)}`) } catch {}
}

export function readCrash(): string | null {
  try { return getMeta(KEY) } catch { return null }
}

export function clearCrash() {
  try { setMeta(KEY, null) } catch {}
}

if (g.ErrorUtils) {
  const previous = g.ErrorUtils.getGlobalHandler()
  g.ErrorUtils.setGlobalHandler((error, isFatal) => {
    if (isFatal) saveCrash(error)
    previous(error, isFatal)
  })
}
