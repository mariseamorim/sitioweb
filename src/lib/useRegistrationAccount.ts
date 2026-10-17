'use client'
import { useEffect, useState } from 'react'
import { contactLabel } from '@/lib/identity'

export function useRegistrationAccount() {
  const [account, setAccount] = useState<{ name: string; email: string | null; phone: string | null; label: string } | null>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    fetch('/api/auth/me').then(async r => {
      if (r.status === 401) return
      if (!r.ok) throw new Error('Não foi possível verificar a conta')
      const user = await r.json()
      if (user.role !== 'onboarding') { window.location.href = '/'; return }
      setAccount({ name: user.name, email: user.email ?? null, phone: user.phone ?? null, label: contactLabel(user) })
    }).catch(() => setError('Verifique sua conexão para continuar o cadastro.')).finally(() => setReady(true))
  }, [])
  return { account, ready, error }
}
