'use client'

import { useEffect, useState } from 'react'
import { ESPECIES, STATUS_LIST, type Especie, type StatusAnimal } from '@/lib/types'
import { ImagePicker } from '@/components/ImagePicker'

interface Animal {
  id: string
  code: string
  name: string
  species: string
  gender: string
  birthDate: string
  status: string
  gta?: string
  observations?: string
  imageUrl?: string
}

const EMPTY_FORM = {
  code: '',
  name: '',
  species: 'Vaca' as Especie,
  gender: 'Fêmea',
  birthDate: '',
  status: 'Vivo' as StatusAnimal,
  gta: '',
  observations: '',
  imageUrl: '',
}

export default function AnimaisPage() {
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [farmId, setFarmId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Animal | null>(null)
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.farmId) {
          setFarmId(data.farmId)
          fetchAnimals(data.farmId)
        }
      })
  }, [])

  function fetchAnimals(fid: string) {
    setLoading(true)
    fetch(`/api/animals?farmId=${fid}`)
      .then((r) => r.json())
      .then((data) => { setAnimals(data); setLoading(false) })
  }

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, code: getNextCode(animals) })
    setError('')
    setShowForm(true)
  }

  function openEdit(a: Animal) {
    setEditing(a)
    setForm({
      code: a.code,
      name: a.name,
      species: a.species as Especie,
      gender: a.gender,
      birthDate: a.birthDate.slice(0, 10),
      status: a.status as StatusAnimal,
      gta: a.gta || '',
      observations: a.observations || '',
      imageUrl: a.imageUrl || '',
    })
    setError('')
    setShowForm(true)
  }

  function openDetails(a: Animal) {
    setSelectedAnimal(a)
  }

  function closeDetails() {
    setSelectedAnimal(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')

    const url = editing ? `/api/animals/${editing.id}` : '/api/animals'
    const method = editing ? 'PUT' : 'POST'
    const body = editing ? form : { ...form, farmId }

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Erro ao salvar')
      setSaving(false)
      return
    }

    setSaving(false)
    setShowForm(false)
    fetchAnimals(farmId)
  }

  async function handleDelete(id: string) {
    if (!confirm('Deseja excluir este animal?')) return
    await fetch(`/api/animals/${id}`, { method: 'DELETE' })
    fetchAnimals(farmId)
  }

  const filtered = animals.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.code.toLowerCase().includes(search.toLowerCase()) ||
      a.species.toLowerCase().includes(search.toLowerCase())
  )

  const statusColor: Record<string, string> = {
    Vivo: 'bg-green-100 text-green-700',
    Morto: 'bg-gray-100 text-gray-600',
    Vendido: 'bg-blue-100 text-blue-700',
    Doente: 'bg-red-100 text-red-700',
    Arrendado: 'bg-yellow-100 text-yellow-700',
  }

  function getNextCode(list: Animal[]) {
    const maxNum = list.reduce((acc, item) => {
      const n = Number.parseInt(item.code, 10)
      return Number.isFinite(n) && n > acc ? n : acc
    }, 0)
    const next = maxNum + 1
    return String(next).padStart(2, '0')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Animais</h1>
        <button
          onClick={openNew}
          className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          + Novo Animal
        </button>
      </div>

      <input
        type="text"
        placeholder="Buscar por nome, código ou espécie..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-green-600"
      />

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhum animal cadastrado</p>
          <p className="text-sm mt-1">Clique em &quot;+ Novo Animal&quot; para começar</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-2 sm:px-4 py-3 text-left">Foto</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left">Código</th>
                <th className="px-2 sm:px-4 py-3 text-left">Nome</th>
                <th className="hidden md:table-cell px-4 py-3 text-left">Espécie</th>
                <th className="hidden lg:table-cell px-4 py-3 text-left">Sexo</th>
                <th className="hidden md:table-cell px-4 py-3 text-left">Status</th>
                <th className="px-2 sm:px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openDetails(a)}
                >
                  <td className="px-2 sm:px-4 py-2">
                    {a.imageUrl ? (
                      <img src={a.imageUrl} alt={a.name} className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg bg-gray-100 flex items-center justify-center text-sm sm:text-lg">🐄</div>
                    )}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 font-mono text-gray-600 text-xs sm:text-sm">{a.code}</td>
                  <td className="px-2 sm:px-4 py-3 font-medium text-gray-800 text-xs sm:text-sm">{a.name}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-gray-600 text-xs sm:text-sm">{a.species}</td>
                  <td className="hidden lg:table-cell px-4 py-3 text-gray-600 text-xs sm:text-sm">{a.gender}</td>
                  <td className="hidden md:table-cell px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[a.status] || 'bg-gray-100 text-gray-600'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-right space-x-1 sm:space-x-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(a) }}
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline text-xs"
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(a.id) }}
                      className="inline-flex items-center gap-1 text-red-500 hover:underline text-xs"
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedAnimal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4" onClick={closeDetails}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                <div className="flex items-start gap-3">
                  {selectedAnimal.imageUrl ? (
                    <img src={selectedAnimal.imageUrl} alt={selectedAnimal.name} className="w-12 sm:w-16 h-12 sm:h-16 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 sm:w-16 h-12 sm:h-16 rounded-xl bg-gray-100 flex items-center justify-center text-lg sm:text-2xl flex-shrink-0">🐄</div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Código</p>
                    <p className="text-base sm:text-lg font-semibold text-gray-800 break-words">{selectedAnimal.code}</p>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">{selectedAnimal.species}</p>
                  </div>
                </div>
                <button
                  onClick={closeDetails}
                  className="text-gray-500 hover:text-gray-700 text-sm flex-shrink-0"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4 sm:mt-6 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Nome</p>
                  <p className="font-medium text-gray-800 truncate">{selectedAnimal.name}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Sexo</p>
                  <p className="font-medium text-gray-800">{selectedAnimal.gender}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Data de Nascimento</p>
                  <p className="font-medium text-gray-800 text-xs sm:text-sm">
                    {new Date(selectedAnimal.birthDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor[selectedAnimal.status] || 'bg-gray-100 text-gray-600'}`}>
                    {selectedAnimal.status}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">GTA</p>
                  <p className="font-medium text-gray-800 truncate text-xs sm:text-sm">{selectedAnimal.gta || '-'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Observações</p>
                  <p className="font-medium text-gray-800 text-xs sm:text-sm line-clamp-2">{selectedAnimal.observations || '-'}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-6">
                <button
                  onClick={() => { closeDetails(); openEdit(selectedAnimal) }}
                  className="inline-flex items-center justify-center bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-3 py-2 rounded-lg flex-1 sm:flex-none"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => { closeDetails(); handleDelete(selectedAnimal.id) }}
                  className="inline-flex items-center justify-center border border-gray-200 text-gray-700 text-sm font-medium px-3 py-2 rounded-lg hover:bg-gray-50 flex-1 sm:flex-none"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                {editing ? 'Editar Animal' : 'Novo Animal'}
              </h2>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                {/* Foto */}
                <ImagePicker
                  value={form.imageUrl}
                  onChange={(base64) => setForm({ ...form, imageUrl: base64 })}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Código *</label>
                    <input
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      required
                      disabled={!editing}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Nome *</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Espécie *</label>
                    <select
                      value={form.species}
                      onChange={(e) => setForm({ ...form, species: e.target.value as Especie })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    >
                      {ESPECIES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Sexo *</label>
                    <select
                      value={form.gender}
                      onChange={(e) => setForm({ ...form, gender: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    >
                      <option>Fêmea</option>
                      <option>Macho</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Data de Nascimento *</label>
                    <input
                      type="date"
                      value={form.birthDate}
                      onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                      required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Status *</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as StatusAnimal })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    >
                      {STATUS_LIST.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">GTA (Guia de Trânsito Animal)</label>
                  <input
                    value={form.gta}
                    onChange={(e) => setForm({ ...form, gta: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">Observações</label>
                  <textarea
                    value={form.observations}
                    onChange={(e) => setForm({ ...form, observations: e.target.value })}
                    rows={2}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
                  />
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
  )
}
