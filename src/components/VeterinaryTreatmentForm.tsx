'use client'

import { useState } from 'react'

interface VeterinaryTreatmentFormProps {
  animalId: string
  onSuccess?: () => void
}

export function VeterinaryTreatmentForm({ animalId, onSuccess }: VeterinaryTreatmentFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formEl = e.currentTarget
    const formData = new FormData(formEl)
    const data = {
      animalId,
      startDate: formData.get('startDate'),
      endDate: formData.get('endDate'),
      medicine: formData.get('medicine'),
      batch: formData.get('batch'),
      manufacturer: formData.get('manufacturer'),
      description: formData.get('description'),
      observations: formData.get('observations'),
    }

    try {
      const response = await fetch('/api/veterinary-treatment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to add veterinary treatment')

      formEl.reset()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar tratamento')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Registrar Tratamento</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600">Data Início *</label>
          <input
            type="date"
            name="startDate"
            required
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Data Fim</label>
          <input
            type="date"
            name="endDate"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Medicamento *</label>
          <input
            type="text"
            name="medicine"
            required
            placeholder="Ex: Amoxicilina"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Lote</label>
          <input
            type="text"
            name="batch"
            placeholder="Ex: 123456"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Fabricante</label>
          <input
            type="text"
            name="manufacturer"
            placeholder="Ex: Laboratório X"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-medium text-gray-600">Descrição</label>
          <textarea
            name="description"
            rows={2}
            placeholder="Descrição do tratamento"
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
          />
        </div>

        <div className="md:col-span-2">
          <label className="text-xs font-medium text-gray-600">Observações</label>
          <textarea
            name="observations"
            rows={3}
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
          />
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 w-full bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-medium py-2 rounded-lg transition-colors"
      >
        {loading ? 'Salvando...' : 'Adicionar Tratamento'}
      </button>
    </form>
  )
}
