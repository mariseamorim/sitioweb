'use client'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'

import { useEffect, useState } from 'react'
import { getPendingRecords, addPendingRecord, clearPendingRecords } from '@/lib/offlineStorage'

interface SupplyMovement { id: string; type: string; quantity: number; date: string; description?: string | null }
interface Supply {
  id: string
  name: string
  category: string
  unit: string
  currentQuantity: number
  minimumQuantity: number
  movements: SupplyMovement[]
}

const CATEGORIES = ['Ração', 'Medicamento', 'Vacina', 'Outro']

export default function EstoquePage() {
  const { user } = useUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [loading, setLoading] = useState(true)
  const [farmId, setFarmId] = useState('')
  const [detail, setDetail] = useState<Supply | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showMov, setShowMov] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'Ração', unit: 'kg', currentQuantity: '', minimumQuantity: '' })
  const [mov, setMov] = useState({ type: 'Entrada', quantity: '', date: new Date().toISOString().slice(0, 10), description: '' })
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setPendingCount(getPendingRecords('estoque').length)
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
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!data.farmId) return
      setFarmId(data.farmId)
      loadData(data.farmId)
    })
  }, [])

  function loadData(fid: string) {
    setLoading(true)
    const mapPending = () =>
      getPendingRecords('estoque')
        .filter(r => r.farmId === fid && r._type === 'create')
        .map(r => ({
          id: `pending_${r._pendingId}`,
          name: r.name,
          category: r.category,
          unit: r.unit,
          currentQuantity: Number(r.currentQuantity ?? 0),
          minimumQuantity: Number(r.minimumQuantity ?? 0),
          movements: [],
        }))

    // If offline, load only pending records
    if (!navigator.onLine) {
      const pending = mapPending()
      setSupplies(pending)
      setLoading(false)
      return
    }
    
    fetch(`/api/estoque?farmId=${fid}`)
      .then(r => r.json())
      .then(data => {
        const pending = mapPending()
        setSupplies(Array.isArray(data) ? [...data, ...pending] : pending)
        setLoading(false)
      })
      .catch(() => {
        const pending = mapPending()
        setSupplies(pending)
        setLoading(false)
      })
  }

  const alertCount = supplies.filter(s => s.currentQuantity <= s.minimumQuantity).length

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (!confirm('Excluir este insumo e todo seu histórico?')) return
    await fetch(`/api/estoque/${id}`, { method: 'DELETE' })
    setDetail(null)
    loadData(farmId)
  }

  async function handleSync() {
    const pending = getPendingRecords('estoque')
    if (!pending.length) return
    setSyncing(true)
    for (const record of pending) {
      const { _pendingId, _type, farmId: _, ...data } = record
      await fetch('/api/estoque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, farmId }),
      })
    }
    clearPendingRecords('estoque')
    setPendingCount(0)
    setSyncing(false)
    loadData(farmId)
  }

  async function handleSaveNew(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    // Se estiver offline, salva no localStorage
    if (!isOnline) {
      addPendingRecord('estoque', { ...form, farmId })
      setPendingCount(getPendingRecords('estoque').length)
      setSaving(false)
      setShowNew(false)
      setForm({ name: '', category: 'Ração', unit: 'kg', currentQuantity: '', minimumQuantity: '' })
      return
    }

    // Se estiver online, envia para API
    await fetch('/api/estoque', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, farmId }),
    })
    setSaving(false)
    setShowNew(false)
    setForm({ name: '', category: 'Ração', unit: 'kg', currentQuantity: '', minimumQuantity: '' })
    loadData(farmId)
  }

  async function handleMovimentacao(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!detail) return
    setSaving(true)
    const res = await fetch(`/api/estoque/${detail.id}/movimentacao`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...mov, description: mov.description || null }),
    })
    const data = await res.json()
    setSaving(false)
    setShowMov(false)
    setMov({ type: 'Entrada', quantity: '', date: new Date().toISOString().slice(0, 10), description: '' })
    if (data.supply) {
      setDetail(data.supply)
      setSupplies(prev => prev.map(s => s.id === data.supply.id ? data.supply : s))
    }
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR')

  const isLow = (s: Supply) => s.currentQuantity <= s.minimumQuantity

  return (
    <PermissionGuard module="estoque">
      <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Estoque</h1>
          <p className="text-gray-500 text-sm mt-1">Insumos, medicamentos e vacinas</p>
        </div>
        <button onClick={() => setShowNew(true)} disabled={!canEdit} className={`text-white text-sm font-medium px-4 py-2 rounded-lg ${canEdit ? 'bg-green-700 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'}`}>
          + Novo Insumo
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
          <span>📶 {pendingCount} insumo{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''} para sincronizar</span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      )}

      {alertCount > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 mb-6 text-sm flex items-center gap-2">
          <span className="text-base">⚠️</span>
          <span><strong>{alertCount}</strong> insumo{alertCount > 1 ? 's' : ''} abaixo do estoque mínimo</span>
        </div>
      )}

      {loading ? <p className="text-gray-400 text-sm">Carregando...</p> : supplies.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhum insumo cadastrado</p>
          <p className="text-sm mt-1">Clique em &quot;+ Novo Insumo&quot; para começar</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Insumo</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left">Categoria</th>
                <th className="px-4 py-3 text-right">Atual</th>
                <th className="hidden sm:table-cell px-4 py-3 text-right">Mínimo</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {supplies.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 cursor-pointer ${isLow(s) ? 'bg-red-50/40' : ''}`} onClick={() => setDetail(s)}>
                  <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-gray-500">{s.category}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${isLow(s) ? 'text-red-600' : 'text-gray-800'}`}>
                    {s.currentQuantity} {s.unit}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-right text-gray-500">{s.minimumQuantity} {s.unit}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${isLow(s) ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                      {isLow(s) ? 'Baixo' : 'OK'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{detail.name}</h2>
                  <p className="text-xs text-gray-500">{detail.category} · {detail.unit}</p>
                </div>
                <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className={`rounded-lg p-3 ${isLow(detail) ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
                  <p className="text-xs text-gray-500">Quantidade Atual</p>
                  <p className={`text-xl font-bold ${isLow(detail) ? 'text-red-600' : 'text-green-700'}`}>{detail.currentQuantity} {detail.unit}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-500">Mínimo</p>
                  <p className="text-xl font-bold text-gray-700">{detail.minimumQuantity} {detail.unit}</p>
                </div>
              </div>

              <button onClick={() => setShowMov(true)} className="w-full bg-green-700 hover:bg-green-600 text-white text-sm font-medium py-2 rounded-lg mb-4">
                + Movimentação (Entrada / Saída)
              </button>

              {detail.movements.length > 0 && (
                <>
                  <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Últimas movimentações</h3>
                  <div className="rounded-xl border border-gray-100 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Data</th>
                          <th className="px-3 py-2 text-left">Tipo</th>
                          <th className="px-3 py-2 text-right">Qtd</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {detail.movements.map(m => (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-600">{fmt(m.date)}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs font-medium ${m.type === 'Entrada' ? 'text-green-600' : 'text-red-500'}`}>{m.type}</span>
                            </td>
                            <td className={`px-3 py-2 text-right font-medium ${m.type === 'Entrada' ? 'text-green-600' : 'text-red-500'}`}>
                              {m.type === 'Entrada' ? '+' : '-'}{m.quantity} {detail.unit}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              <button onClick={() => handleDelete(detail.id)} className="mt-4 w-full border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium py-2 rounded-lg">
                Excluir Insumo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Movimentação modal */}
      {showMov && detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4" onClick={() => setShowMov(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Movimentação</h2>
                <button onClick={() => setShowMov(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>
              <form onSubmit={handleMovimentacao} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Tipo *</label>
                    <select value={mov.type} onChange={e => setMov({ ...mov, type: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                      <option>Entrada</option>
                      <option>Saída</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Quantidade *</label>
                    <input type="number" value={mov.quantity} onChange={e => setMov({ ...mov, quantity: e.target.value })} step="0.01" min="0" required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Data *</label>
                  <input type="date" value={mov.date} onChange={e => setMov({ ...mov, date: e.target.value })} required
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Descrição</label>
                  <input type="text" value={mov.description} onChange={e => setMov({ ...mov, description: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowMov(false)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-medium py-2 rounded-lg">{saving ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* New supply modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowNew(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Novo Insumo</h2>
                <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>
              <form onSubmit={handleSaveNew} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Nome *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Ex: Ração Bovinos"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Categoria *</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Unidade *</label>
                    <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                      {['kg', 'L', 'unidades', 'doses', 'sacos'].map(u => <option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Qtd Inicial</label>
                    <input type="number" value={form.currentQuantity} onChange={e => setForm({ ...form, currentQuantity: e.target.value })} step="0.01" min="0"
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Qtd Mínima</label>
                    <input type="number" value={form.minimumQuantity} onChange={e => setForm({ ...form, minimumQuantity: e.target.value })} step="0.01" min="0"
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowNew(false)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-medium py-2 rounded-lg">{saving ? 'Salvando...' : 'Salvar'}</button>
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
