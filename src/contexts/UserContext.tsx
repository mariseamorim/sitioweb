'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export interface UserData {
  id: string
  name: string
  email: string
  role: string
  farmId: string | null       // null for admin with no farm selected
  farmName: string | null     // name of the active farm
  permissions: string[] | null // null = admin (acesso total)
}

interface UserContextType {
  user: UserData | null
  loading: boolean
  canAccess: (module: string) => boolean
  isAdmin: boolean
  refresh: () => void
}

const USER_CACHE_KEY = 'cached_user'

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  canAccess: () => false,
  isAdmin: false,
  refresh: () => {},
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    setLoading(true)
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data) {
          // Online: update cache and state
          localStorage.setItem(USER_CACHE_KEY, JSON.stringify(data))
          setUser(data)
        } else {
          // Server returned error (e.g. 401 = not logged in): clear cache
          localStorage.removeItem(USER_CACHE_KEY)
          setUser(null)
        }
        setLoading(false)
      })
      .catch(() => {
        // Network error (offline): fall back to cached user data
        try {
          const cached = localStorage.getItem(USER_CACHE_KEY)
          setUser(cached ? JSON.parse(cached) : null)
        } catch {
          setUser(null)
        }
        setLoading(false)
      })
  }, [tick])

  function refresh() {
    setTick(t => t + 1)
  }

  function canAccess(module: string): boolean {
    if (!user) return false
    if (user.role === 'admin') return true
    if (!user.permissions) return false
    return user.permissions.includes(module)
  }

  const isAdmin = user?.role === 'admin'

  return (
    <UserContext.Provider value={{ user, loading, canAccess, isAdmin, refresh }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
