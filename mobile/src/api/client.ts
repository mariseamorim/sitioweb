// Chamadas ao servidor do site (as mesmas rotas /api/* que o site usa). O app não usa cookies: manda o token da
// sessão no cabeçalho Authorization e identifica-se com X-Anota-Client para o servidor devolver o token no corpo.
import Constants from 'expo-constants'

export const API_BASE: string = Constants.expoConfig?.extra?.apiBase ?? 'https://www.anotaaiagro.com.br'
export const NET_TIMEOUT_MS = 15000

export class HttpError extends Error {
  status: number
  body: unknown
  constructor(status: number, message: string, body: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

/** Falha de rede ou tempo esgotado: o pedido não chegou ao servidor e pode ser repetido depois. */
export class NetworkError extends Error {}

let token: string | null = null
let activeFarm: string | null = null

export function setAuth(next: { token: string | null; farmId?: string | null }) {
  token = next.token
  if (next.farmId !== undefined) activeFarm = next.farmId
}

export function getToken() {
  return token
}

export interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  timeoutMs?: number
}

export async function api<T = unknown>(path: string, opts: ApiOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? NET_TIMEOUT_MS)
  let response: Response
  try {
    response = await fetch(API_BASE + path, {
      method: opts.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Anota-Client': 'mobile',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(activeFarm ? { 'X-Active-Farm': activeFarm } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: controller.signal,
    })
  } catch (e) {
    throw new NetworkError(e instanceof Error && e.name === 'AbortError' ? 'Tempo esgotado' : 'Sem conexão')
  } finally {
    clearTimeout(timer)
  }
  const text = await response.text()
  let data: unknown = null
  try { data = text ? JSON.parse(text) : null } catch { data = text }
  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string'
      ? (data as { error: string }).error
      : `Erro ${response.status}`
    throw new HttpError(response.status, message, data)
  }
  return data as T
}
