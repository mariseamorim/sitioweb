'use client'

import { useEffect, useState, useMemo } from 'react'

interface Animal { id: string; name: string; code: string }

interface Vaccination {
  id: string
  animalId: string
  animal: Animal
  vaccineName: string
  scheduledDate: string
  appliedDate?: string | null
  batch?: string | null
  manufacturer?: string | null
  observations?: string | null
}

type VaccStatus = 'Todas' | 'Pendente' | 'Aplicada' | 'Vencida'

function getStatus(v: Vaccination): 'Pendente' | 'Aplicada' | 'Vencida' {
  if (v.appliedDate) return 'Aplicada'
  if (new Date(v.scheduledDate) < new Date()) return 'Vencida'
  return 'Pendente'
}

const STATUS_COLOR: Record<string, string> = {
  Aplicada: 'bg-green-100 text-green-700',
  Pendente: 'bg-yellow-100 text-yellow-700',
  Vencida: 'bg-red-100 text-red-700',
}

export default function VacinacaoPage() {
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [farmId, setFarmId] = useState('')
  const [filter, setFilter] = useState<VaccStatus>('Todas')
  const [detail, setDetail] = useState<Vaccination | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ animalId: '', vaccineName: '', scheduledDate: '', appliedDate: '', batch: '', manufacturer: '', observations: '' })

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!data.farmId) return
      setFarmId(data.farmId)
      loadData(data.farmId)
    })
  }, [])

  function loadData(fid: string) {
    setLoading(true)
    Promise.all([
      fetch(`/api/vacinacao?farmId=${fid}`).then(r => r.json()),
      fetch(`/api/animals?farmId=${fid}`).then(r => r.json()),
    ]).then(([vaccs, anims]) => {
      setVaccinations(Array.isArray(vaccs) ? vaccs : [])
      setAnimals(Array.isArray(anims) ? anims : [])
      setLoading(false)
    })
  }

  const filtered = useMemo(() => {
    if (filter === 'Todas') return vaccinations
    return vaccinations.filter(v => getStatus(v) === filter)
  }, [vaccinations, filter])

  const alertCount = useMemo(() => {
    const in7 = new Date(); in7.setDate(in7.getDate() + 7)
    return vaccinations.filter(v => !v.appliedDate && new Date(v.scheduledDate) <= in7).length
  }, [vaccinations])

  async function handleDelete(id: string) {
    if (!confirm('Excluir este registro?')) return
    await fetch(`/api/vacinacao/${id}`, { method: 'DELETE' })
    setDetail(null)
    loadData(farmId)
  }

  async function handleApply(v: Vaccination) {
    const today = new Date().toISOString().slice(0, 10)
    await fetch(`/api/vacinacao/${v.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...v, appliedDate: today }),
    })
    setDetail(null)
    loadData(farmId)
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/vacinacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, appliedDate: form.appliedDate || null, batch: form.batch || null, manufacturer: form.manufacturer || null, observations: form.observations || null }),
    })
    setSaving(false)
    setShowRegister(false)
    setForm({ animalId: '', vaccineName: '', scheduledDate: '', appliedDate: '', batch: '', manufacturer: '', observations: '' })
    loadData(farmId)
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vacinação</h1>
          <p className="text-gray-500 text-sm mt-1">Agenda e controle de vacinas por animal</p>
        </div>
        <button onClick={() => setShowRegister(true)} className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
          + Registrar
        </button>
      </div>

      {alertCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 mb-6 text-sm flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <span><strong>{alertCount}</strong> vacina{alertCount > 1 ? 's' : ''} vencida{alertCount > 1 ? 's' : ''} ou com vencimento nos próximos 7 dias</span>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        {(['Todas', 'Pendente', 'Aplicada', 'Vencida'] as VaccStatus[]).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? 'bg-green-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-400 text-sm">Carregando...</p> : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhuma vacinação encontrada</p>
          <p className="text-sm mt-1">Clique em &quot;+ Registrar&quot; para começar</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Animal</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left">Vacina</th>
                <th className="px-4 py-3 text-left">Agendado</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left">Aplicado</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(v => {
                const status = getStatus(v)
                return (
                  <tr key={v.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetail(v)}>
                    <td className="px-4 py-3 font-medium text-gray-800">{v.animal.name}</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-600">{v.vaccineName}</td>
                    <td className="px-4 py-3 text-gray-600">{fmt(v.scheduledDate)}</td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-600">{v.appliedDate ? fmt(v.appliedDate) : '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[status]}`}>{status}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{detail.vaccineName}</h2>
                  <p className="text-xs text-gray-500">{detail.animal.name} · Cód. {detail.animal.code}</p>
                </div>
                <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div><p className="text-xs text-gray-500">Agendado</p><p className="font-medium text-gray-800">{fmt(detail.scheduledDate)}</p></div>
                <div><p className="text-xs text-gray-500">Aplicado</p><p className="font-medium text-gray-800">{detail.appliedDate ? fmt(detail.appliedDate) : '—'}</p></div>
                {detail.manufacturer && <div><p className="text-xs text-gray-500">Fabricante</p><p className="text-gray-700">{detail.manufacturer}</p></div>}
                {detail.batch && <div><p className="text-xs text-gray-500">Lote</p><p className="text-gray-700">{detail.batch}</p></div>}
                {detail.observations && <div className="col-span-2"><p className="text-xs text-gray-500">Observações</p><p className="text-gray-700">{detail.observations}</p></div>}
              </div>

              <div className="flex gap-2">
                {!detail.appliedDate && (
                  <button onClick={() => handleApply(detail)} className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-medium py-2 rounded-lg">
                    Marcar como Aplicada
                  </button>
                )}
                <button onClick={() => handleDelete(detail.id)} className="flex-1 border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium py-2 rounded-lg">
                  Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Registrar Vacinação</h2>
                <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>
              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Animal *</label>
                  <select value={form.animalId} onChange={e => setForm({ ...form, animalId: e.target.value })} required
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                    <option value="">— Selecione —</option>
                    {animals.map(a => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Vacina *</label>
                  <input type="text" value={form.vaccineName} onChange={e => setForm({ ...form, vaccineName: e.target.value })} required placeholder="Ex: Febre Aftosa"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Data Agendada *</label>
                    <input type="date" value={form.scheduledDate} onChange={e => setForm({ ...form, scheduledDate: e.target.value })} required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Data Aplicação</label>
                    <input type="date" value={form.appliedDate} onChange={e => setForm({ ...form, appliedDate: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Fabricante</label>
                    <input type="text" value={form.manufacturer} onChange={e => setForm({ ...form, manufacturer: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Lote</label>
                    <input type="text" value={form.batch} onChange={e => setForm({ ...form, batch: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Observações</label>
                  <textarea value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} rows={2}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowRegister(false)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-medium py-2 rounded-lg">{saving ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
