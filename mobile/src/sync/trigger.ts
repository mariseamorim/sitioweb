// Pedido de sincronização vindo das escritas locais (sync/local.ts), sem importar sync/index.ts (evita ciclo).
// startAutoSync registra o que fazer; as escritas chamam requestSync(), que espera 1,5 s por mais alterações.
let handler: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | undefined

export function setSyncTrigger(fn: (() => void) | null) {
  handler = fn
}

export function requestSync(delayMs = 1500) {
  if (!handler) return
  clearTimeout(timer)
  timer = setTimeout(() => handler?.(), delayMs)
}
