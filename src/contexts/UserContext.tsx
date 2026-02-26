'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export interface UserData {
  id: string
  name: string
  email: string
  role: string
  farmId: string
  permissions: string[] | null // null = admin (acesso total)
}

interface UserContextType {
  user: UserData | null
  loading: boolean
  canAccess: (module: string) => boolean
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  canAccess: () => false,
})

export function UserProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => (r.ok ? r.json() : null))
      .then(data => { setUser(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  function canAccess(module: string): boolean {
    if (!user) return false
    if (user.role === 'admin') return true
    if (!user.permissions) return false
    return user.permissions.includes(module)
  }

  return (
    <UserContext.Provider value={{ user, loading, canAccess }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  return useContext(UserContext)
}
