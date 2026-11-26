// Sessão do app: token e dados da pessoa guardados no aparelho (SecureStore). Sem internet, entra com o que está guardado.
import * as SecureStore from 'expo-secure-store'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, getToken, HttpError, setAuth } from '@/api/client'
import { wipeAll } from '@/db'
import { clearUnauthorized } from '@/sync'
import { disableBackgroundSync } from '@/sync/background'
import { KEY_TOKEN, KEY_USER } from './stored'
import { DEMO_TOKEN, demoUser, seedDemo } from '@/demo'

export interface User {
  id: string
  name: string
  email: string | null
  phone: string | null
  /** Foto do perfil (data URL); sem foto, as iniciais */
  avatar?: string | null
  role: string
  farmId: string | null
  farmName: string | null
  farms: { id: string; name: string; segments?: string[] }[]
  /** O que a propriedade aberta faz (leite, cria, recria, engorda) */
  farmSegments?: string[]
  permissions: string[] | null
  /** O servidor tem WhatsApp de suporte configurado */
  support: boolean
  /** Veterinário consultor: atende várias propriedades (painel em /consultoria) */
  vet?: boolean
}

interface MeResponse extends User { token?: string }

interface Session {
  user: User | null
  loading: boolean
  login: (login: string, password: string) => Promise<void>
  logout: () => Promise<void>
  /** Entra na demonstração do veterinário (dados fictícios, sem servidor) */
  enterDemo: () => Promise<void>
  switchFarm: (farmId: string) => Promise<void>
  refresh: () => Promise<void>
  canAccess: (module: string) => boolean
  canEdit: boolean
}

const Ctx = createContext<Session | null>(null)

function pickUser(me: MeResponse): User {
  return { id: me.id, name: me.name, email: me.email ?? null, phone: me.phone ?? null, role: me.role, farmId: me.farmId ?? null, farmName: me.farmName ?? null, farms: me.farms ?? [], farmSegments: me.farmSegments ?? [], permissions: me.permissions ?? null, support: me.support !== false, vet: !!me.vet }
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
      // Sessão guardada ilegível (cofre do Android recriado, dado corrompido): segue para a tela de entrada
      let token: string | null = null
      let raw: string | null = null
      try {
        token = await SecureStore.getItemAsync(KEY_TOKEN)
        raw = await SecureStore.getItemAsync(KEY_USER)
        if (raw) JSON.parse(raw)
      } catch {
        token = null
        raw = null
        await SecureStore.deleteItemAsync(KEY_TOKEN).catch(() => undefined)
        await SecureStore.deleteItemAsync(KEY_USER).catch(() => undefined)
      }
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

  const enterDemo = useCallback(async () => {
    seedDemo()
    await persist(DEMO_TOKEN, pickUser(demoUser()))
    clearUnauthorized()
  }, [persist])

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    wipeAll()
    await persist(null, null)
    await disableBackgroundSync()
  }, [persist])

  const switchFarm = useCallback(async (farmId: string) => {
    await api('/api/auth/switch-farm', { method: 'POST', body: { farmId } })
    // Mantém o token: sem ele o /api/auth/me seguinte voltava 401 e a pessoa era desconectada
    setAuth({ token: getToken(), farmId })
    await refresh()
  }, [refresh])

  const value = useMemo<Session>(() => ({
    user, loading, login, logout, enterDemo, switchFarm, refresh,
    canAccess: (module) => !!user && (user.role === 'admin' || !!user.permissions?.includes(module)),
    canEdit: !!user && (user.role === 'admin' || user.role === 'editor'),
  }), [user, loading, login, logout, enterDemo, switchFarm, refresh])

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
