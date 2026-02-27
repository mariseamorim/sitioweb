'use client'
import { PermissionGuard } from '@/components/PermissionGuard'

import { useEffect, useState } from 'react'

interface Farm {
  id: string
  name: string
  propertyType?: string
  documentType?: string
  documentNumber?: string
  owner?: string
  email?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  isActive?: boolean
}

const EMPTY = {
  name: '',
  propertyType: 'Fazenda',
  documentType: 'CNPJ',
  documentNumber: '',
  owner: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
}

const typeColor: Record<string, string> = {
  Fazenda: 'bg-green-100 text-green-700',
  Sítio:   'bg-amber-100 text-amber-700',
}

export default function PropriedadesPage() {
  const [farms, setFarms] = useState<Farm[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)

  function fetchFarms() {
    setLoading(true)
    fetch('/api/farms')
      .then((r) => r.json())
      .then((data) => { setFarms(data); setLoading(false) })
  }

  useEffect(() => { fetchFarms() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const res = await fetch('/api/farms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error || 'Erro ao salvar'); setSaving(false); return }

    setSaving(false)
    setShowForm(false)
    setForm(EMPTY)
    fetchFarms()
  }

  async function handleDelete(farmId: string) {
    if (!confirm('Tem certeza? Se a propriedade não tiver dados será deletada permanentemente. Se tiver dados, será inativada.')) return
    setDeleting(farmId)
    
    const res = await fetch(`/api/farms/${farmId}/delete`, { method: 'DELETE' })
    const data = await res.json()
    
    setDeleting(null)
    if (!res.ok) {
      alert('Erro: ' + (data.error || 'Erro desconhecido'))
      return
    }
    
    alert(data.message)
    fetchFarms()
  }

  return (
    <PermissionGuard module="fazendas">
      <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Propriedades</h1>
        <button
          onClick={() => { setShowForm(true); setError('') }}
          className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Nova Propriedade
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : farms.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhuma propriedade cadastrada</p>
          <p className="text-sm mt-1">Clique em &quot;+ Nova Propriedade&quot; para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {farms.filter(f => f.isActive !== false).map((f) => (
            <div key={f.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 relative">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-bold text-gray-800 text-lg leading-tight">{f.name}</h2>
                <div className="flex gap-1 shrink-0">
                  {f.propertyType && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${typeColor[f.propertyType] ?? 'bg-gray-100 text-gray-600'}`}>
                      {f.propertyType}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(f.id)}
                    disabled={deleting === f.id}
                    className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Deletar/Inativar"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              {(f.documentType || f.documentNumber) && (
                <p className="text-sm text-gray-500">{f.documentType}: {f.documentNumber}</p>
              )}
              {f.owner && <p className="text-sm text-gray-500">Proprietário: {f.owner}</p>}
              {f.address && <p className="text-sm text-gray-500">{f.address}</p>}
              {(f.city || f.state) && (
                <p className="text-sm text-gray-500">{[f.city, f.state].filter(Boolean).join(' — ')}</p>
              )}
              {f.phone && <p className="text-sm text-gray-500 mt-1">{f.phone}</p>}
              {f.email && <p className="text-sm text-gray-500">{f.email}</p>}
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">Nova Propriedade</h2>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">

                {/* Tipo de propriedade */}
                <div>
                  <label className="text-xs font-medium text-gray-600">Tipo de Propriedade *</label>
                  <div className="mt-1 flex gap-2">
                    {['Fazenda', 'Sítio'].map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setForm({ ...form, propertyType: tipo })}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          form.propertyType === tipo
                            ? 'bg-green-700 border-green-700 text-white'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {tipo}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">Nome *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder={`Nome ${form.propertyType === 'Sítio' ? 'do Sítio' : 'da Fazenda'}`}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">Proprietário</label>
                  <input
                    value={form.owner}
                    onChange={(e) => setForm({ ...form, owner: e.target.value })}
                    placeholder="Nome do proprietário"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Doc. Tipo</label>
                    <select
                      value={form.documentType}
                      onChange={(e) => setForm({ ...form, documentType: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    >
                      <option value="CNPJ">CNPJ</option>
                      <option value="CPF">CPF</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-medium text-gray-600">Documento (CPF/CNPJ)</label>
                    <input
                      value={form.documentNumber}
                      onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                      placeholder="000.000.000-00"
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Telefone</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">E-mail</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">Endereço</label>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Cidade</label>
                    <input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Estado</label>
                    <input
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      placeholder="SP"
                      maxLength={2}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-medium py-2 rounded-lg"
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
    </PermissionGuard>
  )
}
