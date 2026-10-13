'use client'

import { useCallback, useEffect, useState } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { SUPPLY_CATEGORIES } from '@/lib/supplies'
import { membersOrdered, qtyWithUnit } from '@/lib/organizations'
import { currentMonthRange, todayISO, whatsappLink } from '@/lib/utils'
import { field, fmtDay, fmtL, send } from '@/app/laticinio/types'
import { PeriodPicker } from '@/app/laticinio/CollectionsSection'

interface Member {
  id: string
  name: string
  contact: string | null
  phone: string | null
  place: string | null
  kind: 'completa' | 'leite'
  status: 'ativo' | 'inativo'
  shareProduction: boolean
  liters: number | null
  since: string
}

interface Purchase {
  id: string
  title: string
  category: string
  unit: string
  description: string | null
  deadline: string | null
  status: 'aberta' | 'fechada'
  total: number
  orders: { id: string; memberId: string; quantity: number; note: string | null }[]
}

interface Panel {
  organization: { id: string; name: string; status: 'pendente' | 'aprovado' | 'bloqueado'; inviteCode: string }
  period: { from: string; to: string }
  members: Member[]
  purchases: Purchase[]
}

type Tab = 'associados' | 'producao' | 'compras' | 'convidar'
const fmtQty = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

// Painel da associação: associados, produção que eles compartilham e compras coletivas
export default function AssociacaoPage() {
  const { confirm } = useDialog()
  const [panel, setPanel] = useState<Panel | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('associados')
  const [period, setPeriod] = useState(() => ({ from: currentMonthRange().from, to: todayISO() }))
  const [form, setForm] = useState({ title: '', category: 'Ração', unit: 'Saco', description: '', deadline: '' })
  const [formError, setFormError] = useState('')
  const [creating, setCreating] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/associacao?from=${period.from}&to=${period.to}`)
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error)
        setPanel(data)
      })
      .catch((e: Error) => setError(e.message || 'Não foi possível carregar o painel'))
  }, [period])

  useEffect(load, [load])

  if (error) return <p className="mt-8 text-gray-500">{error}</p>
  if (!panel) return <p className="mt-8 text-gray-400 text-sm">Carregando...</p>

  const active = panel.members.filter((m) => m.status === 'ativo')
  const sharing = panel.members.filter((m) => m.shareProduction)
  const totalLiters = sharing.reduce((s, m) => s + (m.liters ?? 0), 0)
  const open = panel.purchases.filter((p) => p.status === 'aberta')
  const memberName = new Map(panel.members.map((m) => [m.id, m.name]))
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/associar/${panel.organization.inviteCode}` : ''
  const inviteMessage = `Olá! A ${panel.organization.name} está no Anota Aí Agro. Entre por este link para se associar: ${inviteUrl}`
  const approved = panel.organization.status === 'aprovado'

  async function setStatus(m: Member, status: Member['status']) {
    await send(`/api/associacao/associados/${m.id}`, 'PATCH', { status })
    load()
  }

  async function createPurchase(e: React.FormEvent) {
    e.preventDefault()
    setFormError('')
    const { ok, data } = await send('/api/associacao/compras', 'POST', form)
    if (!ok) return setFormError(data.error || 'Não foi possível criar')
    setCreating(false)
    setForm({ ...form, title: '', description: '', deadline: '' })
    load()
  }

  async function setPurchaseStatus(p: Purchase, status: Purchase['status']) {
    await send(`/api/associacao/compras/${p.id}`, 'PATCH', { status })
    load()
  }

  async function removePurchase(p: Purchase) {
    if (!(await confirm({ title: `Apagar a compra ${p.title}?`, message: 'Os pedidos dos associados saem junto.', confirmLabel: 'Apagar', danger: true }))) return
    await send(`/api/associacao/compras/${p.id}`, 'DELETE')
    load()
  }

  // Resumo para negociar com o fornecedor (vai pelo WhatsApp ou é copiado)
  const summary = (p: Purchase) => `Compra coletiva da ${panel.organization.name}: ${p.title} (${p.category}). Total: ${qtyWithUnit(p.total, p.unit)} de ${p.orders.length} associado${p.orders.length === 1 ? '' : 's'}.`

  const cards: [Tab, string, string][] = [
    ['associados', 'Associados ativos', String(active.length)],
    ['producao', 'Leite compartilhado no período', fmtL(totalLiters)],
    ['compras', 'Compras coletivas abertas', String(open.length)],
    ['convidar', 'Convidar produtores', '+'],
  ]

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{panel.organization.name}</h1>
        <p className="text-gray-500 text-sm mt-1">Painel da associação</p>
      </div>

      {!approved && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <p className="font-semibold">Cadastro em análise</p>
          <p className="text-sm mt-0.5">O link de convite passa a funcionar assim que o cadastro for aprovado.</p>
        </div>
      )}

      <div role="navigation" aria-label="Seções do painel" className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {cards.map(([target, label, value]) => {
          const isActive = tab === target
          return (
            <button key={target} type="button" onClick={() => setTab(target)} aria-current={isActive ? 'page' : undefined}
              className={`text-left rounded-xl border-2 p-3 sm:p-4 ${isActive ? 'border-green-700 bg-green-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
              <p className={`text-sm ${isActive ? 'font-semibold text-green-800' : 'text-gray-600'}`}>{label}</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
            </button>
          )
        })}
      </div>

      {tab === 'associados' && (
        panel.members.length === 0 ? (
          <div className="py-10 text-center text-gray-500">
            <p>Nenhum associado ainda.</p>
            <button type="button" onClick={() => setTab('convidar')} className="mt-2 font-semibold text-green-700 underline">Convidar produtores</button>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {panel.members.map((m) => (
              <li key={m.id} className={`rounded-xl border border-gray-200 bg-white p-4 ${m.status === 'ativo' ? '' : 'opacity-70'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{m.name}</p>
                    <p className="text-sm text-gray-600">{[m.contact !== m.name ? m.contact : null, m.place, m.phone].filter(Boolean).join(' · ') || '—'}</p>
                    <p className="text-xs text-gray-500">
                      {m.kind === 'completa' ? 'Versão completa' : 'Anota Aí Leite'} · desde {fmtDay(m.since)} · {m.shareProduction ? 'compartilha o leite' : 'não compartilha o leite'}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${m.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{m.status === 'ativo' ? 'Ativo' : 'Inativo'}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  {m.phone && <a href={whatsappLink(m.phone, `Olá! Aqui é da ${panel.organization.name}.`)} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-700 hover:underline">WhatsApp</a>}
                  <button type="button" onClick={() => setStatus(m, m.status === 'ativo' ? 'inativo' : 'ativo')} className="font-medium text-gray-600 hover:underline">
                    {m.status === 'ativo' ? 'Marcar como inativo' : 'Marcar como ativo'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'producao' && (
        <div>
          <PeriodPicker period={period} onPeriod={setPeriod} />
          <p className="mb-3 text-sm text-gray-600">
            <strong className="text-lg text-gray-900">{fmtL(totalLiters)}</strong> de {sharing.length} associado{sharing.length === 1 ? '' : 's'} que autorizaram mostrar o leite
            ({fmtDay(panel.period.from)} a {fmtDay(panel.period.to)}). Animais, financeiro e outros dados continuam privados.
          </p>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {[...panel.members].sort((a, b) => (b.liters ?? -1) - (a.liters ?? -1)).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="text-gray-800">{m.name}</span>
                {m.liters === null
                  ? <span className="text-xs text-gray-500">não compartilha</span>
                  : <span className="font-semibold text-gray-900">{fmtL(m.liters)}</span>}
              </li>
            ))}
            {panel.members.length === 0 && <li className="px-4 py-3 text-sm text-gray-500">Nenhum associado ainda.</li>}
          </ul>
        </div>
      )}

      {tab === 'compras' && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-600">Junte os pedidos dos associados para negociar um preço melhor com o fornecedor.</p>
            <button type="button" onClick={() => setCreating(true)} className="bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">+ Nova compra coletiva</button>
          </div>
          {creating && (
            <form onSubmit={createPurchase} className="mb-5 grid gap-3 rounded-xl border border-green-200 bg-green-50/40 p-4 sm:grid-cols-2">
              <label className="text-sm font-medium text-gray-700 sm:col-span-2">Produto *
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Ex.: Ração lactação 22%" className={`${field} bg-white`} />
              </label>
              <label className="text-sm font-medium text-gray-700">Categoria
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${field} bg-white`}>
                  {SUPPLY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">Unidade
                <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={`${field} bg-white`}>
                  {['Saco', 'Kg', 'Litro', 'Unidade', 'Dose'].map((u) => <option key={u}>{u}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">Prazo para pedir
                <input type="date" value={form.deadline} min={todayISO()} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={`${field} bg-white`} />
              </label>
              <label className="text-sm font-medium text-gray-700">Detalhes
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Ex.: entrega na sede da associação" className={`${field} bg-white`} />
              </label>
              {formError && <p className="text-sm text-red-600 sm:col-span-2">{formError}</p>}
              <div className="flex gap-2 sm:col-span-2">
                <button type="button" onClick={() => setCreating(false)} className="flex-1 border border-gray-300 bg-white text-gray-700 font-medium py-2.5 rounded-lg">Cancelar</button>
                <button type="submit" className="flex-1 bg-green-700 hover:bg-green-600 text-white font-semibold py-2.5 rounded-lg">Abrir compra</button>
              </div>
            </form>
          )}
          {panel.purchases.length === 0 ? (
            <p className="py-10 text-center text-gray-500">Nenhuma compra coletiva ainda.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {panel.purchases.map((p) => (
                <li key={p.id} className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{p.title}</p>
                      <p className="text-sm text-gray-600">{p.category}{p.deadline && ` · pedir até ${fmtDay(p.deadline)}`}{p.description && ` · ${p.description}`}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${p.status === 'aberta' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>{p.status === 'aberta' ? 'Aberta' : 'Fechada'}</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold text-green-800">{qtyWithUnit(p.total, p.unit)}</p>
                  <p className="text-sm text-gray-600">{p.orders.length ? membersOrdered(p.orders.length) : 'Nenhum pedido ainda'}</p>
                  {p.orders.length > 0 && (
                    <ul className="mt-2 space-y-0.5 text-sm text-gray-700">
                      {p.orders.map((o) => <li key={o.id} className="flex justify-between gap-2"><span>{memberName.get(o.memberId) ?? '—'}{o.note && <span className="text-gray-500"> · {o.note}</span>}</span><span className="font-semibold">{fmtQty(o.quantity)}</span></li>)}
                    </ul>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <a href={`https://wa.me/?text=${encodeURIComponent(summary(p))}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-700 hover:underline">Mandar resumo pelo WhatsApp</a>
                    <button type="button" onClick={() => setPurchaseStatus(p, p.status === 'aberta' ? 'fechada' : 'aberta')} className="font-medium text-gray-600 hover:underline">{p.status === 'aberta' ? 'Fechar pedidos' : 'Reabrir'}</button>
                    <button type="button" onClick={() => removePurchase(p)} className="font-medium text-red-600 hover:underline">Apagar</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'convidar' && (
        <div className="max-w-2xl rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-gray-900">Convide os produtores</h2>
          <p className="mt-1 text-gray-600">
            Quem entrar pelo link vira associado e escolhe se compartilha o total de leite. Serve para quem usa a versão completa e para quem usa só o Anota Aí Leite.
          </p>
          {!approved && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">O link funciona depois que o cadastro for aprovado.</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input readOnly value={inviteUrl} onFocus={(e) => e.target.select()} className={`${field} mt-0 bg-gray-50 text-sm`} />
            <button type="button" onClick={async () => { try { await navigator.clipboard.writeText(inviteUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {} }}
              className="shrink-0 border-2 border-green-700 text-green-700 font-semibold px-4 py-2 rounded-lg hover:bg-green-50">{copied ? 'Copiado' : 'Copiar'}</button>
          </div>
          <a href={`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`} target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex w-full items-center justify-center bg-green-700 hover:bg-green-600 text-white font-semibold px-5 py-3 rounded-lg sm:w-auto">Enviar pelo WhatsApp</a>
          <p className="mt-4 text-sm text-gray-500">Código do convite: <span className="font-mono font-semibold text-gray-800">{panel.organization.inviteCode}</span></p>
        </div>
      )}
    </div>
  )
}
