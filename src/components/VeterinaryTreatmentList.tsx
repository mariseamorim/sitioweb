'use client'

import { useEffect, useState } from 'react'
import { useLocale, useT } from '@/lib/i18n'

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
  const t = useT()
  const locale = useLocale()
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

  if (loading) return <div className="text-center py-4">{t('Carregando...')}</div>

  return (
    <div className="space-y-4">
      {treatments.map((treatment) => (
        <div key={treatment.id} className="bg-white p-4 rounded-lg shadow border-l-4 border-green-600">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">{t('Medicamento')}</p>
              <p className="font-semibold">{treatment.medicine}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">{t('Data Início')}</p>
              <p className="font-semibold">{new Date(treatment.startDate).toLocaleDateString(locale, { timeZone: 'UTC' })}</p>
            </div>
            {treatment.endDate && (
              <div>
                <p className="text-sm text-gray-600">{t('Data Fim')}</p>
                <p className="font-semibold">{new Date(treatment.endDate).toLocaleDateString(locale, { timeZone: 'UTC' })}</p>
              </div>
            )}
            {treatment.manufacturer && (
              <div>
                <p className="text-sm text-gray-600">{t('Fabricante')}</p>
                <p className="font-semibold">{treatment.manufacturer}</p>
              </div>
            )}
            {treatment.batch && (
              <div>
                <p className="text-sm text-gray-600">{t('Lote')}</p>
                <p className="font-semibold">{treatment.batch}</p>
              </div>
            )}
            {treatment.description && (
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600">{t('Descrição')}</p>
                <p className="font-semibold">{treatment.description}</p>
              </div>
            )}
          </div>
        </div>
      ))}
      {treatments.length === 0 && (
        <div className="text-center py-8 text-gray-500">{t('Nenhum tratamento registrado')}</div>
      )}
    </div>
  )
}
