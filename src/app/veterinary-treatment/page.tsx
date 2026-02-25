'use client'

import { useEffect, useState } from 'react'
import { VeterinaryTreatmentForm } from '@/components/VeterinaryTreatmentForm'
import { VeterinaryTreatmentList } from '@/components/VeterinaryTreatmentList'

interface AnimalOption {
  id: string
  code: string
  name: string
  species: string
}

export default function VeterinaryTreatmentPage() {
  const [animalId, setAnimalId] = useState('')
  const [animals, setAnimals] = useState<AnimalOption[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AnimalOption | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (!data.farmId) return
        fetch(`/api/animals?farmId=${data.farmId}`)
          .then((r) => r.json())
          .then((list: AnimalOption[]) => {
            setAnimals(list)
            setLoading(false)
          })
      })
  }, [])

  function handleSelect(id: string) {
    setAnimalId(id)
    setSelected(animals.find((a) => a.id === id) ?? null)
  }

  const handleSuccess = () => {
    setRefreshKey((prev) => prev + 1)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tratamentos Veterinários</h1>
        <p className="text-gray-500 text-sm mt-1">Registre e acompanhe tratamentos por animal</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">Selecionar animal</label>
        {loading ? (
          <p className="text-sm text-gray-400">Carregando animais...</p>
        ) : animals.length === 0 ? (
          <p className="text-sm text-gray-400">Nenhum animal cadastrado</p>
        ) : (
          <select
            value={animalId}
            onChange={(e) => handleSelect(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          >
            <option value="">— Selecione um animal —</option>
            {animals.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.code}) — {a.species}
              </option>
            ))}
          </select>
        )}

        {selected && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            <span className="font-medium text-gray-800">{selected.name}</span>
            <span className="text-gray-400">selecionado</span>
          </div>
        )}
      </div>

      {animalId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <VeterinaryTreatmentForm animalId={animalId} onSuccess={handleSuccess} />
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Histórico</h2>
            <VeterinaryTreatmentList key={refreshKey} animalId={animalId} />
          </div>
        </div>
      )}

      {!animalId && !loading && (
        <div className="bg-green-50 border border-green-100 text-green-700 px-6 py-4 rounded-xl text-sm text-center">
          Selecione um animal acima para registrar tratamentos
        </div>
      )}
    </div>
  )
}
