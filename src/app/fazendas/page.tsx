'use client'
import { PermissionGuard } from '@/components/PermissionGuard'

import { useEffect, useState } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { useUser } from '@/contexts/UserContext'
import { FARM_SEGMENTS } from '@/lib/farmSegments'
import { PENDING_MESSAGE, hasPendingOnDevice, reloadInFarm, switchFarm } from '@/lib/farmSwitch'

interface Farm {
  id: string
  name: string
  propertyType?: string
  documentType?: string
  documentNumber?: string
  owner?: string
  phone?: string
  address?: string
  city?: string
  state?: string
  isActive?: boolean
  segments?: string[]
}

const EMPTY = {
  name: '',
  propertyType: 'Fazenda',
  documentType: 'CNPJ',
  documentNumber: '',
  owner: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  segments: [] as string[],
}

const typeColor: Record<string, string> = {
  Fazenda: 'bg-green-100 text-green-700',
  Sítio:   'bg-amber-100 text-amber-700',
}

export default function PropriedadesPage() {
  const { confirm, notify } = useDialog()
  const { user, refresh } = useUser()
  const canManage = user?.role === 'admin' || user?.role === 'editor'
  const [editingId, setEditingId] = useState<string | null>(null)
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

  const isAdmin = user?.role === 'admin'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Propriedade nova já abre: com anotações pendentes no celular, elas iriam para a propriedade errada
    if (!editingId && !isAdmin && hasPendingOnDevice()) { setError(PENDING_MESSAGE); return }
    setSaving(true)
    setError('')

    try {
    const res = await fetch(editingId ? `/api/farms/${editingId}` : '/api/farms', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()

    if (!res.ok) { setError(data.error || 'Erro ao salvar'); setSaving(false); return }

    // O produtor que cadastra outra propriedade passa a usar a nova
    if (!editingId && !isAdmin) return reloadInFarm()
    setSaving(false)
    setShowForm(false)
    setForm(EMPTY)
    setEditingId(null)
    refresh()
    fetchFarms()
    } catch {
      setError('Não foi possível salvar. Verifique sua conexão e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(farm: Farm) {
    setEditingId(farm.id)
    setForm(Object.fromEntries(Object.entries(EMPTY).map(([key, fallback]) => [key, farm[key as keyof Farm] ?? fallback])) as typeof EMPTY)
    setError('')
    setShowForm(true)
  }

  async function openFarm(farmId: string) {
    const failure = await switchFarm(farmId)
    if (failure) await notify('Não foi possível abrir', failure)
  }

  async function handleDelete(farmId: string) {
    if (!(await confirm({ title: 'Excluir esta propriedade?', message: 'Se ela já tiver registros, será apenas desativada e nada se perde.', confirmLabel: 'Excluir', danger: true }))) return
    setDeleting(farmId)
    
    const res = await fetch(`/api/farms/${farmId}/delete`, { method: 'DELETE' })
    const data = await res.json()
    
    setDeleting(null)
    if (!res.ok) {
      await notify('Não foi possível excluir', data.error)
      return
    }
    
    await notify(data.action === 'inactivated' ? 'Propriedade desativada' : 'Propriedade excluída')
    // Se era a propriedade aberta, o servidor já abriu outra
    if (!isAdmin && farmId === user?.farmId) return reloadInFarm()
    refresh()
    fetchFarms()
  }

  return (
    <PermissionGuard module="fazendas">
      <div>
      <div className="page-toolbar flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Propriedades</h1>
        <button
          onClick={() => { setEditingId(null); setForm(EMPTY); setShowForm(true); setError('') }}
          disabled={!canManage}
          className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
        >
          Cadastrar propriedade
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : farms.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhuma propriedade cadastrada</p>
          <p className="text-sm mt-1">Clique em &quot;Cadastrar propriedade&quot; para começar</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {farms.filter(f => f.isActive !== false).map((f) => (
            <div key={f.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 relative">
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-bold text-gray-800 text-lg leading-tight">{f.name}</h2>
                <div className="flex items-center gap-2 shrink-0">
                  {f.propertyType && (
                    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${typeColor[f.propertyType] ?? 'bg-gray-100 text-gray-600'}`}>
                      {f.propertyType}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(f.id)}
                    disabled={!canManage || deleting === f.id}
                    className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                    title="Excluir propriedade"
                    aria-label={`Excluir propriedade ${f.name}`}
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
              {!!f.segments?.length && (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {FARM_SEGMENTS.filter((s) => f.segments!.includes(s.key)).map((s) => (
                    <span key={s.key} className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-800">{s.label}</span>
                  ))}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                {!isAdmin && (f.id === user?.farmId
                  ? <span className="text-sm font-semibold text-gray-500">Aberta agora</span>
                  : <button type="button" onClick={() => void openFarm(f.id)} className="text-sm font-semibold text-green-700 hover:underline">Abrir esta propriedade</button>)}
                {canManage && <button type="button" onClick={() => handleEdit(f)} className="text-sm font-medium text-green-700 hover:underline" aria-label={`Editar propriedade ${f.name}`}>Editar cadastro</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="farm-form-title" className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 id="farm-form-title" className="text-lg font-bold text-gray-800 mb-4">{editingId ? 'Editar propriedade' : 'Cadastrar propriedade'}</h2>

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

                <fieldset>
                  <legend className="text-xs font-medium text-gray-600">O que a propriedade faz? (pode marcar mais de um)</legend>
                  <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {FARM_SEGMENTS.map((seg) => {
                      const on = form.segments.includes(seg.key)
                      return (
                        <button key={seg.key} type="button" aria-pressed={on}
                          onClick={() => setForm({ ...form, segments: on ? form.segments.filter((k) => k !== seg.key) : [...form.segments, seg.key] })}
                          className={`py-2 rounded-lg text-sm font-medium border transition-colors ${on ? 'bg-green-700 border-green-700 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {seg.label}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-gray-600">Documento (CPF/CNPJ)</label>
                    <input
                      value={form.documentNumber}
                      onChange={(e) => setForm({ ...form, documentNumber: e.target.value })}
                      placeholder="000.000.000-00"
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Telefone</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    disabled={saving}
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
