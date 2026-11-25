'use client'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getPendingRecords, addPendingRecord, removePendingRecord, type OfflineRecord } from '@/lib/offlineStorage'
import { cachedGet, fetchWithTimeout, isPendingId, pendingIdOf, pendingItemId, pendingOf, sendOrQueue, withPending, type PendingRequest, type QueuedRequest } from '@/lib/offlineData'
import { useOfflineModule } from '@/lib/useOffline'
import { applyPendingMovements, movementDelta, movementReady, parseMovement, type MovementInput, type PendingMovement } from '@/lib/stockMovements'
import { useDialog } from '@/components/DialogProvider'
import { todayISO } from '@/lib/utils'
import { SemSinalIcon, SincronizarIcon, AlertaIcon, FecharIcon, EstoqueIcon } from '@/components/ModuleIcons'
import { SUPPLY_CATEGORIES } from '@/lib/supplies'
import { RequestQuote } from '@/components/RequestQuote'
import { useSort } from '@/lib/useSort'
import { SortTh } from '@/components/SortTh'
import { STOCK_WARNING_DAYS } from '@/lib/lots'
import { fmtMoney } from '@/lib/reports'
import { expenseCategoryFor, purchaseDescription, suggestedAmount } from '@/lib/stockFinance'
import { QuickFilterChip, useQuickFilter } from '@/components/QuickFilter'
import { useLocale, useT } from '@/lib/i18n'
import { StatTile } from '@/components/StatTile'
import { AppModal, modalButton } from '@/components/AppModal'
import { keepNumberChars, parseBrNumber } from '@/lib/brNumber'

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
  /** Por que não dá para saber em quantos dias acaba (insumo usado por lote aberto) */
  daysLeftHint?: string | null
  /** Preço por unidade (opcional) e peso do saco */
  unitPrice?: number | null
  packageKg?: number | null
  /** Validade (opcional), "AAAA-MM-DD..." */
  expiryDate?: string | null
}

const CATEGORIES = SUPPLY_CATEGORIES
const MODULE = 'estoque'
const FIELD = 'mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base font-normal focus:outline-none focus:ring-2 focus:ring-green-600'
const EMPTY_MOV = () => ({ type: 'Entrada', quantity: '', date: todayISO(), description: '' })
const EMPTY_FORM = { name: '', category: 'Ração', unit: 'kg', currentQuantity: '', minimumQuantity: '', unitPrice: '', packageKg: '', expiryDate: '' }
/** Quantos dias antes da validade o insumo entra em "Próximos a vencer" */
const EXPIRY_WARNING_DAYS = 30
/** Dias até a validade (negativo: já venceu); null sem validade */
const daysToExpiry = (s: { expiryDate?: string | null }) => (s.expiryDate ? Math.round((Date.parse(s.expiryDate.slice(0, 10)) - Date.parse(todayISO())) / 86_400_000) : null)
const fmtDay = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
/** Movimentações feitas sem internet, à espera de envio (fila própria, com saldo já refletido na tela) */
const countMovPending = () => getPendingRecords('estoque-mov').length
const parseDec = (v: string) => { const n = Number(v.replace(',', '.')); return v.trim() && Number.isFinite(n) && n > 0 ? n : null }

/** Insumo cadastrado sem internet, como aparece na lista. Registros antigos da fila têm os campos soltos, sem _body. */
function pendingSupply(p: PendingRequest): Supply | null {
  if (p._type !== 'create') return null
  const b = (p._body ?? p) as Record<string, string | number | null | undefined>
  return {
    id: pendingItemId(p), name: String(b.name ?? ''), category: String(b.category ?? ''), unit: String(b.unit ?? ''),
    currentQuantity: Number(b.currentQuantity ?? 0), minimumQuantity: Number(b.minimumQuantity ?? 0), movements: [],
    unitPrice: parseDec(String(b.unitPrice ?? '')), packageKg: parseDec(String(b.packageKg ?? '')),
    expiryDate: b.expiryDate ? String(b.expiryDate) : null,
  }
}

/** Fila antiga (antes de cada pedido levar a própria URL): era sempre um POST com os campos soltos */
const legacyRequest = (r: OfflineRecord): QueuedRequest => ({
  url: '/api/estoque', method: 'POST', body: Object.fromEntries(Object.entries(r).filter(([k]) => !['_pendingId', '_type'].includes(k))),
})
const pendingMovements = (fid: string) => (getPendingRecords('estoque-mov') as PendingMovement[]).filter((m) => m.farmId === fid)
const round2 = (n: number) => Math.round(n * 100) / 100
type MovStatus = '' | 'saving' | 'saved' | 'offline' | 'error'

export default function EstoquePage() {
  const { confirm } = useDialog()
  const t = useT()
  const locale = useLocale()
  const { user, canAccess } = useUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [loading, setLoading] = useState(true)
  const farmId = user?.farmId ?? ''
  const [fromCache, setFromCache] = useState(false)
  const [notice, setNotice] = useState('')
  const [saveError, setSaveError] = useState('')
  const [detail, setDetail] = useState<Supply | null>(null)
  const [quick, setQuick] = useQuickFilter(['alerta'] as const)
  const [quoteFor, setQuoteFor] = useState<Supply | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [showMov, setShowMov] = useState(false)
  // Com a movimentação ou o pedido de orçamento abertos por cima, o Esc fecha só o de cima
  const closeDetail = useCallback(() => { if (!showMov && !quoteFor) setDetail(null) }, [showMov, quoteFor])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [mov, setMov] = useState(EMPTY_MOV)
  // Movimentação que a tela está salvando sozinha: o que já foi gravado (no servidor ou no aparelho) e o estado do envio
  const [movSaved, setMovSaved] = useState(false)
  const [movStatus, setMovStatus] = useState<MovStatus>('')
  const [movError, setMovError] = useState('')
  const savedRef = useRef<{ id: string | null; pendingId: number | null; before: MovementInput | null }>({ id: null, pendingId: null, before: null })
  const movBusy = useRef(false)
  const [movPending, setMovPending] = useState(0)
  const [sendingMovs, setSendingMovs] = useState(false)
  const syncRef = useRef<() => Promise<void>>(async () => {})

  useEffect(() => {
    // Voltou a internet: envia sozinho as movimentações que ficaram no aparelho (os insumos vão pelo useOfflineModule)
    const handleOnline = () => { void syncRef.current() }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

  // Lista com cópia no aparelho; movimentações pendentes entram no saldo e insumos criados sem internet entram no fim
  const loadData = useCallback(async (fid: string) => {
    const r = await cachedGet<Supply[]>(`cache_estoque_${fid}`, `/api/estoque?farmId=${fid}`).catch(() => null)
    const data = Array.isArray(r?.data) ? r.data : []
    setSupplies(withPending(applyPendingMovements(data, pendingMovements(fid)), pendingOf(MODULE, p => p.farmId === fid), pendingSupply))
    setFromCache(!!r?.fromCache)
    setMovPending(countMovPending())
    setLoading(false)
  }, [])
  const reload = useCallback(() => { if (farmId) void loadData(farmId) }, [farmId, loadData])
  const net = useOfflineModule(MODULE, reload, legacyRequest)
  useEffect(() => { void Promise.resolve().then(reload) }, [reload])
  const isOnline = net.online
  const pendingCount = net.pendingCount + movPending
  const refreshPending = () => { setMovPending(countMovPending()); net.refresh() }

  const alertCount = supplies.filter(s => s.currentQuantity <= s.minimumQuantity).length
  // Abas por categoria: só as categorias que têm insumo cadastrado
  const [catTab, setCatTab] = useState('Todas')
  const tabCats = CATEGORIES.filter(c => supplies.some(s => s.category === c))
  const byQuick = quick ? supplies.filter(s => s.currentQuantity <= s.minimumQuantity) : supplies
  const shown = catTab === 'Todas' ? byQuick : byQuick.filter(s => s.category === catTab)
  const { rows: sortedSupplies, sort } = useSort(shown, {
    name: s => s.name, category: s => s.category, current: s => s.currentQuantity, minimum: s => s.minimumQuantity,
    status: s => (s.currentQuantity <= 0 ? 0 : s.currentQuantity <= s.minimumQuantity ? 1 : 2),
  })
  // Valor em estoque: só os insumos com preço informado entram na soma
  const priced = supplies.filter(s => s.unitPrice)
  // Vencem nos próximos 30 dias ou já venceram
  const expiring = supplies.filter(s => { const d = daysToExpiry(s); return d !== null && d <= EXPIRY_WARNING_DAYS })
  const expired = expiring.filter(s => (daysToExpiry(s) ?? 0) < 0).length
  const stockValue = priced.reduce((sum, s) => sum + Math.max(0, s.currentQuantity) * (s.unitPrice ?? 0), 0)
  const unpriced = supplies.length - priced.length
  const { rows: sortedMovements, sort: movementSort } = useSort(detail?.movements ?? [], {
    date: m => new Date(m.date), type: m => m.type, quantity: m => m.quantity,
  })

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (isPendingId(id)) {
      if (!(await confirm({ title: t('Excluir este produto?'), message: t('Ele foi cadastrado sem internet e ainda não foi enviado.'), confirmLabel: t('Excluir'), danger: true }))) return
      removePendingRecord(MODULE, pendingIdOf(id))
      refreshPending()
      setDetail(null)
      reload()
      return
    }
    if (!(await confirm({ title: t('Excluir este insumo?'), message: t('As entradas e saídas registradas também serão apagadas.'), confirmLabel: t('Excluir'), danger: true }))) return
    setDetail(null)
    const r = await sendOrQueue(MODULE, { type: 'delete', id, url: `/api/estoque/${id}`, method: 'DELETE', local: { farmId } })
    if (r.status === 'rejected') return setNotice(t(r.error))
    setNotice(r.status === 'queued' ? t(net.queuedMessage) : '')
    refreshPending()
    reload()
  }

  async function handleSync() {
    const movs = getPendingRecords('estoque-mov') as PendingMovement[]
    if (!net.pendingCount && !movs.length) return
    setSendingMovs(true)
    if (showMov) void closeMov(false)
    // Insumos criados, alterados ou excluídos sem internet: fila comum (cada pedido leva a própria URL)
    await net.sync()
    for (const m of movs) {
      const { _pendingId, supplyId } = m
      const data = Object.fromEntries(Object.entries(m).filter(([k]) => !['_pendingId', 'supplyId', 'farmId'].includes(k)))
      const res = await fetchWithTimeout(`/api/estoque/${supplyId}/movimentacao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).catch(() => null)
      // Enviado, ou o produto não existe mais: sai da fila
      if (res?.ok || res?.status === 404) removePendingRecord('estoque-mov', _pendingId)
    }
    setSendingMovs(false)
    refreshPending()
    reload()
  }
  useEffect(() => { syncRef.current = handleSync })

  async function handleSaveNew(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    // Com internet envia; sem internet ou com sinal fraco fica na fila do aparelho e já aparece na lista
    const r = await sendOrQueue(MODULE, { type: 'create', url: '/api/estoque', method: 'POST', body: { ...form, currentQuantity: parseBrNumber(form.currentQuantity) || 0, minimumQuantity: parseBrNumber(form.minimumQuantity) || 0, unitPrice: parseDec(String(parseBrNumber(form.unitPrice) || '')), packageKg: parseDec(String(parseBrNumber(form.packageKg) || '')), farmId }, local: { farmId } })
    setSaving(false)
    if (r.status === 'rejected') return setSaveError(t(r.error))
    setShowNew(false)
    setForm(EMPTY_FORM)
    setNotice(r.status === 'queued' ? t(net.queuedMessage) : '')
    refreshPending()
    reload()
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
      setMovError(t('Sem internet. A correção não foi salva: tente de novo quando a conexão voltar.'))
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
    refreshPending()
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
      // Sinal fraco: a espera estoura e a movimentação fica no aparelho, como sem internet
      const res = await fetchWithTimeout(url, { method: saved.id ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }).catch(() => null)
      if (!res) return saveMovLocally(detail.id, input)
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.supply) {
        setMovStatus('error')
        setMovError(t(data.error || 'Não foi possível salvar. Tente de novo.'))
        return
      }
      // Estava guardada no aparelho e agora foi para o servidor
      if (saved.pendingId !== null) removePendingRecord('estoque-mov', saved.pendingId)
      savedRef.current = { id: data.movement?.id ?? saved.id, pendingId: null, before: input }
      applySupply(data.supply)
      setMovSaved(true)
      setMovStatus('saved')
      refreshPending()
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
      const res = await fetchWithTimeout(`/api/estoque/${detail.id}/movimentacao/${saved.id}`, { method: 'DELETE' }).catch(() => null)
      const data = res ? await res.json().catch(() => ({})) : {}
      if (!res?.ok || !data.supply) {
        setMovStatus('error')
        setMovError(t(navigator.onLine ? data.error || 'Não foi possível desfazer. Tente de novo.' : 'Sem internet. Para desfazer, tente quando a conexão voltar.'))
        return
      }
      applySupply(data.supply)
    } else if (saved.pendingId !== null) {
      removePendingRecord('estoque-mov', saved.pendingId)
      patchLocal(detail.id, movementDelta(saved.before, null), null, `pending_${saved.pendingId}`)
      refreshPending()
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
  const fmt = (d: string) => new Date(d).toLocaleDateString(locale, { timeZone: 'UTC' })

  const isLow = (s: Supply) => s.currentQuantity <= s.minimumQuantity
  // Situação do insumo: acabou = Crítico, no mínimo ou abaixo = Baixo; a palavra sempre aparece junto da cor
  const statusOf = (s: Supply) => s.currentQuantity <= 0
    ? { label: 'Crítico', badge: 'bg-red-100 text-red-800', dot: 'bg-red-600' }
    : isLow(s)
      ? { label: 'Baixo', badge: 'bg-orange-100 text-orange-800', dot: 'bg-orange-500' }
      : { label: 'OK', badge: 'bg-green-100 text-green-800', dot: 'bg-green-600' }

  return (
    <PermissionGuard module="estoque">
      <div>
      <div className="page-toolbar flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('Estoque')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('Insumos, medicamentos e vacinas')}</p>
        </div>
        <button onClick={() => setShowNew(true)} disabled={!canEdit} className="btn-primary">
          {t('Cadastrar produto')}
        </button>
      </div>

      {/* Sem internet / sinal fraco / fila / aviso */}
      {(!isOnline || fromCache) && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <SemSinalIcon className="w-5 h-5 shrink-0" />
          <span>{isOnline ? t('Sinal fraco: mostrando a última cópia guardada neste aparelho.') : t('Sem internet.')} {t('O que você registrar fica salvo no aparelho e é enviado quando a conexão voltar.')}</span>
        </div>
      )}
      {isOnline && pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><SincronizarIcon className="w-5 h-5 shrink-0" />{pendingCount > 1 ? t('{n} registros para enviar', { n: pendingCount }) : t('1 registro para enviar')}</span>
          <button
            onClick={handleSync}
            disabled={net.syncing || sendingMovs}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
          >
            {t(net.syncing || sendingMovs ? 'Enviando...' : 'Enviar agora')}
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-2">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-green-700 hover:text-green-900 p-1" aria-label={t('Fechar aviso')}><FecharIcon /></button>
        </div>
      )}

      {alertCount > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 mb-6 text-sm flex items-center gap-2">
          <AlertaIcon className="w-5 h-5 shrink-0" />
          <span><strong>{alertCount}</strong> {t(alertCount > 1 ? 'insumos abaixo do estoque mínimo' : 'insumo abaixo do estoque mínimo')}</span>
        </div>
      )}

      {/* Números do estoque */}
      {!loading && supplies.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatTile accent="blue" label={t('Insumos cadastrados')} value={supplies.length} />
          <StatTile accent="green" label={t('Valor total em estoque')} value={priced.length ? fmtMoney(stockValue) : '—'}
            detail={unpriced > 0 ? t('{n} sem preço informado', { n: unpriced }) : undefined} />
          <StatTile accent="red" label={t('Abaixo do mínimo')} value={alertCount} />
          <StatTile accent="amber" label={t('Próximos a vencer')} value={expiring.length}
            detail={expired ? t(expired === 1 ? '1 já venceu' : '{n} já venceram', { n: expired }) : t('Nos próximos {n} dias', { n: EXPIRY_WARNING_DAYS })} />
        </div>
      )}

      {quick && <QuickFilterChip label={t('itens abaixo do estoque mínimo')} count={shown.length} onClear={() => setQuick(null)} />}

      {/* Abas por categoria */}
      {!loading && tabCats.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {['Todas', ...tabCats].map(c => (
            <button key={c} type="button" onClick={() => setCatTab(c)} aria-pressed={catTab === c}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${catTab === c ? 'bg-green-800 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              {t(c)}
            </button>
          ))}
        </div>
      )}

      {loading ? <p className="text-gray-400 text-sm">{t('Carregando...')}</p> : supplies.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">{t('Nenhum produto cadastrado')}</p>
          <p className="text-sm mt-1">{t('Clique em "Cadastrar produto" para começar')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <SortTh label={t('Insumo')} sortKey="name" sort={sort} className="px-4 py-3 text-left" />
                <SortTh label={t('Categoria')} sortKey="category" sort={sort} className="hidden sm:table-cell px-4 py-3 text-left" />
                <SortTh label={t('Atual')} sortKey="current" sort={sort} align="right" className="px-4 py-3 text-right" />
                <SortTh label={t('Mínimo')} sortKey="minimum" sort={sort} align="right" className="hidden sm:table-cell px-4 py-3 text-right" />
                <SortTh label={t('Status')} sortKey="status" sort={sort} className="px-4 py-3 text-left" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedSupplies.map(s => (
                <tr key={s.id} className={`hover:bg-gray-50 cursor-pointer ${isLow(s) ? 'bg-red-50/40' : ''}`} onClick={() => setDetail(s)}>
                  <td className="px-4 py-3 font-medium text-gray-800">
                    <button type="button" className="row-open">{s.name}</button>
                    {s.id.startsWith('pending_') && <span className="block text-xs font-medium text-blue-700">{t('Aguardando envio')}</span>}
                    <ExpiryNote supply={s} />
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-gray-600">{t(s.category)}</td>
                  <td className={`px-4 py-3 text-right font-semibold tabular-nums ${isLow(s) ? 'text-red-700' : 'text-gray-800'}`}>
                    {s.currentQuantity} {t(s.unit)}
                    {s.daysLeft != null && <span className={`block text-xs font-medium ${s.daysLeft <= STOCK_WARNING_DAYS ? 'text-amber-700' : 'text-gray-500'}`}>{s.daysLeft === 1 ? t('acaba em 1 dia') : t('acaba em {n} dias', { n: s.daysLeft })}</span>}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-right text-gray-600 tabular-nums">{s.minimumQuantity} {t(s.unit)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${statusOf(s).badge}`}>
                      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${statusOf(s).dot}`} />
                      {t(statusOf(s).label)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detalhe do insumo: modal padrão (grande, com a tabela de movimentações) */}
      {detail && (
        <AppModal title={detail.name} subtitle={`${t(detail.category)} · ${t(detail.unit)}`}
          onClose={closeDetail} icon={<EstoqueIcon className="h-6 w-6" />} tone="amber" size="lg"
          footer={<>
            <button type="button" onClick={() => handleDelete(detail.id)} className={`${modalButton.ghost} border-red-200 text-red-600 hover:bg-red-50`}>{t('Excluir Insumo')}</button>
            {canEdit && !detail.id.startsWith('pending_') && (
              <button type="button" onClick={() => setQuoteFor(detail)}
                className={isLow(detail) ? `${modalButton.secondary} border-amber-500 text-amber-800 hover:bg-amber-50` : modalButton.secondary}>
                {t('Pedir orçamento a um fornecedor')}
              </button>
            )}
            {canEdit && !detail.id.startsWith('pending_') && (
              <button type="button" onClick={openMov} className={modalButton.primary}>{t('+ Movimentação (Entrada / Saída)')}</button>
            )}
          </>}>
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className={`rounded-lg p-3 ${isLow(detail) ? 'bg-red-50 border border-red-100' : 'bg-green-50 border border-green-100'}`}>
                  <p className="text-xs text-gray-500">{t('Quantidade Atual')}</p>
                  <p className={`text-xl font-bold ${isLow(detail) ? 'text-red-600' : 'text-green-700'}`}>{detail.currentQuantity} {t(detail.unit)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <p className="text-xs text-gray-500">{t('Mínimo')}</p>
                  <p className="text-xl font-bold text-gray-700">{detail.minimumQuantity} {t(detail.unit)}</p>
                </div>
              </div>

              {detail.dailyUseKg != null && (
                <p className={`mb-4 rounded-lg p-3 text-sm ${detail.daysLeft != null && detail.daysLeft <= STOCK_WARNING_DAYS ? 'bg-amber-50 text-amber-900' : 'bg-gray-50 text-gray-700'}`}>
                  {t('Os lotes de recria e engorda consomem')} <strong>{t('{n} kg por dia', { n: detail.dailyUseKg })}</strong>.{' '}
                  {detail.daysLeft != null
                    ? <>{t('No ritmo atual, o estoque acaba em')} <strong>{detail.daysLeft === 1 ? t('1 dia') : t('{n} dias', { n: detail.daysLeft })}</strong>.</>
                    : t(detail.daysLeftHint ?? 'Cadastre o estoque em kg ou sacos para saber em quantos dias acaba.')}
                </p>
              )}
              {detail.dailyUseKg == null && detail.daysLeftHint && (
                <p className="mb-4 rounded-lg bg-gray-50 p-3 text-sm text-gray-700">{t(detail.daysLeftHint)}</p>
              )}

              {detail.id.startsWith('pending_') ? (
                <p className="mb-4 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{t('Cadastrado sem internet, aguardando envio. Entradas e saídas ficam disponíveis depois que ele for enviado.')}</p>
              ) : (
                <PriceLine supply={detail} farmId={farmId} canEdit={canEdit && !isPendingId(detail.id)} onSaved={(updated, queued) => { setDetail({ ...detail, ...updated }); setNotice(queued ? t(net.queuedMessage) : ''); refreshPending(); reload() }} />
              )}

              {detail.movements.length > 0 && (
                <>
                  <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">{t('Últimas movimentações')}</h3>
                  <div className="rounded-xl border border-gray-100 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                          <SortTh label={t('Data')} sortKey="date" sort={movementSort} className="px-3 py-2 text-left" />
                          <SortTh label={t('Tipo')} sortKey="type" sort={movementSort} className="px-3 py-2 text-left" />
                          <SortTh label={t('Qtd')} sortKey="quantity" sort={movementSort} align="right" className="px-3 py-2 text-right" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {sortedMovements.map(m => (
                          <tr key={m.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-600">{fmt(m.date)}{m.id.startsWith('pending_') && <span className="block text-xs text-blue-700">{t('a enviar')}</span>}</td>
                            <td className="px-3 py-2">
                              <span className={`text-xs font-medium ${m.type === 'Entrada' ? 'text-green-600' : 'text-red-500'}`}>{t(m.type)}</span>
                            </td>
                            <td className={`px-3 py-2 text-right font-medium ${m.type === 'Entrada' ? 'text-green-600' : 'text-red-500'}`}>
                              {m.type === 'Entrada' ? '+' : '-'}{m.quantity} {t(detail.unit)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
        </AppModal>
      )}

      {/* Movimentação: modal padrão (pequeno), salva sozinha enquanto a pessoa preenche */}
      {showMov && detail && (
        <AppModal title={t('Movimentação')} subtitle={`${detail.name} · ${t('saldo atual')} ${detail.currentQuantity} ${t(detail.unit)}`}
          onClose={() => void closeMov()} icon={<EstoqueIcon className="h-6 w-6" />} tone="amber" size="sm"
          footer={<>
            {movSaved ? (
              <>
                <button type="button" onClick={() => void undoMov()} className={`${modalButton.ghost} border-red-200 text-red-600 hover:bg-red-50`}>{t('Desfazer')}</button>
                <button type="button" onClick={resetMov} className={modalButton.ghost}>{t('Lançar outra')}</button>
              </>
            ) : (
              <button type="button" onClick={() => { setShowMov(false); resetMov() }} className={modalButton.ghost}>{t('Cancelar')}</button>
            )}
            <button type="button" onClick={() => void closeMov()} className={modalButton.primary}>{t('Concluir')}</button>
          </>}
          note={t('Salva sozinho enquanto você preenche.')}>
              <form onSubmit={e => { e.preventDefault(); void saveMov() }} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="mov-type" className="text-sm font-medium text-gray-700">{t('Tipo')} *</label>
                    <select id="mov-type" value={mov.type} onChange={e => setMov({ ...mov, type: e.target.value })} className={`${FIELD} bg-white`}>
                      <option value="Entrada">{t('Entrada')}</option>
                      <option value="Saída">{t('Saída')}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="mov-quantity" className="text-sm font-medium text-gray-700">{t('Quantidade')} ({t(detail.unit)}) *</label>
                    <input id="mov-quantity" type="number" inputMode="decimal" autoFocus value={mov.quantity} onChange={e => setMov({ ...mov, quantity: e.target.value })} step="0.01" min="0" required
                      placeholder={t('Ex.: 25')} className={FIELD} />
                  </div>
                </div>
                <div>
                  <label htmlFor="mov-date" className="text-sm font-medium text-gray-700">{t('Data')} *</label>
                  <input id="mov-date" type="date" value={mov.date} onChange={e => setMov({ ...mov, date: e.target.value })} required className={FIELD} />
                </div>
                <div>
                  <label htmlFor="mov-description" className="text-sm font-medium text-gray-700">{t('Descrição')}</label>
                  <input id="mov-description" type="text" value={mov.description} onChange={e => setMov({ ...mov, description: e.target.value })}
                    placeholder={t('Ex.: compra na cooperativa')} className={FIELD} />
                </div>
                <p role="status" className={`text-sm min-h-[1.25rem] ${movStatus === 'error' ? 'text-red-600' : movStatus === 'saved' ? 'text-green-700' : movStatus === 'offline' ? 'text-blue-800' : 'text-gray-500'}`}>
                  {movStatus === 'saving' ? t('Salvando…')
                    : movStatus === 'saved' ? t('Salvo. Pode corrigir os campos ou desfazer.')
                    : movStatus === 'offline' ? t('Salvo no celular. Será enviado quando houver internet.')
                    : movStatus === 'error' ? movError
                    : t('Informe a quantidade: o lançamento é salvo sozinho.')}
                </p>
                {/* Entrada salva no servidor: oferece lançar a compra no financeiro, ligada a ela */}
                {movStatus === 'saved' && mov.type === 'Entrada' && savedRef.current.id && canAccess('financeiro') && (
                  <PurchaseAfterEntry key={savedRef.current.id} supply={detail} movementId={savedRef.current.id} quantity={parseMovement(mov)?.quantity ?? 0} date={mov.date} description={mov.description} />
                )}
              </form>
        </AppModal>
      )}

      {/* Cadastrar produto: modal padrão (médio) */}
      {showNew && (
        <AppModal title={t('Cadastrar produto')} subtitle={user?.farmName ?? undefined} onClose={() => setShowNew(false)}
          icon={<EstoqueIcon className="h-6 w-6" />} tone="amber"
          footer={<>
            <button type="button" onClick={() => setShowNew(false)} className={modalButton.ghost}>{t('Cancelar')}</button>
            <button type="submit" form="form-produto" disabled={saving} className={modalButton.primary}>{t(saving ? 'Salvando...' : 'Salvar')}</button>
          </>}
          note={t('Com o preço, o trato dos lotes mostra o custo por animal. Pode deixar em branco.')}>
              <form id="form-produto" onSubmit={handleSaveNew} className="flex flex-col gap-4">
                <label className="text-sm font-medium text-gray-700">{t('Nome')} *
                  <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required placeholder={t('Ex: Ração Bovinos')} className={FIELD} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-gray-700">{t('Categoria')} *
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className={`${FIELD} bg-white`}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{t(c)}</option>)}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-gray-700">{t('Unidade')} *
                    <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className={`${FIELD} bg-white`}>
                      {['kg', 'L', 'unidades', 'doses', 'sacos'].map(u => <option key={u} value={u}>{t(u)}</option>)}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-gray-700">{t('Qtd Inicial')}
                    <input type="text" inputMode="decimal" value={form.currentQuantity} onChange={e => setForm({ ...form, currentQuantity: keepNumberChars(e.target.value) })} placeholder={t('Ex.: 100')} className={FIELD} />
                  </label>
                  <label className="text-sm font-medium text-gray-700">{t('Qtd Mínima')}
                    <input type="text" inputMode="decimal" value={form.minimumQuantity} onChange={e => setForm({ ...form, minimumQuantity: keepNumberChars(e.target.value) })} placeholder={t('Ex.: 30')} className={FIELD} />
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-gray-700">{t('Preço por {u} (R$, opcional)', { u: t(form.unit === 'sacos' ? 'saco' : form.unit) })}
                    <input inputMode="decimal" value={form.unitPrice} onChange={e => setForm({ ...form, unitPrice: e.target.value.replace(/[^\d.,]/g, '') })} placeholder={t('Ex.: 85,00')} className={FIELD} />
                  </label>
                  <label className="text-sm font-medium text-gray-700">{t('Validade (opcional)')}
                    <input type="date" value={form.expiryDate} onChange={e => setForm({ ...form, expiryDate: e.target.value })} className={FIELD} />
                  </label>
                  {form.unit === 'sacos' && (
                    <label className="text-sm font-medium text-gray-700">{t('Peso do saco (kg, opcional)')}
                      <input inputMode="decimal" value={form.packageKg} onChange={e => setForm({ ...form, packageKg: e.target.value.replace(/[^\d.,]/g, '') })} placeholder={t('Ex.: 25')} className={FIELD} />
                    </label>
                  )}
                </div>
                {saveError && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{saveError}</p>}
              </form>
        </AppModal>
      )}
      {quoteFor && <RequestQuote item={quoteFor} onClose={() => setQuoteFor(null)} />}
    </div>
    </PermissionGuard>
  )
}

/** Preço por unidade e peso do saco (opcionais): com eles o trato dos lotes mostra o custo */
function PriceLine({ supply, farmId, canEdit, onSaved }: { supply: Supply; farmId: string; canEdit: boolean; onSaved: (s: Partial<Supply>, queued: boolean) => void }) {
  const t = useT()
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState(supply.unitPrice ? String(supply.unitPrice).replace('.', ',') : '')
  const [bag, setBag] = useState(supply.packageKg ? String(supply.packageKg).replace('.', ',') : '')
  const [expiry, setExpiry] = useState(supply.expiryDate ? supply.expiryDate.slice(0, 10) : '')
  const [error, setError] = useState('')
  const unitName = t(supply.unit === 'sacos' ? 'saco' : supply.unit)

  async function save() {
    setError('')
    // Números já convertidos: sem internet o pedido fica na fila e a lista mostra estes valores até o envio
    const body = { unitPrice: parseDec(price), expiryDate: expiry || null, ...(supply.unit === 'sacos' && { packageKg: parseDec(bag) }) }
    const r = await sendOrQueue<{ unitPrice?: number | null; packageKg?: number | null; expiryDate?: string | null }>(MODULE, { type: 'update', id: supply.id, url: `/api/estoque/${supply.id}`, method: 'PUT', body, local: { farmId } })
    if (r.status === 'rejected') return setError(t(r.error))
    if (r.status === 'sent') onSaved({ unitPrice: r.data.unitPrice ?? null, packageKg: r.data.packageKg ?? null, expiryDate: r.data.expiryDate ?? null }, false)
    else onSaved({ unitPrice: body.unitPrice, expiryDate: body.expiryDate, packageKg: 'packageKg' in body ? body.packageKg ?? null : supply.packageKg }, true)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="mb-4 rounded-lg border border-gray-100 p-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs font-medium text-gray-600">{t('Preço por {u} (R$)', { u: unitName })}
            <input inputMode="decimal" value={price} onChange={e => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} placeholder={t('Ex.: 85,00')} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
          {supply.unit === 'sacos' && (
            <label className="text-xs font-medium text-gray-600">{t('Peso do saco (kg)')}
              <input inputMode="decimal" value={bag} onChange={e => setBag(e.target.value.replace(/[^\d.,]/g, ''))} placeholder={t('Ex.: 25')} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </label>
          )}
          <label className="text-xs font-medium text-gray-600">{t('Validade')}
            <input type="date" value={expiry} onChange={e => setExpiry(e.target.value)} className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </label>
        </div>
        <p className="mt-1 text-xs text-gray-500">{t('Opcional. Deixe em branco para não usar.')}</p>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
        <div className="mt-2 flex gap-2">
          <button type="button" onClick={() => setEditing(false)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg">{t('Cancelar')}</button>
          <button type="button" onClick={() => void save()} className="flex-1 bg-green-800 hover:bg-green-700 text-white text-sm font-medium py-2 rounded-lg">{t('Salvar')}</button>
        </div>
      </div>
    )
  }
  return (
    <p className="mb-4 text-sm text-gray-600">
      {supply.unitPrice ? <>{t('Preço:')} <strong className="text-gray-800">{fmtMoney(supply.unitPrice)}</strong> {t('por {u}', { u: unitName })}</> : t('Sem preço informado')}
      {supply.unit === 'sacos' && supply.packageKg ? ` · ${t('saco de {n} kg', { n: supply.packageKg })}` : ''}
      {supply.expiryDate ? ` · ${t('validade {date}', { date: fmtDay(supply.expiryDate) })}` : ''}
      {canEdit && <button type="button" onClick={() => setEditing(true)} className="ml-2 font-semibold text-green-700 underline">{t(supply.unitPrice || supply.expiryDate ? 'Alterar' : 'Informar preço e validade')}</button>}
    </p>
  )
}

/** Aviso de validade na lista: vencido em vermelho, vencendo em até 30 dias em laranja */
function ExpiryNote({ supply }: { supply: Supply }) {
  const t = useT()
  const days = daysToExpiry(supply)
  if (days === null || days > EXPIRY_WARNING_DAYS) return null
  return (
    <span className={`block text-xs font-medium ${days < 0 ? 'text-red-700' : 'text-amber-700'}`}>
      {days < 0 ? t('Venceu em {date}', { date: fmtDay(supply.expiryDate!) }) : days === 0 ? t('Vence hoje') : t('Vence em {date}', { date: fmtDay(supply.expiryDate!) })}
    </span>
  )
}

/** Depois de salvar uma entrada: lança a compra no financeiro como despesa, ligada à entrada (valor sugerido pelo preço) */
function PurchaseAfterEntry({ supply, movementId, quantity, date, description }: {
  supply: { name: string; unit: string; category: string; unitPrice?: number | null }
  movementId: string
  quantity: number
  date: string
  description: string
}) {
  const t = useT()
  const suggested = suggestedAmount(quantity, supply.unitPrice)
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState(suggested ? suggested.toFixed(2).replace('.', ',') : '')
  const [paid, setPaid] = useState(false)
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function launch() {
    setState('saving')
    try {
      const res = await fetchWithTimeout('/api/financeiro', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'Despesa', category: expenseCategoryFor(supply.category), date, amount: amount.includes(',') ? amount.replace(/\./g, '').replace(',', '.') : amount, paid,
          description: description.trim() || purchaseDescription(supply.name, quantity, supply.unit), supplyMovementId: movementId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível lançar a compra.')
      setState('done')
      setMessage(t(paid ? 'Despesa lançada no financeiro como paga.' : 'Despesa lançada no financeiro como a pagar.'))
    } catch (err) {
      setState('error')
      setMessage(t(navigator.onLine ? (err as Error).message : 'Sem internet. Tente de novo quando a conexão voltar.'))
    }
  }

  if (state === 'done') return <p className="rounded-lg bg-green-50 px-3 py-2 text-sm font-medium text-green-800">✓ {message}</p>
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="rounded-lg border-2 border-green-700 px-3 py-2 text-sm font-semibold text-green-800 hover:bg-green-50">
        {t('Lançar a compra no financeiro')}
      </button>
    )
  }
  return (
    <div className="rounded-xl border border-green-200 bg-green-50 p-3">
      <p className="mb-2 text-sm font-semibold text-green-900">{t('Lançar a compra no financeiro')}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs font-medium text-gray-700">{t('Valor da compra (R$)')}
          <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d,.]/g, ''))} placeholder="0,00"
            className="mt-1 block w-36 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm" />
        </label>
        <label className="flex items-center gap-2 pb-2 text-sm font-medium text-gray-700">
          <input type="checkbox" checked={paid} onChange={(e) => setPaid(e.target.checked)} className="h-5 w-5 accent-green-700" />{t('Já pago')}
        </label>
        <button type="button" disabled={state === 'saving' || !amount} onClick={() => void launch()} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:bg-gray-300">
          {t(state === 'saving' ? 'Salvando…' : 'Lançar despesa')}
        </button>
      </div>
      {!suggested && <p className="mt-2 text-xs text-gray-600">{t('Dica: com o preço por unidade no cadastro do produto, o valor vem calculado.')}</p>}
      {state === 'error' && <p role="alert" className="mt-2 text-sm text-red-700">{message}</p>}
    </div>
  )
}
