'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'

interface Farm {
  id: string
  name: string
  propertyType: string | null
  owner: string | null
  city: string | null
  state: string | null
}

export function FarmPicker({ farms }: { farms: Farm[] }) {
  const router = useRouter()
  const { refresh } = useUser()
  const [loading, setLoading] = useState<string | null>(null)

  async function selectFarm(farmId: string) {
    setLoading(farmId)
    await fetch('/api/auth/switch-farm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ farmId }),
    })
    refresh()
    router.refresh()
    setLoading(null)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Painel Admin</h1>
        <p className="text-gray-500 text-sm mt-1">
          Selecione uma propriedade para visualizar e gerenciar
        </p>
      </div>

      {farms.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <div className="text-4xl mb-3">🏡</div>
          <p className="text-gray-500 text-sm">Nenhuma propriedade cadastrada ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {farms.map(farm => (
            <button
              key={farm.id}
              onClick={() => selectFarm(farm.id)}
              disabled={loading === farm.id}
              className="text-left bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-green-200 transition-all disabled:opacity-60 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-xl shrink-0 group-hover:bg-green-100 transition-colors">
                  🏡
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{farm.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{farm.propertyType ?? 'Fazenda'}</p>
                  {farm.owner && (
                    <p className="text-xs text-gray-500 mt-1 truncate">{farm.owner}</p>
                  )}
                  {(farm.city || farm.state) && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[farm.city, farm.state].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
              {loading === farm.id && (
                <p className="text-xs text-green-600 mt-3">Carregando...</p>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
