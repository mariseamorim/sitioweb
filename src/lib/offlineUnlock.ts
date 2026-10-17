// Entrar sem internet. Depois de entrar uma vez com internet, a senha fica guardada neste aparelho como um
// hash (PBKDF2 com sal, pelo WebCrypto), nunca a senha em si. Sem sinal, o login confere a senha aqui e abre o
// app com os dados guardados. A sessão do servidor não é criada: quando o sinal voltar, a pessoa entra de novo
// com internet para enviar o que anotou (a fila fica guardada).
// "Sair" deixa os dados no aparelho para isso funcionar; "Sair e apagar tudo" limpa o aparelho.

import type { UserData } from '@/contexts/UserContext'
import { normalizePhone } from '@/lib/identity'

const KEY = 'offline_credential_v1'
const ITERATIONS = 150000
/** O que sai no "Sair" comum: a pessoa deixa de estar logada, mas os dados ficam */
const SESSION_KEYS = ['cached_user', 'cached_tasks']

export interface OfflineCredential {
  user: UserData
  email: string | null
  phone: string | null
  salt: string
  hash: string
  iterations: number
  savedAt: string
}

const toHex = (buf: ArrayBuffer | Uint8Array) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const fromHex = (hex: string) => new Uint8Array((hex.match(/../g) ?? []).map((h) => parseInt(h, 16)))

export const canUnlockOffline = () => typeof crypto !== 'undefined' && !!crypto.subtle && typeof localStorage !== 'undefined'

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, 256))
}

function readCredential(): OfflineCredential | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as OfflineCredential) : null
  } catch {
    return null
  }
}

/** Guarda a credencial de quem acabou de entrar com internet (substitui a anterior: um aparelho, uma pessoa) */
export async function saveOfflineCredential(user: UserData, password: string): Promise<void> {
  if (!canUnlockOffline() || !password) return
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(password, salt, ITERATIONS)
  const stored: OfflineCredential = {
    user, email: user.email ? user.email.toLowerCase() : null, phone: user.phone ?? null,
    salt: toHex(salt), hash, iterations: ITERATIONS, savedAt: new Date().toISOString(),
  }
  try { localStorage.setItem(KEY, JSON.stringify(stored)) } catch {}
}

/** A credencial guardada é desta pessoa? (e-mail ou telefone digitado, como no login) */
export function offlineCredentialFor(login: string): OfflineCredential | null {
  const stored = readCredential()
  if (!stored) return null
  const text = login.trim()
  if (text.includes('@')) return stored.email && stored.email === text.toLowerCase() ? stored : null
  const phone = normalizePhone(text)
  return phone && stored.phone === phone ? stored : null
}

/** Confere a senha sem internet. Devolve a pessoa guardada, ou null se não bater. */
export async function unlockOffline(login: string, password: string): Promise<UserData | null> {
  if (!canUnlockOffline()) return null
  const stored = offlineCredentialFor(login)
  if (!stored || !password) return null
  const hash = await derive(password, fromHex(stored.salt), stored.iterations)
  // Comparação sem sair cedo
  let diff = hash.length ^ stored.hash.length
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ (stored.hash.charCodeAt(i) || 0)
  return diff === 0 ? stored.user : null
}

export function clearOfflineCredential() {
  try { localStorage.removeItem(KEY) } catch {}
}

/** Sair comum: a pessoa deixa de estar logada; dados, filas e credencial ficam para entrar sem internet */
export function logoutKeepingDevice() {
  try { for (const key of SESSION_KEYS) localStorage.removeItem(key) } catch {}
  try { sessionStorage.clear() } catch {}
}

/** Sair e apagar tudo deste aparelho (aparelho emprestado ou de uso comum) */
export async function wipeDevice() {
  try { localStorage.clear() } catch {}
  try { sessionStorage.clear() } catch {}
  if (typeof caches !== 'undefined') {
    try { await Promise.all((await caches.keys()).map((name) => caches.delete(name))) } catch {}
  }
}
