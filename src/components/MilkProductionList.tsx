'use client'

import { useEffect, useState } from 'react'

interface MilkProduction {
  id: string
  date: string
  quantity: number
  observations?: string
}

interface MilkProductionListProps {
  animalId: string
}

export function MilkProductionList({ animalId }: MilkProductionListProps) {
  const [productions, setProductions] = useState<MilkProduction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProductions() {
      try {
        const response = await fetch(`/api/milk-production?animalId=${animalId}`)
        if (response.ok) {
          const data = await response.json()
          setProductions(data)
        }
      } catch (error) {
        console.error('Failed to load productions:', error)
      } finally {
        setLoading(false)
      }
    }

    loadProductions()
  }, [animalId])

  if (loading) return <div className="text-center py-4">Carregando...</div>

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            <th className="px-4 py-3 text-left">Data</th>
            <th className="px-4 py-3 text-left">Quantidade (L)</th>
            <th className="px-4 py-3 text-left">Observações</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {productions.map((prod) => (
            <tr key={prod.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-700">{new Date(prod.date).toLocaleDateString('pt-BR')}</td>
              <td className="px-4 py-3 font-medium text-gray-800">{prod.quantity.toFixed(1)}</td>
              <td className="px-4 py-3 text-gray-500">{prod.observations || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {productions.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">Nenhum registro de produção</div>
      )}
    </div>
  )
}
