'use client'
import { AnimalPicker } from '@/components/AnimalPicker'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'
import { animalSearchText } from '@/lib/animalCode'
import { useSort } from '@/lib/useSort'
import { SortTh } from '@/components/SortTh'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { removePendingRecord, type OfflineRecord } from '@/lib/offlineStorage'
import { cachedGet, isPendingId, pendingIdOf, pendingItemId, pendingOf, sendOrQueue, withPending, type PendingRequest, type QueuedRequest } from '@/lib/offlineData'
import { useOfflineModule } from '@/lib/useOffline'
import { loadHerd } from '@/lib/herdCache'
import { useDialog } from '@/components/DialogProvider'
import { currentMonthRange, inDayRange, todayISO } from '@/lib/utils'
import { SemSinalIcon, SincronizarIcon, FecharIcon } from '@/components/ModuleIcons'

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
  /** Carência em dias depois do fim do tratamento */
  milkWithdrawalDays?: number | null
  meatWithdrawalDays?: number | null
  batch?: string | null
  manufacturer?: string | null
  description?: string | null
  observations?: string | null
  animal: Animal
}

const MODULE = 'veterinary-treatment'
const EMPTY_FORM = {
  animalId: '', startDate: todayISO(), endDate: '',
  medicine: '', milkWithdrawalDays: '', meatWithdrawalDays: '', batch: '', manufacturer: '', description: '', observations: '',
}

/** Tratamento guardado sem internet, como aparece na lista. Registros antigos da fila têm os campos soltos, sem _body. */
function pendingTreatment(p: PendingRequest, animals: Animal[]): Treatment | null {
  if (p._type !== 'create') return null
  const b = (p._body ?? p) as Record<string, string | number | null | undefined>
  const str = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v))
  const days = (v: unknown) => (v ? Number(v) : null)
  const animal = (p.animal as Animal | undefined) ?? animals.find(a => a.id === b.animalId) ?? { id: String(b.animalId ?? ''), name: '(sem internet)', code: '' }
  return {
    id: pendingItemId(p), animalId: String(b.animalId ?? ''), animal, startDate: String(b.startDate ?? ''), endDate: str(b.endDate), medicine: String(b.medicine ?? ''),
    milkWithdrawalDays: days(b.milkWithdrawalDays), meatWithdrawalDays: days(b.meatWithdrawalDays),
    batch: str(b.batch), manufacturer: str(b.manufacturer), description: str(b.description), observations: str(b.observations),
  }
}

/** Fila antiga (antes de cada pedido levar a própria URL): era sempre um POST com os campos soltos */
const legacyRequest = (r: OfflineRecord): QueuedRequest => {
  const data = Object.fromEntries(Object.entries(r).filter(([k]) => !['_pendingId', '_type', 'farmId', 'animal'].includes(k)))
  return { url: '/api/veterinary-treatment', method: 'POST', body: data }
}

export default function VeterinaryTreatmentPage() {
  const { confirm } = useDialog()
  const { user } = useUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const farmId = user?.farmId ?? ''
  const [treatments, setTreatments] = useState<Treatment[]>([])
  const [allAnimals, setAllAnimals] = useState<Animal[]>([])
  const [animalSearch, setAnimalSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [notice, setNotice] = useState('')
  const [saveError, setSaveError] = useState('')
  const [from, setFrom] = useState(() => currentMonthRange().from)
  const [to, setTo] = useState(() => currentMonthRange().to)
  const [detailAnimalId, setDetailAnimalId] = useState<string | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)

  // Lista e rebanho com cópia no aparelho; a fila (criados e excluídos sem internet) entra por cima
  const loadData = useCallback(async (fid: string) => {
    const [trts, herd] = await Promise.all([
      cachedGet<Treatment[]>(`cache_tratamentos_${fid}`, `/api/veterinary-treatment?farmId=${fid}`).catch(() => null),
      loadHerd<Animal>(fid).catch(() => null),
    ])
    const anims = Array.isArray(herd?.data) ? herd.data : []
    const list = Array.isArray(trts?.data) ? trts.data : []
    setAllAnimals(anims)
    setTreatments(withPending(list, pendingOf(MODULE, p => p.farmId === fid), p => pendingTreatment(p, anims)))
    setFromCache(!!(trts?.fromCache || herd?.fromCache))
    setLoading(false)
  }, [])
  const reload = useCallback(() => { if (farmId) void loadData(farmId) }, [farmId, loadData])
  const net = useOfflineModule(MODULE, reload, legacyRequest)
  useEffect(() => { void Promise.resolve().then(reload) }, [reload])

  const filtered = useMemo(() => {
    return treatments.filter((t) => {
      if (!inDayRange(t.startDate, from, to)) return false
      const term = animalSearch.trim().toLowerCase()
      return animalSearchText(t.animal).includes(term)
    })
  }, [treatments, from, to, animalSearch])

  const summary = useMemo(() => {
    const map = new Map<string, { animal: Animal; count: number; last: string; pending: number }>()
    for (const t of filtered) {
      const pending = isPendingId(t.id) ? 1 : 0
      const s = map.get(t.animalId)
      if (s) {
        s.count++
        s.pending += pending
        if (new Date(t.startDate) > new Date(s.last)) s.last = t.startDate
      } else {
        map.set(t.animalId, { animal: t.animal, count: 1, last: t.startDate, pending })
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.last).getTime() - new Date(a.last).getTime())
  }, [filtered])

  const { rows: sortedSummary, sort } = useSort(summary, {
    name: s => s.animal.name, code: s => s.animal.code, count: s => s.count, last: s => new Date(s.last),
  })

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

  // Depois de guardar ou enviar: a lista mostra na hora e a barra do topo atualiza a contagem
  const afterChange = (queued: boolean) => {
    setNotice(queued ? net.queuedMessage : '')
    net.refresh()
    reload()
  }

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (!(await confirm({ title: 'Excluir este tratamento?', confirmLabel: 'Excluir', danger: true }))) return
    if (isPendingId(id)) {
      // Ainda não foi enviado: sai da fila do aparelho
      removePendingRecord(MODULE, pendingIdOf(id))
      return afterChange(false)
    }
    const r = await sendOrQueue(MODULE, { type: 'delete', id, url: `/api/veterinary-treatment/${id}`, method: 'DELETE', local: { farmId } })
    if (r.status === 'rejected') setNotice(r.error)
    else afterChange(r.status === 'queued')
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    const body = {
      animalId: form.animalId,
      startDate: form.startDate,
      endDate: form.endDate || null,
      medicine: form.medicine,
      milkWithdrawalDays: form.milkWithdrawalDays || null,
      meatWithdrawalDays: form.meatWithdrawalDays || null,
      batch: form.batch || null,
      manufacturer: form.manufacturer || null,
      description: form.description || null,
      observations: form.observations || null,
    }
    const animal = allAnimals.find(a => a.id === form.animalId)
    const r = await sendOrQueue(MODULE, { type: 'create', url: '/api/veterinary-treatment', method: 'POST', body, local: { farmId, animal } })
    setSaving(false)
    if (r.status === 'rejected') return setSaveError(r.error)
    setShowRegister(false)
    setForm(EMPTY_FORM)
    afterChange(r.status === 'queued')
  }

  function fmt(date: string) {
    return new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  }

  return (
    <PermissionGuard module="veterinario">
      <div>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tratamentos Veterinários</h1>
          <p className="text-gray-500 text-sm mt-1">Resumo por animal no período selecionado</p>
        </div>
        <button
          onClick={() => setShowRegister(true)}
          disabled={!canEdit}
          className={`text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0 whitespace-nowrap ${
            canEdit
              ? 'bg-green-700 hover:bg-green-600'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
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
      <label className="mb-4 block text-xs font-medium text-gray-600">Buscar animal por nome, código ou brinco
        <input type="search" value={animalSearch} onChange={e => setAnimalSearch(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      </label>
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
                <SortTh label="Animal" sortKey="name" sort={sort} className="px-4 py-3 text-left" />
                <SortTh label="Código" sortKey="code" sort={sort} className="hidden sm:table-cell px-4 py-3 text-left" />
                <SortTh label="Tratamentos" sortKey="count" sort={sort} align="right" className="px-4 py-3 text-right" />
                <SortTh label="Último" sortKey="last" sort={sort} align="right" className="hidden sm:table-cell px-4 py-3 text-right" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedSummary.map(({ animal, count, last, pending }) => (
                <tr
                  key={animal.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setDetailAnimalId(animal.id)}
                >
                  <td className="px-4 py-3 font-medium text-gray-800">{animal.name}{pending > 0 && <span className="ml-2 text-xs font-normal text-blue-700">{pending} a enviar</span>}</td>
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{detailAnimal.name}</h2>
                  <p className="text-xs text-gray-500">Código: {detailAnimal.code}</p>
                </div>
                <button onClick={() => setDetailAnimalId(null)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
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
                          <p className="font-semibold text-gray-800">{t.medicine}{isPendingId(t.id) && <span className="ml-2 text-xs font-normal text-blue-700">a enviar</span>}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Período</p>
                          <p className="font-medium text-gray-700">
                            {fmt(t.startDate)}{t.endDate ? ` → ${fmt(t.endDate)}` : ''}
                          </p>
                        </div>
                        {withdrawalText(t) && (
                          <div className="col-span-2">
                            <p className="text-xs text-gray-500">Carência</p>
                            <p className={`font-medium ${withdrawalText(t)!.active ? 'text-red-700' : 'text-gray-700'}`}>{withdrawalText(t)!.text}</p>
                          </div>
                        )}
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
                          <div className="sm:col-span-2">
                            <p className="text-xs text-gray-500">Descrição</p>
                            <p className="text-gray-700">{t.description}</p>
                          </div>
                        )}
                        {t.observations && (
                          <div className="sm:col-span-2">
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Registrar Tratamento</h2>
                <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>

              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <AnimalPicker animals={allAnimals} value={form.animalId} onChange={id => setForm({ ...form, animalId: id })} label="Animal" />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <label className="text-xs font-medium text-gray-600">Carência do leite (dias)</label>
                    <input inputMode="numeric" value={form.milkWithdrawalDays} onChange={(e) => setForm({ ...form, milkWithdrawalDays: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                      placeholder="Ex.: 4" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Carência da carne (dias)</label>
                    <input inputMode="numeric" value={form.meatWithdrawalDays} onChange={(e) => setForm({ ...form, meatWithdrawalDays: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                      placeholder="Ex.: 30" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                </div>
                <p className="-mt-1 text-xs text-gray-500">Está na bula. Conta a partir do fim do tratamento. O app avisa até quando o leite não pode ir para o tanque e o animal não pode ir para o abate.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

                {saveError && <p role="alert" className="text-sm text-red-600">{saveError}</p>}
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

/** Até quando vale a carência do leite e da carne (a partir do fim do tratamento, ou do início sem fim) */
function withdrawalText(t: Treatment): { text: string; active: boolean } | null {
  const base = t.endDate ?? t.startDate
  const until = (days?: number | null) => {
    if (!days) return null
    const d = new Date(base)
    d.setUTCDate(d.getUTCDate() + days)
    return d
  }
  const milk = until(t.milkWithdrawalDays)
  const meat = until(t.meatWithdrawalDays)
  if (!milk && !meat) return null
  const today = new Date(todayISO())
  const fmtDay = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  const parts = [
    milk && `leite fora do tanque até ${fmtDay(milk)}`,
    meat && `abate liberado depois de ${fmtDay(meat)}`,
  ].filter(Boolean) as string[]
  const active = (!!milk && milk >= today) || (!!meat && meat >= today)
  const text = parts.join(' · ')
  return { text: (active ? '' : 'Encerrada: ') + text.charAt(0).toUpperCase() + text.slice(1), active }
}
