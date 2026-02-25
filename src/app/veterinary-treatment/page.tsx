'use client'

import { useEffect, useMemo, useState } from 'react'
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
  const [search, setSearch] = useState('')
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

  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return []
    return animals.filter(
      (a) => a.name.toLowerCase().includes(term) || a.code.toLowerCase().includes(term)
    ).slice(0, 10)
  }, [animals, search])

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
        <label className="block text-sm font-medium text-gray-700 mb-2">Buscar animal</label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Digite o nome ou código do animal..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
        />

        {loading && (
          <p className="text-sm text-gray-400 mt-2">Carregando animais...</p>
        )}

        {!loading && results.length > 0 && (
          <div className="mt-2 border border-gray-100 rounded-lg divide-y divide-gray-50 overflow-hidden shadow-sm">
            {results.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setAnimalId(a.id)
                  setSelected(a)
                  setSearch('')
                }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 text-sm transition-colors"
              >
                <span className="font-medium text-gray-800">{a.name}</span>
                <span className="text-xs text-gray-500 ml-2">{a.code}</span>
                <span className="text-xs text-gray-400 ml-1">({a.species})</span>
              </button>
            ))}
          </div>
        )}

        {!loading && search && results.length === 0 && (
          <p className="text-sm text-gray-400 mt-2">Nenhum animal encontrado</p>
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

      {!animalId && (
        <div className="bg-green-50 border border-green-100 text-green-700 px-6 py-4 rounded-xl text-sm text-center">
          Busque um animal acima para registrar tratamentos
        </div>
      )}
    </div>
  )
}
