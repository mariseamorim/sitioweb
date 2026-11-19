'use client'

// Estoque do próprio veterinário (medicamentos, sêmen, material), separado do estoque das propriedades:
// itens com saldo, mínimo e validade, e entradas e saídas com a propriedade onde foi usado.
import { useCallback, useEffect, useState } from 'react'
import { BackLink } from '@/components/BackLink'
import { useDialog } from '@/components/DialogProvider'
import { todayISO } from '@/lib/utils'

interface Move { id: string; type: string; quantity: number; date: string; farmName: string | null; note: string | null }
interface Supply { id: string; name: string; unit: string; quantity: number; minimum: number | null; expiry: string | null; moves: Move[] }
interface ItemForm { id?: string; name: string; unit: string; quantity: string; minimum: string; expiry: string }
interface MoveForm { supply: Supply; type: 'entrada' | 'saida'; quantity: string; date: string; farmName: string; note: string }

const input = 'mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
const num = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
const DAY = 24 * 60 * 60 * 1000
/** Validade a menos disso aparece como aviso */
const EXPIRY_WARNING_DAYS = 30

export default function EstoqueVeterinarioPage() {
  const { confirm, notify } = useDialog()
  const [supplies, setSupplies] = useState<Supply[] | null>(null)
  const [item, setItem] = useState<ItemForm | null>(null)
  const [move, setMove] = useState<MoveForm | null>(null)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const today = todayISO()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/veterinario/estoque')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || 'Não foi possível carregar o estoque.')
      setSupplies(data)
    } catch {
      setError('Sem internet. O estoque precisa de conexão.')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  async function send(url: string, method: 'POST' | 'PATCH', body: unknown, done: () => void) {
    setFormError('')
    setSaving(true)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) return setFormError((await res.json().catch(() => ({}))).error || 'Não foi possível salvar.')
      done()
      await load()
    } catch {
      setFormError('Erro de conexão. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function remove(s: Supply) {
    if (!(await confirm({ title: `Tirar ${s.name} do estoque?`, message: 'O item e o histórico de entradas e saídas dele são apagados.', confirmLabel: 'Apagar item' }))) return
    const res = await fetch(`/api/veterinario/estoque/${s.id}`, { method: 'DELETE' })
    if (!res.ok) return notify('Não foi possível apagar', (await res.json().catch(() => ({}))).error)
    await load()
  }

  /** Aviso do item: acabou, abaixo do mínimo, vencido ou perto de vencer */
  function warning(s: Supply): { text: string; tone: string } | null {
    if (s.expiry && s.expiry.slice(0, 10) < today) return { text: `Vencido em ${day(s.expiry)}`, tone: 'bg-red-100 text-red-800' }
    if (s.quantity <= 0) return { text: 'Acabou', tone: 'bg-red-100 text-red-800' }
    if (s.minimum !== null && s.quantity <= s.minimum) return { text: 'Abaixo do mínimo', tone: 'bg-amber-100 text-amber-900' }
    if (s.expiry && (Date.parse(s.expiry.slice(0, 10)) - Date.parse(today)) / DAY <= EXPIRY_WARNING_DAYS) return { text: `Vence em ${day(s.expiry)}`, tone: 'bg-amber-100 text-amber-900' }
    return null
  }

  const alerts = supplies?.filter((s) => warning(s)).length ?? 0

  return (
    <div className="max-w-3xl">
      <BackLink href="/consultoria" className="mb-2 -ml-2" />
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Meu estoque</h1>
          <p className="text-gray-500">{supplies ? `${supplies.length} ${supplies.length === 1 ? 'item' : 'itens'}${alerts ? ` · ${alerts} com aviso` : ''}` : 'Medicamentos, sêmen e material do veterinário'}</p>
        </div>
        <button type="button" onClick={() => { setFormError(''); setItem({ name: '', unit: 'un', quantity: '', minimum: '', expiry: '' }) }} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600">+ Novo item</button>
      </div>
      {error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {!supplies && !error && <p className="py-12 text-center text-gray-500">Carregando…</p>}
      {supplies?.length === 0 && <p className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500">Nenhum item ainda. Cadastre os medicamentos e materiais que você leva para as visitas.</p>}

      <ul className="flex flex-col gap-3">
        {supplies?.map((s) => {
          const w = warning(s)
          return (
            <li key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{s.name}</p>
                  <p className="text-sm text-gray-500">{[s.minimum !== null ? `mínimo ${num(s.minimum)} ${s.unit}` : null, s.expiry ? `validade ${day(s.expiry)}` : null].filter(Boolean).join(' · ') || 'Sem mínimo nem validade'}</p>
                  {w && <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${w.tone}`}>{w.text}</span>}
                </div>
                <p className="shrink-0 text-right"><span className="text-2xl font-bold text-gray-900">{num(s.quantity)}</span> <span className="text-sm text-gray-500">{s.unit}</span></p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => { setFormError(''); setMove({ supply: s, type: 'saida', quantity: '', date: today, farmName: '', note: '' }) }} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600">Saída (usei)</button>
                <button type="button" onClick={() => { setFormError(''); setMove({ supply: s, type: 'entrada', quantity: '', date: today, farmName: '', note: '' }) }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">Entrada (comprei)</button>
                <button type="button" onClick={() => { setFormError(''); setItem({ id: s.id, name: s.name, unit: s.unit, quantity: '', minimum: s.minimum === null ? '' : String(s.minimum).replace('.', ','), expiry: s.expiry?.slice(0, 10) ?? '' }) }} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">Editar</button>
                <button type="button" onClick={() => remove(s)} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">Apagar</button>
              </div>
              {s.moves.length > 0 && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-900">Últimas movimentações</summary>
                  <ul className="mt-1 divide-y divide-gray-100">
                    {s.moves.map((m) => <li key={m.id} className="py-1.5 text-gray-700">{day(m.date)} · {m.type === 'entrada' ? 'entrada de' : 'saída de'} {num(m.quantity)} {s.unit}{m.farmName ? ` · ${m.farmName}` : ''}{m.note ? ` · ${m.note}` : ''}</li>)}
                  </ul>
                </details>
              )}
            </li>
          )
        })}
      </ul>

      {item && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={item.id ? 'Editar item' : 'Novo item'}>
          <form className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void send(item.id ? `/api/veterinario/estoque/${item.id}` : '/api/veterinario/estoque', item.id ? 'PATCH' : 'POST', item, () => setItem(null)) }}>
            <h2 className="text-lg font-bold text-gray-900">{item.id ? 'Editar item' : 'Novo item'}</h2>
            <label className="text-sm font-medium text-gray-700">Nome *<input value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} required autoFocus placeholder="Prostaglandina, sêmen Touro X, luva…" className={input} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">Unidade<input value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} placeholder="un, ml, dose, frasco" maxLength={20} className={input} /></label>
              {!item.id && <label className="text-sm font-medium text-gray-700">Quantidade que tenho<input value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} inputMode="decimal" className={input} /></label>}
              <label className="text-sm font-medium text-gray-700">Avisar abaixo de<input value={item.minimum} onChange={(e) => setItem({ ...item, minimum: e.target.value })} inputMode="decimal" className={input} /></label>
              <label className="text-sm font-medium text-gray-700">Validade<input type="date" value={item.expiry} onChange={(e) => setItem({ ...item, expiry: e.target.value })} className={input} /></label>
            </div>
            {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setItem(null)} className="flex-1 rounded-lg border border-gray-300 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50">Fechar</button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-green-700 py-3 text-base font-semibold text-white hover:bg-green-600 disabled:bg-green-400">{saving ? 'Salvando…' : 'Salvar'}</button>
            </div>
          </form>
        </div>
      )}

      {move && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={move.type === 'saida' ? 'Saída do estoque' : 'Entrada no estoque'}>
          <form className="w-full max-w-lg rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void send(`/api/veterinario/estoque/${move.supply.id}/movimentos`, 'POST', { type: move.type, quantity: move.quantity, date: move.date, farmName: move.farmName, note: move.note }, () => setMove(null)) }}>
            <h2 className="text-lg font-bold text-gray-900">{move.type === 'saida' ? 'Saída' : 'Entrada'} — {move.supply.name}</h2>
            <p className="text-sm text-gray-500">Saldo: {num(move.supply.quantity)} {move.supply.unit}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">Quantidade ({move.supply.unit}) *<input value={move.quantity} onChange={(e) => setMove({ ...move, quantity: e.target.value })} required autoFocus inputMode="decimal" className={input} /></label>
              <label className="text-sm font-medium text-gray-700">Data<input type="date" value={move.date} onChange={(e) => setMove({ ...move, date: e.target.value })} className={input} /></label>
            </div>
            {move.type === 'saida' && <label className="text-sm font-medium text-gray-700">Propriedade onde usei<input value={move.farmName} onChange={(e) => setMove({ ...move, farmName: e.target.value })} className={input} /></label>}
            <label className="text-sm font-medium text-gray-700">Observação<input value={move.note} onChange={(e) => setMove({ ...move, note: e.target.value })} maxLength={300} className={input} /></label>
            {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
            <div className="flex gap-3">
              <button type="button" onClick={() => setMove(null)} className="flex-1 rounded-lg border border-gray-300 py-3 text-base font-semibold text-gray-700 hover:bg-gray-50">Fechar</button>
              <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-green-700 py-3 text-base font-semibold text-white hover:bg-green-600 disabled:bg-green-400">{saving ? 'Salvando…' : move.type === 'saida' ? 'Registrar saída' : 'Registrar entrada'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
