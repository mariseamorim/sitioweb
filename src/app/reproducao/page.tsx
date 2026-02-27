'use client'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'

import { useEffect, useState, useMemo } from 'react'
import { getPendingRecords, addPendingRecord, clearPendingRecords } from '@/lib/offlineStorage'

interface Animal { id: string; name: string; code: string; species: string; gender: string }

interface Reproduction {
  id: string
  femaleId: string
  female: Animal
  maleName?: string | null
  coverageDate: string
  expectedBirthDate?: string | null
  actualBirthDate?: string | null
  status: string
  calfId?: string | null
  observations?: string | null
}

const STATUS_LIST = ['Coberta', 'Prenha', 'Parida', 'Vazia', 'Perdida']
const STATUS_COLOR: Record<string, string> = {
  Coberta: 'bg-blue-100 text-blue-700',
  Prenha: 'bg-purple-100 text-purple-700',
  Parida: 'bg-green-100 text-green-700',
  Vazia: 'bg-gray-100 text-gray-600',
  Perdida: 'bg-red-100 text-red-700',
}

export default function ReproducaoPage() {
  const { user } = useUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const [reproductions, setReproductions] = useState<Reproduction[]>([])
  const [females, setFemales] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [farmId, setFarmId] = useState('')
  const [filterStatus, setFilterStatus] = useState('Todas')
  const [detail, setDetail] = useState<Reproduction | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ femaleId: '', maleName: '', coverageDate: '', status: 'Coberta', observations: '' })
  const [editStatus, setEditStatus] = useState('')
  const [editBirthDate, setEditBirthDate] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setPendingCount(getPendingRecords('reproducao').length)
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
      getPendingRecords('reproducao')
        .filter(r => r.farmId === fid && r._type === 'create')
        .map(r => ({
          id: `pending_${r._pendingId}`,
          femaleId: r.femaleId,
          female: r.female || { id: r.femaleId, name: '(Offline)', code: '', species: '', gender: 'Fêmea' },
          maleName: r.maleName ?? null,
          coverageDate: r.coverageDate,
          expectedBirthDate: r.expectedBirthDate ?? null,
          actualBirthDate: r.actualBirthDate ?? null,
          status: r.status,
          calfId: r.calfId ?? null,
          observations: r.observations ?? null,
        }))

    // If offline, load only pending records
    if (!navigator.onLine) {
      const pending = mapPending()
      setReproductions(pending)
      setFemales(pending.map(p => p.female))
      setLoading(false)
      return
    }
    
    Promise.all([
      fetch(`/api/reproducao?farmId=${fid}`).then(r => r.json()).catch(() => []),
      fetch(`/api/animals?farmId=${fid}`).then(r => r.json()).catch(() => []),
    ]).then(([repros, anims]) => {
      const pending = mapPending()
      setReproductions(Array.isArray(repros) ? [...repros, ...pending] : pending)
      setFemales(Array.isArray(anims) ? anims.filter((a: Animal) => a.gender === 'Fêmea') : [])
      setLoading(false)
    }).catch(() => {
      const pending = mapPending()
      setReproductions(pending)
      setFemales(pending.map(p => p.female))
      setLoading(false)
    })
  }

  const filtered = useMemo(() => {
    if (filterStatus === 'Todas') return reproductions
    return reproductions.filter(r => r.status === filterStatus)
  }, [reproductions, filterStatus])

  const upcomingBirths = useMemo(() => {
    const in30 = new Date(); in30.setDate(in30.getDate() + 30)
    return reproductions.filter(r => r.expectedBirthDate && !r.actualBirthDate && new Date(r.expectedBirthDate) <= in30).length
  }, [reproductions])

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (!confirm('Excluir este registro?')) return
    await fetch(`/api/reproducao/${id}`, { method: 'DELETE' })
    setDetail(null)
    loadData(farmId)
  }

  async function handleSync() {
    const pending = getPendingRecords('reproducao')
    if (!pending.length) return
    setSyncing(true)
    for (const record of pending) {
      const { _pendingId, _type, farmId: _, ...data } = record
      await fetch('/api/reproducao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, farmId }),
      })
    }
    clearPendingRecords('reproducao')
    setPendingCount(0)
    setSyncing(false)
    loadData(farmId)
  }

  async function handleUpdateStatus() {
    if (!detail) return
    await fetch(`/api/reproducao/${detail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: editStatus || detail.status, actualBirthDate: editBirthDate || null }),
    })
    setDetail(null)
    setEditStatus('')
    setEditBirthDate('')
    loadData(farmId)
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    // Se estiver offline, salva no localStorage
    if (!isOnline) {
      const female = females.find(f => f.id === form.femaleId)
      addPendingRecord('reproducao', {
        ...form,
        farmId,
        maleName: form.maleName || null,
        observations: form.observations || null,
        female: female || undefined,
      })
      setPendingCount(getPendingRecords('reproducao').length)
      setSaving(false)
      setShowRegister(false)
      setForm({ femaleId: '', maleName: '', coverageDate: '', status: 'Coberta', observations: '' })
      return
    }

    // Se estiver online, envia para API
    await fetch('/api/reproducao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, farmId, maleName: form.maleName || null, observations: form.observations || null }),
    })
    setSaving(false)
    setShowRegister(false)
    setForm({ femaleId: '', maleName: '', coverageDate: '', status: 'Coberta', observations: '' })
    loadData(farmId)
  }

  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR')

  return (
    <PermissionGuard module="reproducao">
      <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reprodução</h1>
          <p className="text-gray-500 text-sm mt-1">Coberturas, prenhez e partos</p>
        </div>
        <button onClick={() => setShowRegister(true)} disabled={!canEdit} className={`text-white text-sm font-medium px-4 py-2 rounded-lg ${canEdit ? 'bg-green-700 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'}`}>
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
          <span>📶 {pendingCount} reprodução{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''} para sincronizar</span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      )}      </div>

      {upcomingBirths > 0 && (
        <div className="bg-purple-50 border border-purple-200 text-purple-800 rounded-xl px-4 py-3 mb-6 text-sm flex items-center gap-2">
          <span className="text-base">🐄</span>
          <span><strong>{upcomingBirths}</strong> parto{upcomingBirths > 1 ? 's' : ''} esperado{upcomingBirths > 1 ? 's' : ''} nos próximos 30 dias</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-4">
        {(['Todas', ...STATUS_LIST]).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? 'bg-green-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s}
          </button>
        ))}
      </div>

      {loading ? <p className="text-gray-400 text-sm">Carregando...</p> : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhum registro encontrado</p>
          <p className="text-sm mt-1">Clique em &quot;+ Registrar&quot; para começar</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Fêmea</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left">Reprodutor</th>
                <th className="px-4 py-3 text-left">Cobertura</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left">Parto Esperado</th>
                <th className="px-4 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setDetail(r); setEditStatus(r.status); setEditBirthDate(r.actualBirthDate?.slice(0, 10) || '') }}>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.female.name}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-gray-600">{r.maleName || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{fmt(r.coverageDate)}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-gray-600">{r.expectedBirthDate ? fmt(r.expectedBirthDate) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[r.status] || 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{detail.female.name}</h2>
                  <p className="text-xs text-gray-500">Cobertura: {fmt(detail.coverageDate)}</p>
                </div>
                <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                <div><p className="text-xs text-gray-500">Reprodutor</p><p className="font-medium text-gray-800">{detail.maleName || '—'}</p></div>
                <div><p className="text-xs text-gray-500">Parto Esperado</p><p className="font-medium text-gray-800">{detail.expectedBirthDate ? fmt(detail.expectedBirthDate) : '—'}</p></div>
                {detail.actualBirthDate && <div><p className="text-xs text-gray-500">Parto Real</p><p className="font-medium text-green-700">{fmt(detail.actualBirthDate)}</p></div>}
                {detail.observations && <div className="col-span-2"><p className="text-xs text-gray-500">Observações</p><p className="text-gray-700">{detail.observations}</p></div>}
              </div>

              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-xs font-semibold text-gray-600 mb-2">Atualizar status</p>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-green-600">
                  {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
                </select>
                {editStatus === 'Parida' && (
                  <div>
                    <label className="text-xs text-gray-600">Data do Parto</label>
                    <input type="date" value={editBirthDate} onChange={e => setEditBirthDate(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={handleUpdateStatus} className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-medium py-2 rounded-lg">Salvar</button>
                <button onClick={() => handleDelete(detail.id)} className="flex-1 border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium py-2 rounded-lg">Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Registrar Cobertura</h2>
                <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>
              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Fêmea *</label>
                  <select value={form.femaleId} onChange={e => setForm({ ...form, femaleId: e.target.value })} required
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                    <option value="">— Selecione —</option>
                    {females.map(a => <option key={a.id} value={a.id}>{a.name} ({a.code}) — {a.species}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Reprodutor</label>
                  <input type="text" value={form.maleName} onChange={e => setForm({ ...form, maleName: e.target.value })} placeholder="Nome ou código do touro"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Data Cobertura *</label>
                    <input type="date" value={form.coverageDate} onChange={e => setForm({ ...form, coverageDate: e.target.value })} required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                      {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
                    </select>
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
    </PermissionGuard>
  )
}
