'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'

export function AdminFarmBanner() {
  const router = useRouter()
  const { refresh } = useUser()
  const [loading, setLoading] = useState(false)

  async function switchFarm() {
    setLoading(true)
    await fetch('/api/auth/switch-farm', { method: 'DELETE' })
    refresh()
    router.refresh()
    setLoading(false)
  }

  return (
    <button
      onClick={switchFarm}
      disabled={loading}
      className="shrink-0 flex items-center gap-1.5 text-xs text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 transition-colors px-3 py-1.5 rounded-lg font-medium disabled:opacity-60"
    >
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
      </svg>
      Trocar Propriedade
    </button>
  )
}
