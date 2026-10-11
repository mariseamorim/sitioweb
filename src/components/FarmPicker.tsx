'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { PropriedadeIcon } from '@/components/ModuleIcons'

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
  const [error, setError] = useState('')

  async function selectFarm(farmId: string) {
    if (loading) return
    setError('')
    setLoading(farmId)
    try {
      const response = await fetch('/api/auth/switch-farm', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farmId }),
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
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Escolha sua propriedade</h1>
        <p className="text-gray-500 text-sm mt-1">
          Toque na propriedade que você quer acompanhar.
        </p>
      </div>

      {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
      {farms.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-8 text-center">
          <PropriedadeIcon className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm">Nenhuma propriedade cadastrada ainda.</p>
          <Link href="/fazendas" className="mt-4 inline-flex min-h-11 items-center rounded-lg bg-green-700 px-4 text-white">Cadastrar minha propriedade</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {farms.map(farm => (
            <button
              key={farm.id}
              onClick={() => selectFarm(farm.id)}
              disabled={loading !== null}
              className="text-left bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md hover:border-green-200 transition-all disabled:opacity-60 group"
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center text-green-700 shrink-0 group-hover:bg-green-100 transition-colors">
                  <PropriedadeIcon className="w-5 h-5" />
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
              <p className="mt-3 text-sm font-medium text-green-700">{loading === farm.id ? 'Abrindo propriedade...' : 'Abrir propriedade →'}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
