// Sessão do app: token e dados da pessoa guardados no aparelho (SecureStore). Sem internet, entra com o que está guardado.
import * as SecureStore from 'expo-secure-store'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, HttpError, setAuth } from '@/api/client'
import { wipeAll } from '@/db'
import { clearUnauthorized } from '@/sync'

export interface User {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  farmId: string | null
  farmName: string | null
  farms: { id: string; name: string }[]
  permissions: string[] | null
}

interface MeResponse extends User { token?: string }

interface Session {
  user: User | null
  loading: boolean
  login: (login: string, password: string) => Promise<void>
  logout: () => Promise<void>
  switchFarm: (farmId: string) => Promise<void>
  refresh: () => Promise<void>
  canAccess: (module: string) => boolean
  canEdit: boolean
}

const Ctx = createContext<Session | null>(null)
const KEY_TOKEN = 'anotaai_token'
const KEY_USER = 'anotaai_user'

function pickUser(me: MeResponse): User {
  return { id: me.id, name: me.name, email: me.email ?? null, phone: me.phone ?? null, role: me.role, farmId: me.farmId ?? null, farmName: me.farmName ?? null, farms: me.farms ?? [], permissions: me.permissions ?? null }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const persist = useCallback(async (token: string | null, u: User | null) => {
    setAuth({ token, farmId: u?.farmId ?? null })
    if (token) await SecureStore.setItemAsync(KEY_TOKEN, token); else await SecureStore.deleteItemAsync(KEY_TOKEN)
    if (u) await SecureStore.setItemAsync(KEY_USER, JSON.stringify(u)); else await SecureStore.deleteItemAsync(KEY_USER)
    setUser(u)
  }, [])

  /** Busca /api/auth/me: atualiza a pessoa, a propriedade e renova o token. Sem internet, mantém o que está guardado. */
  const refresh = useCallback(async () => {
    try {
      const me = await api<MeResponse>('/api/auth/me')
      const u = pickUser(me)
      await persist(me.token ?? (await SecureStore.getItemAsync(KEY_TOKEN)), u)
      clearUnauthorized()
    } catch (e) {
      if (e instanceof HttpError && e.status === 401) await persist(null, null)
    }
  }, [persist])

  useEffect(() => {
    (async () => {
      const token = await SecureStore.getItemAsync(KEY_TOKEN)
      const raw = await SecureStore.getItemAsync(KEY_USER)
      if (token && raw) {
        const u = JSON.parse(raw) as User
        setAuth({ token, farmId: u.farmId })
        setUser(u)
        setLoading(false)
        void refresh()
      } else {
        setLoading(false)
      }
    })()
  }, [refresh])

  const login = useCallback(async (loginText: string, password: string) => {
    const res = await api<{ token?: string }>('/api/auth/login', { method: 'POST', body: { login: loginText, password } })
    if (!res.token) throw new Error('O servidor não devolveu a sessão. Atualize o site e tente de novo.')
    setAuth({ token: res.token })
    const me = await api<MeResponse>('/api/auth/me')
    await persist(me.token ?? res.token, pickUser(me))
    clearUnauthorized()
  }, [persist])

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    wipeAll()
    await persist(null, null)
  }, [persist])

  const switchFarm = useCallback(async (farmId: string) => {
    await api('/api/auth/switch-farm', { method: 'POST', body: { farmId } })
    setAuth({ token: null, farmId })
    await refresh()
  }, [refresh])

  const value = useMemo<Session>(() => ({
    user, loading, login, logout, switchFarm, refresh,
    canAccess: (module) => !!user && (user.role === 'admin' || !!user.permissions?.includes(module)),
    canEdit: !!user && (user.role === 'admin' || user.role === 'editor'),
  }), [user, loading, login, logout, switchFarm, refresh])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSession(): Session {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSession fora do SessionProvider')
  return s
}

/** Propriedade aberta; as telas de módulo só existem com uma propriedade. */
export function useFarmId(): string {
  const { user } = useSession()
  return user?.farmId ?? ''
}
