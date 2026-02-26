'use client'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'

import { useEffect, useState, useMemo } from 'react'
import { getPendingRecords, addPendingRecord, clearPendingRecords } from '@/lib/offlineStorage'

interface Animal {
  id: string
  name: string
  code: string
}

interface Treatment {
  id: string
  animalId: string
  startDate: string
  endDate?: string | null
  medicine: string
  batch?: string | null
  manufacturer?: string | null
  description?: string | null
  observations?: string | null
  animal: Animal
}

export default function VeterinaryTreatmentPage() {
  const { user } = useUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const now = new Date()
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [allAnimals, setAllAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [farmId, setFarmId] = useState('')
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10))
  const [detailAnimalId, setDetailAnimalId] = useState<string | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    animalId: '', startDate: '', endDate: '',
    medicine: '', batch: '', manufacturer: '', description: '', observations: '',
  })
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setPendingCount(getPendingRecords('veterinary-treatment').length)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (!data.farmId) return
        setFarmId(data.farmId)
        loadData(data.farmId)
      })
  }, [])

  function loadData(fid: string) {
    setLoading(true)
    Promise.all([
      fetch(`/api/veterinary-treatment?farmId=${fid}`).then((r) => r.json()),
      fetch(`/api/animals?farmId=${fid}`).then((r) => r.json()),
    ]).then(([trts, animals]) => {
      setTreatments(Array.isArray(trts) ? trts : [])
      setAllAnimals(Array.isArray(animals) ? animals : [])
      setLoading(false)
    })
  }

  const filtered = useMemo(() => {
    return treatments.filter((t) => {
      const d = new Date(t.startDate)
      if (from && d < new Date(from)) return false
      if (to && d > new Date(to + 'T23:59:59')) return false
      return true
    })
  }, [treatments, from, to])

  const summary = useMemo(() => {
    const map = new Map<string, { animal: Animal; count: number; last: string }>()
    for (const t of filtered) {
      const s = map.get(t.animalId)
      if (s) {
        s.count++
        if (new Date(t.startDate) > new Date(s.last)) s.last = t.startDate
      } else {
        map.set(t.animalId, { animal: t.animal, count: 1, last: t.startDate })
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.last).getTime() - new Date(a.last).getTime())
  }, [filtered])

  const detailAnimal = detailAnimalId
    ? treatments.find((t) => t.animalId === detailAnimalId)?.animal ?? null
    : null

  const detailTreatments = useMemo(() => {
    if (!detailAnimalId) return []
    return [...treatments.filter((t) => t.animalId === detailAnimalId)].sort(
      (a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()
    )
  }, [treatments, detailAnimalId])

  const detailPeriodCount = filtered.filter((t) => t.animalId === detailAnimalId).length

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (!confirm('Excluir este tratamento?')) return
    await fetch(`/api/veterinary-treatment/${id}`, { method: 'DELETE' })
    loadData(farmId)
  }

  async function handleSync() {
    const pending = getPendingRecords('veterinary-treatment')
    if (!pending.length) return
    setSyncing(true)
    for (const record of pending) {
      const { _pendingId, _type, farmId: _, ...data } = record
      await fetch('/api/veterinary-treatment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, farmId }),
      })
    }
    clearPendingRecords('veterinary-treatment')
    setPendingCount(0)
    setSyncing(false)
    loadData(farmId)
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    // Se estiver offline, salva no localStorage
    if (!isOnline) {
      addPendingRecord('veterinary-treatment', { ...form, farmId })
      setPendingCount(getPendingRecords('veterinary-treatment').length)
      setSaving(false)
      setShowRegister(false)
      setForm({
        animalId: '', startDate: '', endDate: '',
        medicine: '', batch: '', manufacturer: '', description: '', observations: '',
      })
      return
    }

    // Se estiver online, envia para API
    await fetch('/api/veterinary-treatment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        endDate: form.endDate || null,
        batch: form.batch || null,
        manufacturer: form.manufacturer || null,
        description: form.description || null,
        observations: form.observations || null,
      }),
    })
    setSaving(false)
    setShowRegister(false)
    setForm({ animalId: '', startDate: '', endDate: '', medicine: '', batch: '', manufacturer: '', description: '', observations: '' })
    loadData(farmId)
  }

  function fmt(date: string) {
    return new Date(date).toLocaleDateString('pt-BR')
  }

  return (
    <PermissionGuard module="veterinario">
      <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tratamentos Veterinários</h1>
          <p className="text-gray-500 text-sm mt-1">Resumo por animal no período selecionado</p>
        </div>
        <button
          onClick={() => setShowRegister(true)}
          disabled={!canEdit}
          className={`text-white text-sm font-medium px-4 py-2 rounded-lg ${
            canEdit 
              ? 'bg-green-700 hover:bg-green-600' 
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          + Registrar
        </button>
      </div>

      {/* Offline / sync banner */}
      {!isOnline && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <span>📴</span>
          <span>Você está offline. Os registros serão salvos localmente e sincronizados quando reconectar.</span>
        </div>
      )}
      {isOnline && pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-2">
          <span>📶 {pendingCount} tratamento{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''} para sincronizar</span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      )}

      {/* Period filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">De</label>
            <input
              type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Até</label>
            <input
              type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-500">Total no período</p>
            <p className="text-2xl font-bold text-green-700">{filtered.length} <span className="text-base font-medium">tratamentos</span></p>
          </div>
        </div>
      </div>

      {/* Animals table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : summary.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhum tratamento registrado no período</p>
          <p className="text-sm mt-1">Ajuste o período ou clique em &quot;+ Registrar&quot;</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Animal</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-right">Tratamentos</th>
                <th className="hidden sm:table-cell px-4 py-3 text-right">Último</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.map(({ animal, count, last }) => (
                <tr
                  key={animal.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setDetailAnimalId(animal.id)}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{animal.name}</td>
                  <td className="hidden sm:table-cell px-4 py-3 font-mono text-gray-500 text-xs">{animal.code}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">{count}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-right text-gray-500">{fmt(last)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Total Geral</td>
                <td className="px-4 py-3 text-right font-bold text-green-700">{filtered.length}</td>
                <td className="hidden sm:table-cell px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {detailAnimalId && detailAnimal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetailAnimalId(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{detailAnimal.name}</h2>
                  <p className="text-xs text-gray-500">Código: {detailAnimal.code}</p>
                </div>
                <button onClick={() => setDetailAnimalId(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>

              <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 mb-4 text-sm flex justify-between">
                <span className="text-gray-600">Tratamentos no período selecionado</span>
                <span className="font-bold text-green-700">{detailPeriodCount}</span>
              </div>

              <h3 className="text-sm font-semibold text-gray-700 mb-2">Histórico completo</h3>

              {detailTreatments.length === 0 ? (
                <p className="text-center py-6 text-gray-400 text-sm">Nenhum registro</p>
              ) : (
                <div className="space-y-3">
                  {detailTreatments.map((t) => (
                    <div key={t.id} className="border border-gray-100 rounded-xl p-4 hover:bg-gray-50 relative">
                      <button
                        onClick={() => handleDelete(t.id)}
                        disabled={!canEdit}
                        className={`absolute top-3 right-3 p-1 ${canEdit ? 'text-red-400 hover:text-red-600' : 'text-gray-300 cursor-not-allowed'}`}
                        title="Excluir"
                      >
                        <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                        </svg>
                      </button>

                      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm pr-6">
                        <div>
                          <p className="text-xs text-gray-500">Medicamento</p>
                          <p className="font-semibold text-gray-800">{t.medicine}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Período</p>
                          <p className="font-medium text-gray-700">
                            {fmt(t.startDate)}{t.endDate ? ` → ${fmt(t.endDate)}` : ''}
                          </p>
                        </div>
                        {t.manufacturer && (
                          <div>
                            <p className="text-xs text-gray-500">Fabricante</p>
                            <p className="text-gray-700">{t.manufacturer}</p>
                          </div>
                        )}
                        {t.batch && (
                          <div>
                            <p className="text-xs text-gray-500">Lote</p>
                            <p className="text-gray-700">{t.batch}</p>
                          </div>
                        )}
                        {t.description && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">Descrição</p>
                            <p className="text-gray-700">{t.description}</p>
                          </div>
                        )}
                        {t.observations && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">Observações</p>
                            <p className="text-gray-700">{t.observations}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Register modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Registrar Tratamento</h2>
                <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>

              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Animal *</label>
                  <select
                    value={form.animalId}
                    onChange={(e) => setForm({ ...form, animalId: e.target.value })}
                    required
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  >
                    <option value="">— Selecione —</option>
                    {allAnimals.map((a) => (
                      <option key={a.id} value={a.id}>{a.name} ({a.code})</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Data Início *</label>
                    <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Data Fim</label>
                    <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">Medicamento *</label>
                  <input type="text" value={form.medicine} onChange={(e) => setForm({ ...form, medicine: e.target.value })} required
                    placeholder="Ex: Amoxicilina"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Fabricante</label>
                    <input type="text" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                      placeholder="Ex: Laboratório X"
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Lote</label>
                    <input type="text" value={form.batch} onChange={(e) => setForm({ ...form, batch: e.target.value })}
                      placeholder="Ex: 123456"
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">Descrição</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                    placeholder="Descrição do tratamento"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none" />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">Observações</label>
                  <textarea value={form.observations} onChange={(e) => setForm({ ...form, observations: e.target.value })} rows={2}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none" />
                </div>

                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowRegister(false)}
                    className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">
                    Cancelar
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-medium py-2 rounded-lg">
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
