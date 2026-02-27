'use client'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'
import { getPendingRecords, addPendingRecord, removePendingRecord } from '@/lib/offlineStorage'

import { useEffect, useState, useMemo } from 'react'

interface Animal {
  id: string
  name: string
  code: string
}

interface Production {
  id: string
  animalId: string
  date: string
  quantity: number
  observations?: string | null
  animal: Animal
}

export default function MilkProductionPage() {
  const { user } = useUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const now = new Date()
  const [productions, setProductions] = useState<Production[]>([])
  const [allAnimals, setAllAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [farmId, setFarmId] = useState('')
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10))
  const [detailAnimalId, setDetailAnimalId] = useState<string | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const [formAnimalId, setFormAnimalId] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formQty, setFormQty] = useState('')
  const [formObs, setFormObs] = useState('')
  const [saving, setSaving] = useState(false)
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setPendingCount(getPendingRecords('milk_productions').length)
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
      fetch(`/api/milk-production?farmId=${fid}`).then((r) => r.json()),
      fetch(`/api/animals?farmId=${fid}`).then((r) => r.json()),
    ]).then(([prods, animals]) => {
      setProductions(Array.isArray(prods) ? prods : [])
      setAllAnimals(
        Array.isArray(animals)
          ? animals.filter(
              (a: Animal & { species: string; gender: string }) =>
                a.species.toLowerCase() === 'vaca' && a.gender.toLowerCase() === 'fêmea'
            )
          : []
      )
      setLoading(false)
    })
  }

  const filtered = useMemo(() => {
    return productions.filter((p) => {
      const d = new Date(p.date)
      if (from && d < new Date(from)) return false
      if (to && d > new Date(to + 'T23:59:59')) return false
      return true
    })
  }, [productions, from, to])

  const summary = useMemo(() => {
    const map = new Map<string, { animal: Animal; total: number; count: number }>()
    for (const p of filtered) {
      const s = map.get(p.animalId)
      if (s) { s.total += p.quantity; s.count++ }
      else map.set(p.animalId, { animal: p.animal, total: p.quantity, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [filtered])

  const grandTotal = summary.reduce((s, a) => s + a.total, 0)

  const detailAnimal = detailAnimalId
    ? productions.find((p) => p.animalId === detailAnimalId)?.animal ?? null
    : null

  const detailProductions = useMemo(() => {
    if (!detailAnimalId) return []
    return [...productions.filter((p) => p.animalId === detailAnimalId)].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [productions, detailAnimalId])

  const detailPeriodTotal = filtered
    .filter((p) => p.animalId === detailAnimalId)
    .reduce((s, p) => s + p.quantity, 0)

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (!confirm('Excluir este registro?')) return
    await fetch(`/api/milk-production/${id}`, { method: 'DELETE' })
    loadData(farmId)
  }

  async function handleSync() {
    const pending = getPendingRecords('milk_productions')
    if (!pending.length) return
    setSyncing(true)
    for (const record of pending) {
      try {
        const pendingId = record._pendingId
        const res = await fetch('/api/milk-production', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ animalId: record.animalId, date: record.date, quantity: record.quantity, observations: record.observations }),
        })
        if (res.ok) removePendingRecord('milk_productions', pendingId)
      } catch {
        // keep record for next sync attempt
      }
    }
    setPendingCount(getPendingRecords('milk_productions').length)
    setSyncing(false)
    if (farmId) loadData(farmId)
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!isOnline) {
      const count = addPendingRecord('milk_productions', { animalId: formAnimalId, date: formDate, quantity: formQty, observations: formObs })
      setPendingCount(count)
      setShowRegister(false)
      setFormAnimalId(''); setFormDate(''); setFormQty(''); setFormObs('')
      return
    }
    setSaving(true)
    await fetch('/api/milk-production', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ animalId: formAnimalId, date: formDate, quantity: formQty, observations: formObs }),
    })
    setSaving(false)
    setShowRegister(false)
    setFormAnimalId('')
    setFormDate('')
    setFormQty('')
    setFormObs('')
    loadData(farmId)
  }

  return (
    <PermissionGuard module="leite">
      <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Produção de Leite</h1>
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
          <span>📶 {pendingCount} registro{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''} para sincronizar</span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      )}

      {/* Period filter + total */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">De</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Até</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div className="ml-auto text-right">
            <p className="text-xs text-gray-500">Total no período</p>
            <p className="text-2xl font-bold text-green-700">{grandTotal.toFixed(1)} L</p>
          </div>
        </div>
      </div>

      {/* Animals table */}
      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : summary.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhuma produção registrada no período</p>
          <p className="text-sm mt-1">Ajuste o período ou clique em &quot;+ Registrar&quot;</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Animal</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-right">Total (L)</th>
                <th className="hidden sm:table-cell px-4 py-3 text-right">Registros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.map(({ animal, total, count }) => (
                <tr
                  key={animal.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setDetailAnimalId(animal.id)}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{animal.name}</td>
                  <td className="hidden sm:table-cell px-4 py-3 font-mono text-gray-500 text-xs">{animal.code}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">{total.toFixed(1)}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-right text-gray-500">{count}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Total Geral</td>
                <td className="px-4 py-3 text-right font-bold text-green-700">{grandTotal.toFixed(1)}</td>
                <td className="hidden sm:table-cell px-4 py-3 text-right font-bold text-gray-600">{filtered.length}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {detailAnimalId && detailAnimal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setDetailAnimalId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{detailAnimal.name}</h2>
                  <p className="text-xs text-gray-500">Código: {detailAnimal.code}</p>
                </div>
                <button onClick={() => setDetailAnimalId(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>

              <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 mb-4 text-sm flex justify-between">
                <span className="text-gray-600">Total no período selecionado</span>
                <span className="font-bold text-green-700">{detailPeriodTotal.toFixed(1)} L</span>
              </div>

              <h3 className="text-sm font-semibold text-gray-700 mb-2">Histórico completo</h3>
              <div className="rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Data</th>
                      <th className="px-4 py-2 text-right">Qtd (L)</th>
                      <th className="hidden sm:table-cell px-4 py-2 text-left">Observações</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detailProductions.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700">
                          {new Date(p.date).toLocaleDateString('pt-BR')}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-gray-800">{p.quantity.toFixed(1)}</td>
                        <td className="hidden sm:table-cell px-4 py-2 text-gray-500 text-xs">{p.observations || '—'}</td>
                        <td className="px-4 py-2 text-right">
                          <button
                            onClick={() => handleDelete(p.id)}
                            disabled={!canEdit}
                            className={`p-1 ${canEdit ? 'text-red-400 hover:text-red-600' : 'text-gray-300 cursor-not-allowed'}`}
                            title="Excluir"
                          >
                            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detailProductions.length === 0 && (
                  <p className="text-center py-6 text-gray-400 text-sm">Nenhum registro</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register modal */}
      {showRegister && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          onClick={() => setShowRegister(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Registrar Produção</h2>
                <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>

              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Vaca *</label>
                  <select
                    value={formAnimalId}
                    onChange={(e) => setFormAnimalId(e.target.value)}
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
                    <label className="text-xs font-medium text-gray-600">Data *</label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Quantidade (L) *</label>
                    <input
                      type="number"
                      value={formQty}
                      onChange={(e) => setFormQty(e.target.value)}
                      step="0.1"
                      min="0"
                      required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">Observações</label>
                  <textarea
                    value={formObs}
                    onChange={(e) => setFormObs(e.target.value)}
                    rows={2}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRegister(false)}
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
