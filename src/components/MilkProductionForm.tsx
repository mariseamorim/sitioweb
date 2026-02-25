'use client'

import { useState } from 'react'

interface MilkProductionFormProps {
  animalId: string
  onSuccess?: () => void
}

export function MilkProductionForm({ animalId, onSuccess }: MilkProductionFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const formData = new FormData(e.currentTarget)
    const data = {
      animalId,
      date: formData.get('date'),
      quantity: formData.get('quantity'),
      observations: formData.get('observations'),
    }

    try {
      const response = await fetch('/api/milk-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to add milk production')

      e.currentTarget.reset()
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar produção')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Registrar Produção</h2>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-4">{error}</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-gray-600">Data *</label>
          <input
            type="date"
            name="date"
            required
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600">Quantidade (litros) *</label>
          <input
            type="number"
            name="quantity"
            step="0.1"
            required
            className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
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
        {loading ? 'Salvando...' : 'Adicionar Produção'}
      </button>
    </form>
  )
}
