'use client'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'
import { removePendingRecord, type OfflineRecord } from '@/lib/offlineStorage'
import { cachedGet, isPendingId, pendingIdOf, pendingItemId, pendingOf, sendOrQueue, withPending, type PendingRequest, type QueuedRequest } from '@/lib/offlineData'
import { useOfflineModule } from '@/lib/useOffline'
import { loadHerd } from '@/lib/herdCache'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { currentMonthRange, inDayRange, todayISO } from '@/lib/utils'
import { useSort } from '@/lib/useSort'
import { SortTh } from '@/components/SortTh'
import { SemSinalIcon, SincronizarIcon, FecharIcon, FinanceiroIcon } from '@/components/ModuleIcons'
import { useLocale, useT } from '@/lib/i18n'
import { StatTile } from '@/components/StatTile'
import { AppModal, modalButton } from '@/components/AppModal'
import { MilkResultPanel, SpendingAlerts, useMilkResult } from '@/components/MilkResult'

interface Animal { id: string; name: string; code: string }
interface Transaction {
  id: string
  type: string
  category: string
  date: string
  amount: number
  description?: string | null
  /** Já pago (despesa) ou recebido (receita); sem o campo (registro antigo) conta como pago */
  paid?: boolean
  animal?: Animal | null
  /** Lote de recria/engorda da despesa (entra no desempenho do lote) */
  lot?: { id: string; name: string } | null
}
/** Lote aberto, para ligar a despesa (mesma cópia do aparelho da tela de lotes) */
interface LotRef { id: string; name: string; endDate: string | null }

const CATEGORIES_RECEITA = ['Venda de Leite', 'Venda de Animal', 'Outros']
const CATEGORIES_DESPESA = ['Medicamentos', 'Ração', 'Vacinas', 'Mão de Obra', 'Outros']

// Cor fixa por categoria (etiqueta e barra); o nome da categoria sempre aparece escrito
const CATEGORY_COLOR: Record<string, { badge: string; bar: string }> = {
  'Venda de Leite': { badge: 'bg-sky-100 text-sky-800', bar: 'bg-gradient-to-r from-sky-500 to-cyan-400' },
  'Venda de Animal': { badge: 'bg-green-100 text-green-800', bar: 'bg-gradient-to-r from-green-600 to-teal-500' },
  'Medicamentos': { badge: 'bg-rose-100 text-rose-800', bar: 'bg-gradient-to-r from-rose-600 to-pink-400' },
  'Ração': { badge: 'bg-amber-100 text-amber-800', bar: 'bg-gradient-to-r from-orange-500 to-amber-400' },
  'Vacinas': { badge: 'bg-violet-100 text-violet-800', bar: 'bg-gradient-to-r from-violet-600 to-purple-400' },
  'Mão de Obra': { badge: 'bg-orange-100 text-orange-800', bar: 'bg-gradient-to-r from-orange-600 to-red-400' },
}
const OTHER_COLOR = { badge: 'bg-gray-100 text-gray-800', bar: 'bg-gradient-to-r from-slate-500 to-gray-400' }
const categoryColor = (c: string) => CATEGORY_COLOR[c] ?? OTHER_COLOR

const MODULE = 'financeiro'
const FIELD = 'mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base font-normal focus:outline-none focus:ring-2 focus:ring-green-600'
const EMPTY_FORM = { type: 'Receita', category: 'Venda de Leite', date: todayISO(), amount: '', description: '', animalId: '', lotId: '', paid: false, toStock: false, supplyId: '', stockQty: '' }

/** Lançamento guardado sem internet, como aparece na lista e nos totais. Registros antigos da fila têm os campos soltos, sem _body. */
function pendingTransaction(p: PendingRequest, animals: Animal[], lots: LotRef[] = []): Transaction | null {
  if ((p._type ?? 'create') !== 'create') return null
  const b = (p._body ?? p) as Record<string, string | number | null | undefined>
  const date = String(b.date ?? '')
  return {
    id: pendingItemId(p), type: String(b.type ?? ''), category: String(b.category ?? ''),
    date: date.includes('T') ? date : `${date}T00:00:00.000Z`, amount: Number(b.amount) || 0,
    description: b.description ? String(b.description) : null,
    paid: b.paid !== (false as unknown),
    animal: animals.find(a => a.id === b.animalId) ?? null,
    lot: b.lotId ? lots.find(l => l.id === b.lotId) ?? null : null,
  }
}

/** Fila antiga (antes de cada pedido levar a própria URL): era sempre um POST com o lançamento solto */
const legacyRequest = (r: OfflineRecord): QueuedRequest => {
  const data = Object.fromEntries(Object.entries(r).filter(([k]) => k !== '_pendingId'))
  return { url: '/api/financeiro', method: 'POST', body: data }
}

export default function FinanceiroPage() {
  const { confirm } = useDialog()
  const t = useT()
  const locale = useLocale()
  const { user, canAccess } = useUser()
  const farmId = user?.farmId ?? ''
  const [transactions, setTransactions] = useState<Transaction[]>([])
  // Resultado do leite e gastos acima do normal: recarrega depois de cada lançamento
  const [resultKey, setResultKey] = useState(0)
  const result = useMilkResult(true, resultKey)
  const [animals, setAnimals] = useState<Animal[]>([])
  const [lots, setLots] = useState<LotRef[]>([])
  // Lotes de recria/engorda só para quem vê o módulo Animais (a rota de lotes usa essa permissão)
  const canLots = canAccess('animais')
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [notice, setNotice] = useState('')
  const [saveError, setSaveError] = useState('')
  const [from, setFrom] = useState(() => currentMonthRange().from)
  const [to, setTo] = useState(() => currentMonthRange().to)
  const [filterType, setFilterType] = useState('Todas')
  const [showRegister, setShowRegister] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  // Despesa que também dá entrada no estoque (ração, remédio, vacina...)
  const canStock = canAccess('estoque') && (user?.role === 'admin' || user?.role === 'editor')
  const [stockItems, setStockItems] = useState<{ id: string; name: string; unit: string; category: string }[] | null>(null)
  const loadStock = () => { if (stockItems === null) fetch('/api/estoque').then(r => (r.ok ? r.json() : [])).then(l => setStockItems(Array.isArray(l) ? l : [])).catch(() => setStockItems([])) }

  // Lista e rebanho com cópia no aparelho; a fila (lançados e excluídos sem internet) entra por cima e nos totais
  const loadData = useCallback(async (fid: string) => {
    const [txs, herd, lotList] = await Promise.all([
      cachedGet<Transaction[]>(`cache_financeiro_${fid}`, `/api/financeiro?farmId=${fid}`).catch(() => null),
      loadHerd<Animal>(fid).catch(() => null),
      canLots ? cachedGet<LotRef[]>('cache_lotes_' + fid, '/api/lotes').catch(() => null) : Promise.resolve(null),
    ])
    const anims = Array.isArray(herd?.data) ? herd.data : []
    const list = Array.isArray(txs?.data) ? txs.data : []
    const lotRefs = Array.isArray(lotList?.data) ? lotList.data.map(l => ({ id: l.id, name: l.name, endDate: l.endDate })) : []
    setAnimals(anims)
    setLots(lotRefs)
    setTransactions(withPending(list, pendingOf(MODULE, p => p.farmId === fid), p => pendingTransaction(p, anims, lotRefs)))
    setFromCache(!!(txs?.fromCache || herd?.fromCache))
    setLoading(false)
  }, [canLots])
  const openLots = useMemo(() => lots.filter(l => !l.endDate), [lots])
  const reload = useCallback(() => { if (farmId) void loadData(farmId) }, [farmId, loadData])
  const net = useOfflineModule(MODULE, reload, legacyRequest)
  useEffect(() => { void Promise.resolve().then(reload) }, [reload])

  const filtered = useMemo(() => {
    return transactions.filter(tx => {
      if (!inDayRange(tx.date, from, to)) return false
      if (filterType !== 'Todas' && tx.type !== filterType) return false
      return true
    })
  }, [transactions, from, to, filterType])

  // Valor com sinal: despesa conta como negativa ao ordenar
  const { rows: sortedTransactions, sort } = useSort(filtered, {
    date: tx => new Date(tx.date), category: tx => tx.category, description: tx => tx.description || tx.animal?.name || '',
    amount: tx => (tx.type === 'Receita' ? tx.amount : -tx.amount),
  })
  const totalReceita = filtered.filter(tx => tx.type === 'Receita').reduce((s, tx) => s + tx.amount, 0)
  const totalDespesa = filtered.filter(tx => tx.type === 'Despesa').reduce((s, tx) => s + tx.amount, 0)
  const saldo = totalReceita - totalDespesa
  // Em aberto: despesas ainda não pagas e receitas ainda não recebidas
  const openDespesa = filtered.filter(tx => tx.type === 'Despesa' && tx.paid === false).reduce((s, tx) => s + tx.amount, 0)
  const openReceita = filtered.filter(tx => tx.type === 'Receita' && tx.paid === false).reduce((s, tx) => s + tx.amount, 0)

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const tx of filtered) map.set(tx.category, (map.get(tx.category) || 0) + tx.amount)
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [filtered])

  const maxCat = byCategory[0]?.[1] || 1

  // Depois de guardar ou enviar: a lista mostra na hora e a barra do topo atualiza a contagem
  const afterChange = (queued: boolean) => {
    setResultKey((k) => k + 1)
    setNotice(queued ? t(net.queuedMessage) : '')
    net.refresh()
    reload()
  }

  async function handleDelete(id: string) {
    if (!(await confirm({ title: t('Excluir este lançamento?'), confirmLabel: t('Excluir'), danger: true }))) return
    if (isPendingId(id)) {
      // Ainda não foi enviado: sai da fila do aparelho
      removePendingRecord(MODULE, pendingIdOf(id))
      return afterChange(false)
    }
    const r = await sendOrQueue(MODULE, { type: 'delete', id, url: `/api/financeiro/${id}`, method: 'DELETE', local: { farmId } })
    if (r.status === 'rejected') setNotice(t(r.error))
    else afterChange(r.status === 'queued')
  }

  /** Marca como pago/recebido ou em aberto (precisa de internet; sem sinal, fica na fila) */
  async function togglePaid(tx: Transaction) {
    if (isPendingId(tx.id)) return setNotice(t('Espere o lançamento ser enviado para mudar se foi pago.'))
    const paid = tx.paid === false
    setTransactions(list => list.map(x => (x.id === tx.id ? { ...x, paid } : x)))
    const r = await sendOrQueue(MODULE, { type: 'update', id: tx.id, url: `/api/financeiro/${tx.id}`, method: 'PATCH', body: { paid }, local: { farmId } })
    if (r.status === 'rejected') { setNotice(t(r.error)); reload() }
    else if (r.status === 'queued') setNotice(t(net.queuedMessage))
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    const body = {
      type: form.type,
      category: form.category,
      date: form.date,
      amount: parseFloat(form.amount),
      description: form.description || null,
      // Animal só na venda de animal; despesa não tem animal
      animalId: form.type === 'Receita' && form.category === 'Venda de Animal' ? form.animalId || null : null,
      // Lote só na despesa (entra nas despesas do desempenho do lote)
      lotId: form.type === 'Despesa' ? form.lotId || null : null,
      paid: form.paid,
      ...(form.type === 'Despesa' && form.toStock && form.supplyId ? { stock: { supplyId: form.supplyId, quantity: form.stockQty } } : {}),
    }
    if (form.type === 'Despesa' && form.toStock && (!form.supplyId || !(Number(form.stockQty.replace(',', '.')) > 0))) {
      setSaving(false)
      return setSaveError(t('Escolha o item do estoque e a quantidade'))
    }
    const r = await sendOrQueue(MODULE, { type: 'create', url: '/api/financeiro', method: 'POST', body, local: { farmId } })
    setSaving(false)
    if (r.status === 'rejected') return setSaveError(t(r.error))
    setShowRegister(false)
    setForm(EMPTY_FORM)
    afterChange(r.status === 'queued')
  }

  const cats = form.type === 'Receita' ? CATEGORIES_RECEITA : CATEGORIES_DESPESA
  // Datas gravadas à meia-noite UTC: mostrar em UTC para não cair no dia anterior no horário de Brasília
  const fmt = (d: string) => new Date(d).toLocaleDateString(locale, { timeZone: 'UTC' })
  const fmtBRL = (v: number) => v.toLocaleString(locale, { style: 'currency', currency: 'BRL' })

  return (
    <PermissionGuard module="financeiro">
      <div>
      <div className="page-toolbar flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('Financeiro')}</h1>
          <p className="text-gray-500 text-sm mt-1">{t('Receitas e despesas da propriedade')}</p>
        </div>
        <button onClick={() => setShowRegister(true)} className="bg-green-800 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-lg">
          {t('Anotar entrada ou saída')}
        </button>
      </div>

      {/* Sem internet / fila / aviso */}
      {(!net.online || fromCache) && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <SemSinalIcon className="w-5 h-5 shrink-0" />
          <span>{net.online ? t('Sinal fraco: mostrando a última cópia guardada neste aparelho.') : t('Sem internet.')} {t('O que você anotar fica salvo no aparelho e é enviado quando a conexão voltar.')}</span>
        </div>
      )}
      {net.online && net.pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><SincronizarIcon className="w-5 h-5 shrink-0" />{net.pendingCount > 1 ? t('{n} registros para enviar', { n: net.pendingCount }) : t('1 registro para enviar')}</span>
          <button
            onClick={() => void net.sync()}
            disabled={net.syncing}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
          >
            {t(net.syncing ? 'Enviando...' : 'Enviar agora')}
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-2">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-green-700 hover:text-green-900 p-1" aria-label={t('Fechar aviso')}><FecharIcon /></button>
        </div>
      )}

      {/* Period filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('De')}</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">{t('Até')}</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <StatTile accent="green" label={t('Receitas')} value={fmtBRL(totalReceita)} detail={openReceita ? t('{value} a receber', { value: fmtBRL(openReceita) }) : undefined} />
        <StatTile accent="red" label={t('Despesas')} value={fmtBRL(totalDespesa)} detail={openDespesa ? t('{value} a pagar', { value: fmtBRL(openDespesa) }) : undefined} />
        <StatTile accent={saldo >= 0 ? 'green' : 'red'} label={t('Saldo')} value={fmtBRL(saldo)} />
      </div>

      {/* Gastos acima do normal e resultado do leite (custo e sobra por litro) */}
      {result && <SpendingAlerts alerts={result.alerts} />}
      {result && <MilkResultPanel data={result} />}

      {/* Category bars */}
      {byCategory.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-6">
          <h2 className="text-sm font-semibold text-gray-800 mb-3">{t('Por categoria')}</h2>
          <div className="space-y-2">
            {byCategory.map(([cat, val]) => (
              <div key={cat} className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs sm:text-sm text-gray-700 w-24 sm:w-32 shrink-0 truncate">{t(cat)}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                  <div className={`${categoryColor(cat).bar} h-2.5 rounded-full`} style={{ width: `${(val / maxCat) * 100}%` }} />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-gray-800 text-right shrink-0 whitespace-nowrap tabular-nums">{fmtBRL(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['Todas', 'Receita', 'Despesa'].map(s => (
          <button key={s} onClick={() => setFilterType(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${filterType === s ? 'bg-green-800 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            {t(s)}
          </button>
        ))}
      </div>

      {/* Transactions table */}
      {loading ? <p className="text-gray-400 text-sm">{t('Carregando...')}</p> : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>{t('Nenhuma transação no período')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <SortTh label={t('Data')} sortKey="date" sort={sort} className="px-2 sm:px-4 py-2 sm:py-3 text-left" />
                <th className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3 text-left">{t('Tipo')}</th>
                <SortTh label={t('Categoria')} sortKey="category" sort={sort} className="px-2 sm:px-4 py-2 sm:py-3 text-left" />
                <SortTh label={t('Descrição')} sortKey="description" sort={sort} className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3 text-left" />
                <SortTh label={t('Valor')} sortKey="amount" sort={sort} align="right" className="px-2 sm:px-4 py-2 sm:py-3 text-right" />
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center">{t('Pago')}</th>
                <th className="px-2 sm:px-4 py-2 sm:py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedTransactions.map(tx => (
                <tr key={tx.id} className="hover:bg-gray-50">
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-600 whitespace-nowrap">{fmt(tx.date)}{isPendingId(tx.id) && <span className="block text-xs text-blue-700">{t('a enviar')}</span>}</td>
                  <td className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tx.type === 'Receita' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{t(tx.type)}</span>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold truncate inline-block max-w-full ${categoryColor(tx.category).badge}`}>{t(tx.category)}</span>
                  </td>
                  <td className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3 text-gray-500 text-xs truncate">
                    {tx.description || (tx.animal ? tx.animal.name : tx.lot ? '' : '—')}
                    {tx.lot && <span className={`${tx.description || tx.animal ? 'block ' : ''}text-gray-600`}>{t('Lote: {name}', { name: tx.lot.name })}</span>}
                  </td>
                  <td className={`px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-xs sm:text-sm whitespace-nowrap tabular-nums ${tx.type === 'Receita' ? 'text-green-700' : 'text-red-700'}`}>
                    {tx.type === 'Receita' ? '+' : '-'}{fmtBRL(tx.amount)}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                    {/* Polegar verde: pago/recebido; vermelho para baixo: em aberto. Tocar troca. */}
                    <button type="button" onClick={() => void togglePaid(tx)} className={`rounded-lg p-1.5 ${tx.paid === false ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                      aria-label={t(tx.paid === false ? (tx.type === 'Receita' ? 'A receber: marcar como recebido' : 'A pagar: marcar como pago') : (tx.type === 'Receita' ? 'Recebido: marcar como a receber' : 'Pago: marcar como a pagar'))}
                      title={t(tx.paid === false ? (tx.type === 'Receita' ? 'A receber' : 'A pagar') : (tx.type === 'Receita' ? 'Recebido' : 'Pago'))}>
                      <svg viewBox="0 0 24 24" className={`h-5 w-5 ${tx.paid === false ? 'rotate-180' : ''}`} fill="currentColor" aria-hidden="true">
                        <path d="M2 21h3V9H2v12zm20-11a2 2 0 0 0-2-2h-6.3l1-4.6v-.3c0-.4-.2-.8-.4-1.1L13.2 1 6.6 7.6C6.2 8 6 8.5 6 9v10a2 2 0 0 0 2 2h9c.8 0 1.5-.5 1.8-1.2l3-7.1c.1-.2.2-.5.2-.7v-2z" />
                      </svg>
                    </button>
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                    <button onClick={() => handleDelete(tx.id)} className="text-red-400 hover:text-red-600 p-1" aria-label={t('Excluir lançamento')}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Anotar entrada ou saída: modal padrão (médio) */}
      {showRegister && (
        <AppModal title={t('Anotar entrada ou saída')} subtitle={user?.farmName ?? undefined} onClose={() => setShowRegister(false)}
          icon={<FinanceiroIcon className="h-6 w-6" />} tone="blue"
          footer={<>
            <button type="button" onClick={() => setShowRegister(false)} className={modalButton.ghost}>{t('Cancelar')}</button>
            <button type="submit" form="form-financeiro" disabled={saving} className={modalButton.primary}>{t(saving ? 'Salvando...' : 'Salvar')}</button>
          </>}>
              <form id="form-financeiro" onSubmit={handleSave} className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-gray-700">{t('Tipo')} *
                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, category: e.target.value === 'Receita' ? 'Venda de Leite' : 'Medicamentos', animalId: '' })}
                      className={`${FIELD} bg-white`}>
                      <option value="Receita">{t('Receita')}</option>
                      <option value="Despesa">{t('Despesa')}</option>
                    </select>
                  </label>
                  <label className="text-sm font-medium text-gray-700">{t('Categoria')} *
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value, animalId: '' })}
                      className={`${FIELD} bg-white`}>
                      {cats.map(c => <option key={c} value={c}>{t(c)}</option>)}
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-sm font-medium text-gray-700">{t('Data')} *
                    <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required className={FIELD} />
                  </label>
                  <label className="text-sm font-medium text-gray-700">{t('Valor (R$)')} *
                    <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} step="0.01" min="0" required
                      placeholder={t('Ex.: 450,00')} className={FIELD} />
                  </label>
                </div>
                <label className="text-sm font-medium text-gray-700">{t('Descrição')}
                  <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder={t('Ex.: leite da quinzena, sal mineral')} className={FIELD} />
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={form.paid} onChange={e => setForm({ ...form, paid: e.target.checked })} className="h-5 w-5 accent-green-700" />
                  {t(form.type === 'Receita' ? 'Já recebido' : 'Já pago')}
                </label>
                {form.type === 'Despesa' && canStock && (
                  <div className="rounded-xl border border-gray-200 p-3">
                    <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                      <input type="checkbox" checked={form.toStock} onChange={e => { setForm({ ...form, toStock: e.target.checked }); if (e.target.checked) loadStock() }} className="h-5 w-5 accent-green-700" />
                      {t('Dar entrada no estoque')}
                    </label>
                    {form.toStock && (
                      <div className="mt-3 grid grid-cols-2 gap-3">
                        <label className="text-sm font-medium text-gray-700">{t('Item do estoque')} *
                          <select value={form.supplyId} onChange={e => setForm({ ...form, supplyId: e.target.value })} className={`${FIELD} bg-white`}>
                            <option value="">{stockItems === null ? t('Carregando…') : stockItems.length ? t('Escolha') : t('Nenhum item no estoque')}</option>
                            {(stockItems ?? []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        </label>
                        <label className="text-sm font-medium text-gray-700">{t('Quantidade')}{form.supplyId ? ` (${t(stockItems?.find(s => s.id === form.supplyId)?.unit ?? '')})` : ''} *
                          <input inputMode="decimal" value={form.stockQty} onChange={e => setForm({ ...form, stockQty: e.target.value.replace(/[^\d,.]/g, '') })} placeholder={t('Ex.: 25')} className={FIELD} />
                        </label>
                      </div>
                    )}
                  </div>
                )}
                {form.type === 'Receita' && form.category === 'Venda de Animal' && (
                  <label className="text-sm font-medium text-gray-700">{t('Animal (opcional)')}
                    <select value={form.animalId} onChange={e => setForm({ ...form, animalId: e.target.value })} className={`${FIELD} bg-white`}>
                      <option value="">{t('— Nenhum —')}</option>
                      {animals.map(a => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                    </select>
                    {!net.online && animals.length === 0 && (
                      <span className="mt-1 block text-xs font-normal text-gray-400">{t('Lista de animais ainda não guardada neste aparelho. Abra Animais com internet uma vez.')}</span>
                    )}
                  </label>
                )}
                {form.type === 'Despesa' && canLots && (
                  <label className="text-sm font-medium text-gray-700">{t('Lote (opcional)')}
                    <select value={form.lotId} onChange={e => setForm({ ...form, lotId: e.target.value })} className={`${FIELD} bg-white`}>
                      <option value="">{t('— Nenhum —')}</option>
                      {openLots.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                    <span className="mt-1 block text-xs font-normal text-gray-400">{t('A despesa entra no desempenho do lote, em Recria e engorda.')}</span>
                  </label>
                )}
                {saveError && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{saveError}</p>}
              </form>
        </AppModal>
      )}
    </div>
    </PermissionGuard>
  )
}
