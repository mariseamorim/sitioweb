'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { PropriedadeIcon } from '@/components/ModuleIcons'
import { OwnerGroups } from '@/components/OwnerGroups'
import type { AdminFarmSummary } from '@/lib/ownerGroups'

// Administrador sem propriedade aberta: escolhe uma, agrupadas por proprietário
export function FarmPicker({ farms }: { farms: AdminFarmSummary[] }) {
  const router = useRouter()
  const { refresh } = useUser()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function selectFarm(farm: AdminFarmSummary) {
    if (loading) return
    setError('')
    setLoading(farm.id)
    try {
      const response = await fetch('/api/auth/switch-farm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farmId: farm.id }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        setError(data.error || 'Não foi possível abrir esta propriedade. Tente novamente.')
        return
      }
      refresh()
      router.refresh()
    } catch {
      setError('Não foi possível abrir a propriedade. Confira a internet e tente novamente.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Escolha uma propriedade</h1>
          <p className="text-gray-500 text-sm mt-1">Agrupadas por proprietário. Toque em Abrir para entrar numa delas.</p>
        </div>
        <Link href="/fazendas" className="inline-flex min-h-11 items-center rounded-lg border border-green-700 px-4 text-sm font-semibold text-green-800 hover:bg-green-50">Gerenciar cadastros</Link>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {farms.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <PropriedadeIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm">Nenhuma propriedade cadastrada ainda.</p>
          <Link href="/fazendas" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-green-700 px-4 text-white">Cadastrar propriedade</Link>
        </div>
      ) : (
        <OwnerGroups farms={farms} onOpen={(farm) => void selectFarm(farm)} openingId={loading} />
      )}
    </div>
  )
}
