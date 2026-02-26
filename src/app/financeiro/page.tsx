'use client'

import { useEffect, useState, useMemo } from 'react'

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

export default function FinanceiroPage() {
  const now = new Date()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [farmId, setFarmId] = useState('')
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10))
  const [filterType, setFilterType] = useState('Todas')
  const [showRegister, setShowRegister] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ type: 'Receita', category: 'Venda de Leite', date: '', amount: '', description: '', animalId: '' })

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!data.farmId) return
      setFarmId(data.farmId)
      loadData(data.farmId)
    })
  }, [])

  function loadData(fid: string) {
    setLoading(true)
    Promise.all([
      fetch(`/api/financeiro?farmId=${fid}`).then(r => r.json()),
      fetch(`/api/animals?farmId=${fid}`).then(r => r.json()),
    ]).then(([txs, anims]) => {
      setTransactions(Array.isArray(txs) ? txs : [])
      setAnimals(Array.isArray(anims) ? anims : [])
      setLoading(false)
    })
  }

  const filtered = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date)
      if (from && d < new Date(from)) return false
      if (to && d > new Date(to + 'T23:59:59')) return false
      if (filterType !== 'Todas' && t.type !== filterType) return false
      return true
    })
  }, [transactions, from, to, filterType])

  const totalReceita = filtered.filter(t => t.type === 'Receita').reduce((s, t) => s + t.amount, 0)
  const totalDespesa = filtered.filter(t => t.type === 'Despesa').reduce((s, t) => s + t.amount, 0)
  const saldo = totalReceita - totalDespesa

  const byCategory = useMemo(() => {
    const map = new Map<string, number>()
    for (const t of filtered) map.set(t.category, (map.get(t.category) || 0) + t.amount)
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1])
  }, [filtered])

  const maxCat = byCategory[0]?.[1] || 1

  async function handleDelete(id: string) {
    if (!confirm('Excluir esta transação?')) return
    await fetch(`/api/financeiro/${id}`, { method: 'DELETE' })
    loadData(farmId)
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    await fetch('/api/financeiro', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, farmId, animalId: form.animalId || null, description: form.description || null }),
    })
    setSaving(false)
    setShowRegister(false)
    setForm({ type: 'Receita', category: 'Venda de Leite', date: '', amount: '', description: '', animalId: '' })
    loadData(farmId)
  }

  const cats = form.type === 'Receita' ? CATEGORIES_RECEITA : CATEGORIES_DESPESA
  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR')
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Financeiro</h1>
          <p className="text-gray-500 text-sm mt-1">Receitas e despesas da propriedade</p>
        </div>
        <button onClick={() => setShowRegister(true)} className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg">
          + Transação
        </button>
      </div>

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
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Receitas</p>
          <p className="text-xl font-bold text-green-600">{fmtBRL(totalReceita)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <p className="text-xs text-gray-500 mb-1">Despesas</p>
          <p className="text-xl font-bold text-red-500">{fmtBRL(totalDespesa)}</p>
        </div>
        <div className={`rounded-xl shadow-sm border p-4 ${saldo >= 0 ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs text-gray-500 mb-1">Saldo</p>
          <p className={`text-xl font-bold ${saldo >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtBRL(saldo)}</p>
        </div>
      </div>

      {/* Category bars */}
      {byCategory.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6">
          <p className="text-xs font-semibold text-gray-600 uppercase mb-3">Por categoria</p>
          <div className="space-y-2">
            {byCategory.map(([cat, val]) => (
              <div key={cat} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-28 shrink-0 truncate">{cat}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${(val / maxCat) * 100}%` }} />
                </div>
                <span className="text-xs font-medium text-gray-700 w-20 text-right shrink-0">{fmtBRL(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-4">
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
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Categoria</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left">Descrição</th>
                <th className="px-4 py-3 text-right">Valor</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(t => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-600">{fmt(t.date)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t.type === 'Receita' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t.category}</span>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-gray-500 text-xs">{t.description || (t.animal ? t.animal.name : '—')}</td>
                  <td className={`px-4 py-3 text-right font-semibold ${t.type === 'Receita' ? 'text-green-600' : 'text-red-500'}`}>
                    {t.type === 'Receita' ? '+' : '-'}{fmtBRL(t.amount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(t.id)} className="text-red-400 hover:text-red-600 p-1">
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Nova Transação</h2>
                <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
              </div>
              <form onSubmit={handleSave} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Tipo *</label>
                    <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value, category: e.target.value === 'Receita' ? 'Venda de Leite' : 'Medicamentos' })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                      <option>Receita</option>
                      <option>Despesa</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Categoria *</label>
                    <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                      {cats.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="text-xs font-medium text-gray-600">Animal (opcional)</label>
                  <select value={form.animalId} onChange={e => setForm({ ...form, animalId: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                    <option value="">— Nenhum —</option>
                    {animals.map(a => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
                  </select>
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
    </div>
  )
}
