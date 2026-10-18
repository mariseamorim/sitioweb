'use client'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'

import { useEffect, useRef, useState } from 'react'
import { getPendingRecords, addPendingRecord, removePendingRecord } from '@/lib/offlineStorage'
import { applyPendingMovements, movementDelta, movementReady, parseMovement, type MovementInput, type PendingMovement } from '@/lib/stockMovements'
import { useDialog } from '@/components/DialogProvider'
import { todayISO } from '@/lib/utils'
import { SemSinalIcon, SincronizarIcon, AlertaIcon, FecharIcon } from '@/components/ModuleIcons'
import { SUPPLY_CATEGORIES } from '@/lib/supplies'
import { RequestQuote } from '@/components/RequestQuote'
import { useSort } from '@/lib/useSort'
import { SortTh } from '@/components/SortTh'
import { STOCK_WARNING_DAYS } from '@/lib/lots'
import { fmtMoney } from '@/lib/reports'
import { QuickFilterChip, useQuickFilter } from '@/components/QuickFilter'

interface SupplyMovement { id: string; type: string; quantity: number; date: string; description?: string | null }
interface Supply {
  id: string
  name: string
  category: string
  unit: string
  currentQuantity: number
  minimumQuantity: number
  movements: SupplyMovement[]
  /** Consumo dos lotes de recria/engorda (kg por dia) e em quantos dias acaba */
  dailyUseKg?: number | null
  daysLeft?: number | null
  /** Preço por unidade (opcional) e peso do saco */
  unitPrice?: number | null
  packageKg?: number | null
}

const CATEGORIES = SUPPLY_CATEGORIES
const EMPTY_MOV = () => ({ type: 'Entrada', quantity: '', date: todayISO(), description: '' })
/** Produtos cadastrados e movimentações feitas sem internet, à espera de envio */
const countPending = () => getPendingRecords('estoque').length + getPendingRecords('estoque-mov').length
const pendingMovements = (fid: string) => (getPendingRecords('estoque-mov') as PendingMovement[]).filter((m) => m.farmId === fid)
const round2 = (n: number) => Math.round(n * 100) / 100
type MovStatus = '' | 'saving' | 'saved' | 'offline' | 'error'

export default function EstoquePage() {
  const { confirm } = useDialog()
  const { user } = useUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [loading, setLoading] = useState(true)
  const [farmId, setFarmId] = useState('')
  const [detail, setDetail] = useState<Supply | null>(null)
  const [quick, setQuick] = useQuickFilter(['alerta'] as const)
  const [quoteFor, setQuoteFor] = useState<Supply | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showMov, setShowMov] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', category: 'Ração', unit: 'kg', currentQuantity: '', minimumQuantity: '', unitPrice: '', packageKg: '' })
  const [mov, setMov] = useState(EMPTY_MOV)
  // Movimentação que a tela está salvando sozinha: o que já foi gravado (no servidor ou no aparelho) e o estado do envio
  const [movSaved, setMovSaved] = useState(false)
  const [movStatus, setMovStatus] = useState<MovStatus>('')
  const [movError, setMovError] = useState('')
  const savedRef = useRef<{ id: string | null; pendingId: number | null; before: MovementInput | null }>({ id: null, pendingId: null, before: null })
  const movBusy = useRef(false)
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const syncRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setPendingCount(countPending())
    // Voltou a internet: envia sozinho o que ficou no aparelho
    const handleOnline = () => { setIsOnline(true); void syncRef.current() }
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
        .filter(r => r.farmId === fid && (r._type ?? 'create') === 'create')
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
        // Movimentações feitas sem internet já entram no saldo mostrado
        setSupplies(Array.isArray(data) ? [...applyPendingMovements(data as Supply[], pendingMovements(fid)), ...pending] : pending)
        setLoading(false)
      })
      .catch(() => {
        const pending = mapPending()
        setSupplies(pending)
        setLoading(false)
      })
  }

  const alertCount = supplies.filter(s => s.currentQuantity <= s.minimumQuantity).length
  const shown = quick ? supplies.filter(s => s.currentQuantity <= s.minimumQuantity) : supplies
  const { rows: sortedSupplies, sort } = useSort(shown, {
    name: s => s.name, category: s => s.category, current: s => s.currentQuantity, minimum: s => s.minimumQuantity,
    status: s => (s.currentQuantity <= s.minimumQuantity ? 0 : 1),
  })
  const { rows: sortedMovements, sort: movementSort } = useSort(detail?.movements ?? [], {
    date: m => new Date(m.date), type: m => m.type, quantity: m => m.quantity,
  })

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (id.startsWith('pending_')) {
      if (!(await confirm({ title: 'Excluir este produto?', message: 'Ele foi cadastrado sem internet e ainda não foi enviado.', confirmLabel: 'Excluir', danger: true }))) return
      removePendingRecord('estoque', Number(id.slice('pending_'.length)))
      setPendingCount(countPending())
      setDetail(null)
      loadData(farmId)
      return
    }
    if (!(await confirm({ title: 'Excluir este insumo?', message: 'As entradas e saídas registradas também serão apagadas.', confirmLabel: 'Excluir', danger: true }))) return
    await fetch(`/api/estoque/${id}`, { method: 'DELETE' })
    setDetail(null)
    loadData(farmId)
  }

  async function handleSync() {
    const pending = getPendingRecords('estoque')
    const movs = getPendingRecords('estoque-mov') as PendingMovement[]
    if (!pending.length && !movs.length) return
    setSyncing(true)
    if (showMov) void closeMov(false)
    for (const record of pending) {
      const { _pendingId, _type, farmId: _, ...data } = record
      const res = await fetch('/api/estoque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, farmId }),
      }).catch(() => null)
      if (res?.ok) removePendingRecord('estoque', _pendingId)
    }
    for (const m of movs) {
      const { _pendingId, supplyId, farmId: _, ...data } = m
      const res = await fetch(`/api/estoque/${supplyId}/movimentacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => null)
      // Enviado, ou o produto não existe mais: sai da fila
      if (res?.ok || res?.status === 404) removePendingRecord('estoque-mov', _pendingId)
    }
    setPendingCount(countPending())
    setSyncing(false)
    loadData(farmId)
  }
  useEffect(() => { syncRef.current = handleSync })

  async function handleSaveNew(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)

    // Se estiver offline, salva no localStorage
    if (!isOnline) {
      addPendingRecord('estoque', { ...form, farmId, _type: 'create' })
      setPendingCount(countPending())
      setSaving(false)
      setShowNew(false)
      setForm({ name: '', category: 'Ração', unit: 'kg', currentQuantity: '', minimumQuantity: '', unitPrice: '', packageKg: '' })
      // Aparece na lista na hora, marcado como pendente
      loadData(farmId)
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
    setForm({ name: '', category: 'Ração', unit: 'kg', currentQuantity: '', minimumQuantity: '', unitPrice: '', packageKg: '' })
    loadData(farmId)
  }

  // ----- Movimentação: salva sozinha pouco depois de a pessoa parar de digitar -----

  /** Atualiza o insumo na lista e na ficha aberta com o que o servidor devolveu */
  function applySupply(supply: Supply) {
    setDetail((d) => (d && d.id === supply.id ? supply : d))
    setSupplies((prev) => prev.map((s) => (s.id === supply.id ? supply : s)))
  }

  /** Ajusta o saldo mostrado no aparelho (sem internet) e a linha da movimentação pendente */
  function patchLocal(supplyId: string, delta: number, row: SupplyMovement | null, dropId: string | null) {
    const patch = (s: Supply): Supply => s.id !== supplyId ? s : {
      ...s,
      currentQuantity: round2(s.currentQuantity + delta),
      movements: [...(row ? [row] : []), ...s.movements.filter((m) => m.id !== dropId)],
    }
    setDetail((d) => (d ? patch(d) : d))
    setSupplies((prev) => prev.map(patch))
  }

  function resetMov() {
    savedRef.current = { id: null, pendingId: null, before: null }
    setMovSaved(false)
    setMovStatus('')
    setMovError('')
    setMov(EMPTY_MOV())
  }

  function openMov() {
    resetMov()
    setShowMov(true)
  }

  /** Sem internet (ou a rede falhou): guarda no aparelho e já reflete no saldo */
  function saveMovLocally(supplyId: string, input: MovementInput) {
    const saved = savedRef.current
    if (saved.id) {
      // Já está no servidor: a correção precisa de internet
      setMovStatus('error')
      setMovError('Sem internet. A correção não foi salva: tente de novo quando a conexão voltar.')
      return
    }
    const dropId = saved.pendingId !== null ? `pending_${saved.pendingId}` : null
    if (saved.pendingId !== null) removePendingRecord('estoque-mov', saved.pendingId)
    addPendingRecord('estoque-mov', { ...input, supplyId, farmId })
    const list = getPendingRecords('estoque-mov') as PendingMovement[]
    const pendingId = list[list.length - 1]?._pendingId ?? null
    patchLocal(supplyId, movementDelta(saved.before, input), { id: `pending_${pendingId}`, type: input.type, quantity: input.quantity, date: `${input.date}T00:00:00.000Z`, description: input.description }, dropId)
    savedRef.current = { id: null, pendingId, before: input }
    setMovSaved(true)
    setMovStatus('offline')
    setPendingCount(countPending())
  }

  async function saveMov() {
    if (!detail || !canEdit || detail.id.startsWith('pending_')) return
    const input = parseMovement(mov)
    if (!input) return
    const saved = savedRef.current
    if (saved.before && JSON.stringify(saved.before) === JSON.stringify(input) && movStatus !== 'error') return
    if (movBusy.current) { setTimeout(() => void saveMovRef.current(), 400); return }
    movBusy.current = true
    setMovStatus('saving')
    setMovError('')
    try {
      if (!navigator.onLine) return saveMovLocally(detail.id, input)
      const url = saved.id ? `/api/estoque/${detail.id}/movimentacao/${saved.id}` : `/api/estoque/${detail.id}/movimentacao`
      const res = await fetch(url, { method: saved.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }).catch(() => null)
      if (!res) return saveMovLocally(detail.id, input)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.supply) {
        setMovStatus('error')
        setMovError(data.error || 'Não foi possível salvar. Tente de novo.')
        return
      }
      // Estava guardada no aparelho e agora foi para o servidor
      if (saved.pendingId !== null) removePendingRecord('estoque-mov', saved.pendingId)
      savedRef.current = { id: data.movement?.id ?? saved.id, pendingId: null, before: input }
      applySupply(data.supply)
      setMovSaved(true)
      setMovStatus('saved')
      setPendingCount(countPending())
    } finally {
      movBusy.current = false
    }
  }
  const saveMovRef = useRef(saveMov)
  useEffect(() => { saveMovRef.current = saveMov })
  const movKey = showMov && movementReady(mov) ? JSON.stringify(mov) : ''
  useEffect(() => {
    if (!movKey) return
    const timer = setTimeout(() => void saveMovRef.current(), 1200)
    return () => clearTimeout(timer)
  }, [movKey])
  // Ao sair do app ou bloquear o celular no meio do preenchimento, salva na hora
  useEffect(() => {
    const flush = () => { if (document.visibilityState === 'hidden') void saveMovRef.current() }
    document.addEventListener('visibilitychange', flush)
    return () => document.removeEventListener('visibilitychange', flush)
  }, [])

  /** Desfaz o que a tela acabou de gravar e devolve o saldo */
  async function undoMov() {
    const saved = savedRef.current
    if (!detail || !saved.before) return resetMov()
    if (saved.id) {
      setMovStatus('saving')
      const res = await fetch(`/api/estoque/${detail.id}/movimentacao/${saved.id}`, { method: 'DELETE' }).catch(() => null)
      const data = res ? await res.json().catch(() => ({})) : {}
      if (!res?.ok || !data.supply) {
        setMovStatus('error')
        setMovError(navigator.onLine ? data.error || 'Não foi possível desfazer. Tente de novo.' : 'Sem internet. Para desfazer, tente quando a conexão voltar.')
        return
      }
      applySupply(data.supply)
    } else if (saved.pendingId !== null) {
      removePendingRecord('estoque-mov', saved.pendingId)
      patchLocal(detail.id, movementDelta(saved.before, null), null, `pending_${saved.pendingId}`)
      setPendingCount(countPending())
    }
    resetMov()
  }

  /** Fecha a janela; o que estiver preenchido e ainda não gravado é salvo antes */
  async function closeMov(flush = true) {
    if (flush && movementReady(mov) && !movBusy.current) await saveMov()
    setShowMov(false)
    resetMov()
  }

  // Datas gravadas à meia-noite UTC: mostrar em UTC para não cair no dia anterior no horário de Brasília
  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

  const isLow = (s: Supply) => s.currentQuantity <= s.minimumQuantity

  return (
    <PermissionGuard module="estoque">
      <div>
      <div className="page-toolbar flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Estoque</h1>
          <p className="text-gray-500 text-sm mt-1">Insumos, medicamentos e vacinas</p>
        </div>
        <button onClick={() => setShowNew(true)} disabled={!canEdit} className={`text-white text-sm font-medium px-4 py-2 rounded-lg ${canEdit ? 'bg-green-700 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'}`}>
          Cadastrar produto
        </button>
      </div>

      {/* Offline / sync banner */}
      {!isOnline && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <SemSinalIcon className="w-5 h-5 shrink-0" />
          <span>Sem internet. Ao salvar, os registros ficam neste aparelho. Quando a internet voltar, use “Enviar registros”.</span>
        </div>
      )}
      {isOnline && pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><SincronizarIcon className="w-5 h-5 shrink-0" />{pendingCount} registro{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''} para enviar</span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
          >
            {syncing ? 'Enviando...' : 'Enviar registros'}
          </button>
        </div>
      )}

      {alertCount > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 mb-6 text-sm flex items-center gap-2">
          <AlertaIcon className="w-5 h-5 shrink-0" />
          <span><strong>{alertCount}</strong> insumo{alertCount > 1 ? 's' : ''} abaixo do estoque mínimo</span>
        </div>
      )}

      {quick && <QuickFilterChip label="itens abaixo do estoque mínimo" count={shown.length} onClear={() => setQuick(null)} />}

      {loading ? <p className="text-gray-400 text-sm">Carregando...</p> : supplies.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhum produto cadastrado</p>
          <p className="text-sm mt-1">Clique em &quot;Cadastrar produto&quot; para começar</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <SortTh label="Insumo" sortKey="name" sort={sort} className="px-4 py-3 text-left" />
                <SortTh label="Categoria" sortKey="category" sort={sort} className="hidden sm:table-cell px-4 py-3 text-left" />
                <SortTh label="Atual" sortKey="current" sort={sort} align="right" className="px-4 py-3 text-right" />
                <SortTh label="Mínimo" sortKey="minimum" sort={sort} align="right" className="hidden sm:table-cell px-4 py-3 text-right" />
                <SortTh label="Status" sortKey="status" sort={sort} className="px-4 py-3 text-left" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedSupplies.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 cursor-pointer ${isLow(s) ? 'bg-red-50/40' : ''}`} onClick={() => setDetail(s)}>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    {s.name}
                    {s.id.startsWith('pending_') && <span className="block text-xs font-medium text-blue-700">Aguardando envio</span>}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-gray-500">{s.category}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${isLow(s) ? 'text-red-600' : 'text-gray-800'}`}>
                    {s.currentQuantity} {s.unit}
                    {s.daysLeft != null && <span className={`block text-xs font-medium ${s.daysLeft <= STOCK_WARNING_DAYS ? 'text-amber-700' : 'text-gray-500'}`}>acaba em {s.daysLeft} dia{s.daysLeft === 1 ? '' : 's'}</span>}
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{detail.name}</h2>
                  <p className="text-xs text-gray-500">{detail.category} · {detail.unit}</p>
                </div>
                <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className={`rounded-lg p-3 ${isLow(detail) ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
                  <p className="text-xs text-gray-500">Quantidade Atual</p>
                  <p className={`text-xl font-bold ${isLow(detail) ? 'text-red-600' : 'text-green-700'}`}>{detail.currentQuantity} {detail.unit}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-500">Mínimo</p>
                  <p className="text-xl font-bold text-gray-700">{detail.minimumQuantity} {detail.unit}</p>
                </div>
              </div>

              {detail.dailyUseKg != null && (
                <p className={`mb-4 rounded-lg p-3 text-sm ${detail.daysLeft != null && detail.daysLeft <= STOCK_WARNING_DAYS ? 'bg-amber-50 text-amber-900' : 'bg-gray-50 text-gray-700'}`}>
                  Os lotes de recria e engorda consomem <strong>{detail.dailyUseKg} kg por dia</strong>.{' '}
                  {detail.daysLeft != null
                    ? <>No ritmo atual, o estoque acaba em <strong>{detail.daysLeft} dia{detail.daysLeft === 1 ? '' : 's'}</strong>.</>
                    : detail.unit === 'sacos' ? 'Informe o peso do saco no lote para saber em quantos dias acaba.' : 'Cadastre o estoque em kg ou sacos para saber em quantos dias acaba.'}
                </p>
              )}

              {detail.id.startsWith('pending_') ? (
                <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">Cadastrado sem internet, aguardando envio. Entradas e saídas ficam disponíveis depois que ele for enviado.</p>
              ) : (
                <>
                  <PriceLine supply={detail} canEdit={canEdit && isOnline} onSaved={(updated) => { setDetail({ ...detail, ...updated }); loadData(farmId) }} />

                  {canEdit && (
                    <button onClick={openMov} className="w-full bg-green-700 hover:bg-green-600 text-white text-sm font-medium py-2 rounded-lg mb-2">
                      + Movimentação (Entrada / Saída)
                    </button>
                  )}
                </>
              )}
              {canEdit && !detail.id.startsWith('pending_') && (
                <button onClick={() => setQuoteFor(detail)}
                  className={`w-full text-sm font-semibold py-2 rounded-lg mb-4 border-2 ${isLow(detail) ? 'border-amber-500 text-amber-800 hover:bg-amber-50' : 'border-green-700 text-green-800 hover:bg-green-50'}`}>
                  Pedir orçamento a um fornecedor
                </button>
              )}

              {detail.movements.length > 0 && (
                <>
                  <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Últimas movimentações</h3>
                  <div className="rounded-xl border border-gray-100 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                          <SortTh label="Data" sortKey="date" sort={movementSort} className="px-3 py-2 text-left" />
                          <SortTh label="Tipo" sortKey="type" sort={movementSort} className="px-3 py-2 text-left" />
                          <SortTh label="Qtd" sortKey="quantity" sort={movementSort} align="right" className="px-3 py-2 text-right" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sortedMovements.map(m => (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-600">{fmt(m.date)}{m.id.startsWith('pending_') && <span className="block text-xs text-blue-700">a enviar</span>}</td>
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

      {/* Movimentação modal: salva sozinha enquanto a pessoa preenche */}
      {showMov && detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60] p-4">
          <div role="dialog" aria-labelledby="mov-title" className="bg-white rounded-2xl shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 id="mov-title" className="text-lg font-bold text-gray-800">Movimentação</h2>
                <button type="button" onClick={() => void closeMov()} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>
              <p className="text-xs text-gray-500 mb-4">{detail.name} · saldo atual {detail.currentQuantity} {detail.unit}. Salva sozinho enquanto você preenche.</p>
              <form onSubmit={e => { e.preventDefault(); void saveMov() }} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="mov-type" className="text-xs font-medium text-gray-600">Tipo *</label>
                    <select id="mov-type" value={mov.type} onChange={e => setMov({ ...mov, type: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                      <option>Entrada</option>
                      <option>Saída</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="mov-quantity" className="text-xs font-medium text-gray-600">Quantidade ({detail.unit}) *</label>
                    <input id="mov-quantity" type="number" inputMode="decimal" autoFocus value={mov.quantity} onChange={e => setMov({ ...mov, quantity: e.target.value })} step="0.01" min="0" required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                </div>
                <div>
                  <label htmlFor="mov-date" className="text-xs font-medium text-gray-600">Data *</label>
                  <input id="mov-date" type="date" value={mov.date} onChange={e => setMov({ ...mov, date: e.target.value })} required
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                </div>
                <div>
                  <label htmlFor="mov-description" className="text-xs font-medium text-gray-600">Descrição</label>
                  <input id="mov-description" type="text" value={mov.description} onChange={e => setMov({ ...mov, description: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                </div>
                <p role="status" className={`text-sm min-h-[1.25rem] ${movStatus === 'error' ? 'text-red-600' : movStatus === 'saved' ? 'text-green-700' : movStatus === 'offline' ? 'text-blue-800' : 'text-gray-500'}`}>
                  {movStatus === 'saving' ? 'Salvando…'
                    : movStatus === 'saved' ? 'Salvo. Pode corrigir os campos ou desfazer.'
                    : movStatus === 'offline' ? 'Salvo no celular. Será enviado quando houver internet.'
                    : movStatus === 'error' ? movError
                    : 'Informe a quantidade: o lançamento é salvo sozinho.'}
                </p>
                <div className="flex gap-2 pt-1">
                  {movSaved ? (
                    <>
                      <button type="button" onClick={() => void undoMov()} className="flex-1 border border-red-200 text-red-600 text-sm font-medium py-2 rounded-lg hover:bg-red-50">Desfazer</button>
                      <button type="button" onClick={resetMov} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">Lançar outra</button>
                    </>
                  ) : (
                    <button type="button" onClick={() => { setShowMov(false); resetMov() }} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
                  )}
                  <button type="button" onClick={() => void closeMov()} className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-medium py-2 rounded-lg">Concluir</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* New supply modal */}
      {showNew && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Cadastrar produto</h2>
                <button onClick={() => setShowNew(false)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>
              <form onSubmit={handleSaveNew} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-600">Nome *</label>
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder="Ex: Ração Bovinos"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Preço por {form.unit === 'sacos' ? 'saco' : form.unit} (R$, opcional)</label>
                    <input inputMode="decimal" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value.replace(/[^\d.,]/g, '') })} placeholder="Ex.: 85,00"
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  {form.unit === 'sacos' && (
                    <div>
                      <label className="text-xs font-medium text-gray-600">Peso do saco (kg, opcional)</label>
                      <input inputMode="decimal" value={form.packageKg} onChange={e => setForm({ ...form, packageKg: e.target.value.replace(/[^\d.,]/g, '') })} placeholder="Ex.: 25"
                        className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500">Com o preço, o trato dos lotes mostra o custo por animal. Pode deixar em branco.</p>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowNew(false)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-medium py-2 rounded-lg">{saving ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {quoteFor && <RequestQuote item={quoteFor} onClose={() => setQuoteFor(null)} />}
    </div>
    </PermissionGuard>
  )
}

/** Preço por unidade e peso do saco (opcionais): com eles o trato dos lotes mostra o custo */
function PriceLine({ supply, canEdit, onSaved }: { supply: Supply; canEdit: boolean; onSaved: (s: Partial<Supply>) => void }) {
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState(supply.unitPrice ? String(supply.unitPrice).replace('.', ',') : '')
  const [bag, setBag] = useState(supply.packageKg ? String(supply.packageKg).replace('.', ',') : '')
  const [error, setError] = useState('')
  const unitName = supply.unit === 'sacos' ? 'saco' : supply.unit

  async function save() {
    setError('')
    const res = await fetch(`/api/estoque/${supply.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unitPrice: price, ...(supply.unit === 'sacos' && { packageKg: bag }) }),
    }).catch(() => null)
    if (!res?.ok) return setError('Não foi possível salvar')
    const body = await res.json()
    onSaved({ unitPrice: body.unitPrice, packageKg: body.packageKg })
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="mb-4 rounded-lg border border-gray-100 p-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium text-gray-600">Preço por {unitName} (R$)
            <input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="Ex.: 85,00" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          {supply.unit === 'sacos' && (
            <label className="text-xs font-medium text-gray-600">Peso do saco (kg)
              <input inputMode="decimal" value={bag} onChange={e => setBag(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="Ex.: 25" className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </label>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">Opcional. Deixe em branco para não usar.</p>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setEditing(false)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg">Cancelar</button>
          <button type="button" onClick={() => void save()} className="flex-1 bg-green-700 text-white text-sm font-medium py-2 rounded-lg">Salvar</button>
        </div>
      </div>
    )
  }
  return (
    <p className="mb-4 text-sm text-gray-600">
      {supply.unitPrice ? <>Preço: <strong className="text-gray-800">{fmtMoney(supply.unitPrice)}</strong> por {unitName}</> : 'Sem preço informado'}
      {supply.unit === 'sacos' && supply.packageKg ? ` · saco de ${supply.packageKg} kg` : ''}
      {canEdit && <button type="button" onClick={() => setEditing(true)} className="ml-2 font-semibold text-green-700 underline">{supply.unitPrice ? 'Alterar' : 'Informar preço'}</button>}
    </p>
  )
}
