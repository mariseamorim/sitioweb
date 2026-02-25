'use client'

import { useEffect, useState } from 'react'

interface VeterinaryTreatment {
  id: string
  startDate: string
  endDate?: string
  medicine: string
  batch?: string
  manufacturer?: string
  description?: string
}

interface VeterinaryTreatmentListProps {
  animalId: string
}

export function VeterinaryTreatmentList({ animalId }: VeterinaryTreatmentListProps) {
  const [treatments, setTreatments] = useState<VeterinaryTreatment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadTreatments() {
      try {
        const response = await fetch(`/api/veterinary-treatment?animalId=${animalId}`)
        if (response.ok) {
          const data = await response.json()
          setTreatments(data)
        }
      } catch (error) {
        console.error('Failed to load treatments:', error)
      } finally {
        setLoading(false)
      }
    }

    loadTreatments()
  }, [animalId])

  if (loading) return <div className="text-center py-4">Carregando...</div>

  return (
    <div className="space-y-4">
      {treatments.map((treatment) => (
        <div key={treatment.id} className="bg-white p-4 rounded-lg shadow border-l-4 border-green-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Medicamento</p>
              <p className="font-semibold">{treatment.medicine}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Data Início</p>
              <p className="font-semibold">{new Date(treatment.startDate).toLocaleDateString('pt-BR')}</p>
            </div>
            {treatment.endDate && (
              <div>
                <p className="text-sm text-gray-600">Data Fim</p>
                <p className="font-semibold">{new Date(treatment.endDate).toLocaleDateString('pt-BR')}</p>
              </div>
            )}
            {treatment.manufacturer && (
              <div>
                <p className="text-sm text-gray-600">Fabricante</p>
                <p className="font-semibold">{treatment.manufacturer}</p>
              </div>
            )}
            {treatment.batch && (
              <div>
                <p className="text-sm text-gray-600">Lote</p>
                <p className="font-semibold">{treatment.batch}</p>
              </div>
            )}
            {treatment.description && (
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600">Descrição</p>
                <p className="font-semibold">{treatment.description}</p>
              </div>
            )}
          </div>
        </div>
      ))}
      {treatments.length === 0 && (
        <div className="text-center py-8 text-gray-500">Nenhum tratamento registrado</div>
      )}
    </div>
  )
}
