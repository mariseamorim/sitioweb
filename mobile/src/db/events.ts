// Aviso simples de "os dados mudaram" para as telas recarregarem do banco local.
import { useEffect, useState } from 'react'

type Listener = () => void
const listeners = new Set<Listener>()

export function notifyChange() {
  for (const l of listeners) l()
}

/** Executa `read` agora e de novo sempre que o banco local mudar (escrita local ou sincronização). */
export function useLive<T>(read: () => T, deps: unknown[] = []): T {
  const [value, setValue] = useState<T>(read)
  useEffect(() => {
    const rerun = () => setValue(read())
    rerun()
    listeners.add(rerun)
    return () => { listeners.delete(rerun) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return value
}
