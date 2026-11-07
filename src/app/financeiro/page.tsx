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
import { SemSinalIcon, SincronizarIcon, FecharIcon } from '@/components/ModuleIcons'

interface Animal { id: string; name: string; code: string }
interface Transaction {
  id: string
  type: string
  category: string
  date: string
  amount: number
  description?: string | null
  animal?: Animal | null
}

const CATEGORIES_RECEITA = ['Venda de Leite', 'Venda de Animal', 'Outros']
const CATEGORIES_DESPESA = ['Medicamentos', 'Ração', 'Vacinas', 'Mão de Obra', 'Outros']

const MODULE = 'financeiro'
const EMPTY_FORM = { type: 'Receita', category: 'Venda de Leite', date: todayISO(), amount: '', description: '', animalId: '' }

/** Lançamento guardado sem internet, como aparece na lista e nos totais. Registros antigos da fila têm os campos soltos, sem _body. */
function pendingTransaction(p: PendingRequest, animals: Animal[]): Transaction | null {
  if ((p._type ?? 'create') !== 'create') return null
  const b = (p._body ?? p) as Record<string, string | number | null | undefined>
  const date = String(b.date ?? '')
  return {
    id: pendingItemId(p), type: String(b.type ?? ''), category: String(b.category ?? ''),
    date: date.includes('T') ? date : `${date}T00:00:00.000Z`, amount: Number(b.amount) || 0,
    description: b.description ? String(b.description) : null,
    animal: animals.find(a => a.id === b.animalId) ?? null,
  }
}

/** Fila antiga (antes de cada pedido levar a própria URL): era sempre um POST com o lançamento solto */
const legacyRequest = (r: OfflineRecord): QueuedRequest => {
  const data = Object.fromEntries(Object.entries(r).filter(([k]) => k !== '_pendingId'))
  return { url: '/api/financeiro', method: 'POST', body: data }
}

export default function FinanceiroPage() {
  const { confirm } = useDialog()
  const { user } = useUser()
  const farmId = user?.farmId ?? ''
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [animals, setAnimals] = useState<Animal[]>([])
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

  // Lista e rebanho com cópia no aparelho; a fila (lançados e excluídos sem internet) entra por cima e nos totais
  const loadData = useCallback(async (fid: string) => {
    const [txs, herd] = await Promise.all([
      cachedGet<Transaction[]>(`cache_financeiro_${fid}`, `/api/financeiro?farmId=${fid}`).catch(() => null),
      loadHerd<Animal>(fid).catch(() => null),
    ])
    const anims = Array.isArray(herd?.data) ? herd.data : []
    const list = Array.isArray(txs?.data) ? txs.data : []
    setAnimals(anims)
    setTransactions(withPending(list, pendingOf(MODULE, p => p.farmId === fid), p => pendingTransaction(p, anims)))
    setFromCache(!!(txs?.fromCache || herd?.fromCache))
    setLoading(false)
  }, [])
  const reload = useCallback(() => { if (farmId) void loadData(farmId) }, [farmId, loadData])
  const net = useOfflineModule(MODULE, reload, legacyRequest)
  useEffect(() => { void Promise.resolve().then(reload) }, [reload])

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      if (!inDayRange(t.date, from, to)) return false
      if (filterType !== 'Todas' && t.type !== filterType) return false
      return true
    })
  }, [transactions, from, to, filterType])

  // Valor com sinal: despesa conta como negativa ao ordenar
  const { rows: sortedTransactions, sort } = useSort(filtered, {
    date: t => new Date(t.date), category: t => t.category, description: t => t.description || t.animal?.name || '',
    amount: t => (t.type === 'Receita' ? t.amount : -t.amount),
  })
  const totalReceita = filtered.filter(t => t.type === 'Receita').reduce((s, t) => s + t.amount, 0)
  const totalDespesa = filtered.filter(t => t.type === 'Despesa').reduce((s, t) => s + t.amount, 0)
  const saldo = totalReceita - totalDespesa

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of filtered) map.set(t.category, (map.get(t.category) || 0) + t.amount)
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [filtered])

  const maxCat = byCategory[0]?.[1] || 1

  // Depois de guardar ou enviar: a lista mostra na hora e a barra do topo atualiza a contagem
  const afterChange = (queued: boolean) => {
    setNotice(queued ? net.queuedMessage : '')
    net.refresh()
    reload()
  }

  async function handleDelete(id: string) {
    if (!(await confirm({ title: 'Excluir este lançamento?', confirmLabel: 'Excluir', danger: true }))) return
    if (isPendingId(id)) {
      // Ainda não foi enviado: sai da fila do aparelho
      removePendingRecord(MODULE, pendingIdOf(id))
      return afterChange(false)
    }
    const r = await sendOrQueue(MODULE, { type: 'delete', id, url: `/api/financeiro/${id}`, method: 'DELETE', local: { farmId } })
    if (r.status === 'rejected') setNotice(r.error)
    else afterChange(r.status === 'queued')
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
    }
    const r = await sendOrQueue(MODULE, { type: 'create', url: '/api/financeiro', method: 'POST', body, local: { farmId } })
    setSaving(false)
    if (r.status === 'rejected') return setSaveError(r.error)
    setShowRegister(false)
    setForm(EMPTY_FORM)
    afterChange(r.status === 'queued')
  }

  const cats = form.type === 'Receita' ? CATEGORIES_RECEITA : CATEGORIES_DESPESA
  // Datas gravadas à meia-noite UTC: mostrar em UTC para não cair no dia anterior no horário de Brasília
  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <PermissionGuard module="financeiro">
      <div>
      <div className="page-toolbar flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Financeiro</h1>
          <p className="text-gray-500 text-sm mt-1">Receitas e despesas da propriedade</p>
        </div>
        <button onClick={() => setShowRegister(true)} className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
          Anotar entrada ou saída
        </button>
      </div>

      {/* Sem internet / fila / aviso */}
      {(!net.online || fromCache) && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <SemSinalIcon className="w-5 h-5 shrink-0" />
          <span>{net.online ? 'Sinal fraco: mostrando a última cópia guardada neste aparelho.' : 'Sem internet.'} O que você anotar fica salvo no aparelho e é enviado quando a conexão voltar.</span>
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
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Até</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1">Receitas</p>
          <p className="text-lg sm:text-xl font-bold text-green-600 truncate">{fmtBRL(totalReceita)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4">
          <p className="text-xs text-gray-500 mb-1">Despesas</p>
          <p className="text-lg sm:text-xl font-bold text-red-500 truncate">{fmtBRL(totalDespesa)}</p>
        </div>
        <div className={`rounded-xl shadow-sm border p-3 sm:p-4 ${saldo >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs text-gray-500 mb-1">Saldo</p>
          <p className={`text-lg sm:text-xl font-bold truncate ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtBRL(saldo)}</p>
        </div>
      </div>

      {/* Category bars */}
      {byCategory.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 sm:p-4 mb-6">
          <p className="text-xs font-semibold text-gray-600 uppercase mb-3">Por categoria</p>
          <div className="space-y-2">
            {byCategory.map(([cat, val]) => (
              <div key={cat} className="flex items-center gap-2 sm:gap-3">
                <span className="text-xs text-gray-600 w-20 sm:w-28 shrink-0 truncate">{cat}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(val / maxCat) * 100}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-700 text-right shrink-0 whitespace-nowrap tabular-nums">{fmtBRL(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex flex-wrap gap-2 mb-4">
        {['Todas', 'Receita', 'Despesa'].map(s => (
          <button key={s} onClick={() => setFilterType(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterType === s ? 'bg-green-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* Transactions table */}
      {loading ? <p className="text-gray-400 text-sm">Carregando...</p> : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>Nenhuma transação no período</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <SortTh label="Data" sortKey="date" sort={sort} className="px-2 sm:px-4 py-2 sm:py-3 text-left" />
                <SortTh label="Categoria" sortKey="category" sort={sort} className="px-2 sm:px-4 py-2 sm:py-3 text-left" />
                <SortTh label="Descrição" sortKey="description" sort={sort} className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3 text-left" />
                <SortTh label="Valor" sortKey="amount" sort={sort} align="right" className="px-2 sm:px-4 py-2 sm:py-3 text-right" />
                <th className="px-2 sm:px-4 py-2 sm:py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedTransactions.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-gray-600 whitespace-nowrap">{fmt(t.date)}{isPendingId(t.id) && <span className="block text-xs text-blue-700">a enviar</span>}</td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium truncate inline-block ${t.type === 'Receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.category}</span>
                  </td>
                  <td className="hidden sm:table-cell px-2 sm:px-4 py-2 sm:py-3 text-gray-500 text-xs truncate">{t.description || (t.animal ? t.animal.name : '—')}</td>
                  <td className={`px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-xs sm:text-sm whitespace-nowrap ${t.type === 'Receita' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.type === 'Receita' ? '+' : '-'}{fmtBRL(t.amount)}
                  </td>
                  <td className="px-2 sm:px-4 py-2 sm:py-3 text-right">
                    <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-600 p-1" aria-label="Excluir lançamento">
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

      {/* Register modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Anotar entrada ou saída</h2>
                <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>
              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Tipo *</label>
                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, category: e.target.value === 'Receita' ? 'Venda de Leite' : 'Medicamentos', animalId: '' })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                      <option>Receita</option>
                      <option>Despesa</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Categoria *</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value, animalId: '' })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                      {cats.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Data *</label>
                    <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Valor (R$) *</label>
                    <input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} step="0.01" min="0" required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-600">Descrição</label>
                  <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                </div>
                {form.type === 'Receita' && form.category === 'Venda de Animal' && <div>
                  <label className="text-xs font-medium text-gray-600">Animal (opcional)</label>
                  <select value={form.animalId} onChange={e => setForm({ ...form, animalId: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                    <option value="">— Nenhum —</option>
                    {animals.map(a => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                  </select>
                  {!net.online && animals.length === 0 && (
                    <p className="text-xs text-gray-400 mt-1">Lista de animais ainda não guardada neste aparelho. Abra Animais com internet uma vez.</p>
                  )}
                </div>}
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
