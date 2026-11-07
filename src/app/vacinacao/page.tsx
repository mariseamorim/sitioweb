'use client'
import { AnimalPicker } from '@/components/AnimalPicker'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'
import { animalSearchText } from '@/lib/animalCode'
import { useSort } from '@/lib/useSort'
import { SortTh } from '@/components/SortTh'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { removePendingRecord, type OfflineRecord } from '@/lib/offlineStorage'
import { cachedGet, isPendingId, pendingIdOf, pendingItemId, pendingOf, sendOrQueue, updatePending, withPending, type PendingRequest, type QueuedRequest } from '@/lib/offlineData'
import { useOfflineModule } from '@/lib/useOffline'
import { loadHerd } from '@/lib/herdCache'
import { useDialog } from '@/components/DialogProvider'
import { todayISO } from '@/lib/utils'
import { SemSinalIcon, SincronizarIcon, AlertaIcon, FecharIcon } from '@/components/ModuleIcons'
import { QuickFilterChip, useQuickFilter } from '@/components/QuickFilter'

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

const MODULE = 'vacinacao'
const EMPTY_FORM = { animalId: '', vaccineName: '', scheduledDate: todayISO(), appliedDate: '', batch: '', manufacturer: '', observations: '' }

/** Vacinação guardada sem internet, como aparece na lista. Registros antigos da fila têm os campos soltos, sem _body. */
function pendingVaccination(p: PendingRequest, animals: Animal[]): Vaccination | null {
  if (p._type !== 'create') return null
  const b = (p._body ?? p) as Record<string, string | null | undefined>
  const animal = (p.animal as Animal | undefined) ?? animals.find(a => a.id === b.animalId) ?? { id: b.animalId ?? '', name: '(sem internet)', code: '' }
  return {
    id: pendingItemId(p), animalId: b.animalId ?? '', animal, vaccineName: b.vaccineName ?? '', scheduledDate: b.scheduledDate ?? '',
    appliedDate: b.appliedDate ?? null, batch: b.batch ?? null, manufacturer: b.manufacturer ?? null, observations: b.observations ?? null,
  }
}

/** Fila antiga (antes de cada pedido levar a própria URL): era sempre um POST com os campos soltos */
const legacyRequest = (r: OfflineRecord): QueuedRequest => {
  const data = Object.fromEntries(Object.entries(r).filter(([k]) => !['_pendingId', '_type', 'animal'].includes(k)))
  return { url: '/api/vacinacao', method: 'POST', body: data }
}

export default function VacinacaoPage() {
  const { confirm } = useDialog()
  const { user } = useUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const farmId = user?.farmId ?? ''
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([])
  const [animals, setAnimals] = useState<Animal[]>([])
  const [animalSearch, setAnimalSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [notice, setNotice] = useState('')
  const [saveError, setSaveError] = useState('')
  const [filter, setFilter] = useState<VaccStatus>('Todas')
  const [quick, setQuick] = useQuickFilter(['pendentes'] as const)
  const [detail, setDetail] = useState<Vaccination | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  // Lista e rebanho com cópia no aparelho; a fila (criadas, aplicadas e excluídas sem internet) entra por cima
  const loadData = useCallback(async (fid: string) => {
    const [vaccs, herd] = await Promise.all([
      cachedGet<Vaccination[]>(`cache_vacinacao_${fid}`, `/api/vacinacao?farmId=${fid}`).catch(() => null),
      loadHerd<Animal>(fid).catch(() => null),
    ])
    const anims = Array.isArray(herd?.data) ? herd.data : []
    const list = Array.isArray(vaccs?.data) ? vaccs.data : []
    setAnimals(anims)
    setVaccinations(withPending(list, pendingOf(MODULE, p => p.farmId === fid), p => pendingVaccination(p, anims)))
    setFromCache(!!(vaccs?.fromCache || herd?.fromCache))
    setLoading(false)
  }, [])
  const reload = useCallback(() => { if (farmId) void loadData(farmId) }, [farmId, loadData])
  const net = useOfflineModule(MODULE, reload, legacyRequest)
  useEffect(() => { void Promise.resolve().then(reload) }, [reload])

  const filtered = useMemo(() => {
    const term = animalSearch.trim().toLowerCase()
    const in7 = new Date(); in7.setDate(in7.getDate() + 7)
    const dueSoon = (v: Vaccination) => !v.appliedDate && new Date(v.scheduledDate) <= in7
    return vaccinations.filter(v => (quick ? dueSoon(v) : filter === 'Todas' || getStatus(v) === filter) && animalSearchText(v.animal).includes(term))
  }, [vaccinations, filter, animalSearch, quick])
  const { rows: sortedVaccinations, sort } = useSort(filtered, {
    animal: v => v.animal.name, vaccine: v => v.vaccineName, scheduled: v => new Date(v.scheduledDate),
    applied: v => (v.appliedDate ? new Date(v.appliedDate) : null), status: v => getStatus(v),
  })

  const alertCount = useMemo(() => {
    const in7 = new Date(); in7.setDate(in7.getDate() + 7)
    return vaccinations.filter(v => !v.appliedDate && new Date(v.scheduledDate) <= in7).length
  }, [vaccinations])

  // Depois de guardar ou enviar: a lista mostra na hora e a barra do topo atualiza a contagem
  const afterChange = (queued: boolean) => {
    setNotice(queued ? net.queuedMessage : '')
    net.refresh()
    reload()
  }

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (!(await confirm({ title: 'Excluir esta vacinação?', confirmLabel: 'Excluir', danger: true }))) return
    setDetail(null)
    if (isPendingId(id)) {
      // Ainda não foi enviada: sai da fila do aparelho
      removePendingRecord(MODULE, pendingIdOf(id))
      return afterChange(false)
    }
    const r = await sendOrQueue(MODULE, { type: 'delete', id, url: `/api/vacinacao/${id}`, method: 'DELETE', local: { farmId } })
    if (r.status === 'rejected') setNotice(r.error)
    else afterChange(r.status === 'queued')
  }

  async function handleApply(v: Vaccination) {
    const today = todayISO()
    setDetail(null)
    if (isPendingId(v.id)) {
      // Ainda na fila: a data de aplicação vai junto quando for enviada
      updatePending(MODULE, pendingIdOf(v.id), p => (p._body ? { ...p, _body: { ...(p._body as object), appliedDate: today } } : { ...p, appliedDate: today }))
      return afterChange(true)
    }
    const body = { animalId: v.animalId, vaccineName: v.vaccineName, scheduledDate: v.scheduledDate, appliedDate: today, batch: v.batch ?? null, manufacturer: v.manufacturer ?? null, observations: v.observations ?? null }
    const r = await sendOrQueue(MODULE, { type: 'update', id: v.id, url: `/api/vacinacao/${v.id}`, method: 'PUT', body, local: { farmId } })
    if (r.status === 'rejected') setNotice(r.error)
    else afterChange(r.status === 'queued')
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    const body = { ...form, appliedDate: form.appliedDate || null, batch: form.batch || null, manufacturer: form.manufacturer || null, observations: form.observations || null, farmId }
    const animal = animals.find(a => a.id === form.animalId)
    const r = await sendOrQueue(MODULE, { type: 'create', url: '/api/vacinacao', method: 'POST', body, local: { farmId, animal } })
    setSaving(false)
    if (r.status === 'rejected') return setSaveError(r.error)
    setShowRegister(false)
    setForm(EMPTY_FORM)
    afterChange(r.status === 'queued')
  }

  // Datas gravadas à meia-noite UTC: mostrar em UTC para não cair no dia anterior no horário de Brasília
  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

  return (
    <PermissionGuard module="vacinacao">
      <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vacinação</h1>
          <p className="text-gray-500 text-sm mt-1">Agenda e controle de vacinas por animal</p>
        </div>
        <button onClick={() => setShowRegister(true)} disabled={!canEdit} className={`text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0 whitespace-nowrap ${canEdit ? 'bg-green-700 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'}`}>
          + Registrar
        </button>
      </div>

      {/* Sem internet / fila / aviso */}
      {(!net.online || fromCache) && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <SemSinalIcon className="w-5 h-5 shrink-0" />
          <span>{net.online ? 'Sinal fraco: mostrando a última cópia guardada neste aparelho.' : 'Sem internet.'} O que você registrar fica salvo no aparelho e é enviado quando a conexão voltar.</span>
        </div>
      )}
      {net.online && net.pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><SincronizarIcon className="w-5 h-5 shrink-0" />{net.pendingCount} registro{net.pendingCount > 1 ? 's' : ''} para enviar</span>
          <button
            onClick={() => void net.sync()}
            disabled={net.syncing}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
          >
            {net.syncing ? 'Enviando...' : 'Enviar agora'}
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-2">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-green-700 hover:text-green-900 p-1" aria-label="Fechar aviso"><FecharIcon /></button>
        </div>
      )}
      {alertCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 mb-6 text-sm flex items-center gap-2">
          <AlertaIcon className="w-5 h-5 shrink-0" />
          <span><strong>{alertCount}</strong> vacina{alertCount > 1 ? 's' : ''} vencida{alertCount > 1 ? 's' : ''} ou com vencimento nos próximos 7 dias</span>
        </div>
      )}

      {quick && <QuickFilterChip label="vacinas para aplicar (vencidas e nos próximos 7 dias)" count={filtered.length} onClear={() => setQuick(null)} />}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['Todas', 'Pendente', 'Aplicada', 'Vencida'] as VaccStatus[]).map(s => (
          <button key={s} onClick={() => { setQuick(null); setFilter(s) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? 'bg-green-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s}
          </button>
        ))}
      </div>

      <label className="mb-4 block text-xs font-medium text-gray-600">Buscar animal por nome, código ou brinco
        <input type="search" value={animalSearch} onChange={e => setAnimalSearch(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      </label>
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
                <SortTh label="Animal" sortKey="animal" sort={sort} className="px-4 py-3 text-left" />
                <SortTh label="Vacina" sortKey="vaccine" sort={sort} className="hidden sm:table-cell px-4 py-3 text-left" />
                <SortTh label="Agendado" sortKey="scheduled" sort={sort} className="px-4 py-3 text-left" />
                <SortTh label="Aplicado" sortKey="applied" sort={sort} className="hidden sm:table-cell px-4 py-3 text-left" />
                <SortTh label="Status" sortKey="status" sort={sort} className="px-4 py-3 text-left" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedVaccinations.map(v => {
                const status = getStatus(v)
                return (
                  <tr key={v.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetail(v)}>
                    <td className="px-4 py-3 font-medium text-gray-800">{v.animal.name}{isPendingId(v.id) && <span className="ml-2 text-xs font-normal text-blue-700">a enviar</span>}</td>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{detail.vaccineName}</h2>
                  <p className="text-xs text-gray-500">{detail.animal.name} · Cód. {detail.animal.code}</p>
                </div>
                <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                <div><p className="text-xs text-gray-500">Agendado</p><p className="font-medium text-gray-800">{fmt(detail.scheduledDate)}</p></div>
                <div><p className="text-xs text-gray-500">Aplicado</p><p className="font-medium text-gray-800">{detail.appliedDate ? fmt(detail.appliedDate) : '—'}</p></div>
                {detail.manufacturer && <div><p className="text-xs text-gray-500">Fabricante</p><p className="text-gray-700">{detail.manufacturer}</p></div>}
                {detail.batch && <div><p className="text-xs text-gray-500">Lote</p><p className="text-gray-700">{detail.batch}</p></div>}
                {detail.observations && <div className="sm:col-span-2"><p className="text-xs text-gray-500">Observações</p><p className="text-gray-700">{detail.observations}</p></div>}
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Registrar Vacinação</h2>
                <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>
              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <AnimalPicker animals={animals} value={form.animalId} onChange={id => setForm({ ...form, animalId: id })} label="Animal" />
                <div>
                  <label className="text-xs font-medium text-gray-600">Vacina *</label>
                  <input type="text" value={form.vaccineName} onChange={e => setForm({ ...form, vaccineName: e.target.value })} required placeholder="Ex: Febre Aftosa"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
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
    </PermissionGuard>
  )
}
