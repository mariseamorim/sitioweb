'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useDialog } from '@/components/DialogProvider'
import { ImagePicker } from '@/components/ImagePicker'
import { FecharIcon } from '@/components/ModuleIcons'
import { SUPPLY_CATEGORIES } from '@/lib/supplies'
import { fmtDate, fmtMoney } from '@/lib/reports'
import { todayISO, whatsappLink } from '@/lib/utils'
import { VendasTab } from './VendasTab'

interface Vendor {
  companyName: string
  contactName: string
  status: 'pendente' | 'aprovado' | 'bloqueado'
  inviteCode: string
  state: string | null
  city: string | null
  categories: string[]
}

interface FarmContact {
  name: string
  owner: string | null
  city: string | null
  state: string | null
  phone: string | null
}

interface SupplyRequest {
  id: string
  itemName: string
  category: string
  quantity: number | null
  unit: string | null
  note: string | null
  status: 'novo' | 'respondido' | 'fechado' | 'cancelado'
  reply: string | null
  replyPrice: number | null
  createdBy: string | null
  supplyId: string | null
  createdAt: string
  farm: FarmContact
}

interface ClientNeed extends FarmContact {
  farmId: string
  items: { name: string; category: string; unit: string; current: number; minimum: number }[]
}

interface Offer {
  id: string
  title: string
  description: string | null
  category: string
  price: number | null
  unit: string | null
  imageUrl: string | null
  reach: 'clientes' | 'regiao'
  validUntil: string
  isActive: boolean
  whatsappClicks: number
}

interface Client {
  id: string
  farmId: string
  name: string
  owner: string | null
  city: string | null
  state: string | null
  phone: string | null
  since: string
}

interface Panel {
  vendor: Vendor
  offers: Offer[]
  clients: Client[]
  offersThisWeek: number
  weeklyLimit: number
  requests: SupplyRequest[]
  needs: ClientNeed[]
  /** Vendas confirmadas no mês e contatos do WhatsApp ainda sem resposta */
  salesThisMonth: number
  contactsToConfirm: number
}

type Tab = 'pedidos' | 'precisando' | 'ofertas' | 'vendas' | 'clientes' | 'convidar'

const fmtQty = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
const place = (f: FarmContact) => [f.owner, [f.city, f.state].filter(Boolean).join('/')].filter(Boolean).join(' · ')

function inDays(n: number) {
  const d = new Date(todayISO())
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const OFFER_UNITS = ['Kg', 'Saco', 'Litro']
// Unidade antiga em minúsculas ("saco") vira a opção da lista ("Saco")
const matchUnit = (unit: string) => OFFER_UNITS.find((u) => u.toLowerCase() === unit.toLowerCase()) ?? unit
const EMPTY_FORM = { title: '', category: 'Ração', price: '', unit: '', description: '', imageUrl: '', reach: 'clientes', validUntil: '' }
const input = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'

export default function PainelFornecedorPage() {
  const { confirm } = useDialog()
  const [panel, setPanel] = useState<Panel | null>(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<Tab>('pedidos')
  const [editing, setEditing] = useState<Offer | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [copied, setCopied] = useState(false)

  function load() {
    fetch('/api/fornecedor')
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error)
        setPanel(data)
      })
      .catch((e: Error) => setLoadError(e.message || 'Não foi possível carregar o painel'))
  }

  useEffect(load, [])

  if (loadError) return <p className="mt-8 text-gray-500">{loadError}</p>
  if (!panel) return <p className="mt-8 text-gray-400 text-sm">Carregando...</p>

  const { vendor, offers, clients, requests, needs } = panel
  const newRequests = requests.filter((r) => r.status === 'novo').length
  const approved = vendor.status === 'aprovado'
  const today = todayISO()
  const inviteUrl = typeof window !== 'undefined' ? `${window.location.origin}/convite/${vendor.inviteCode}` : ''
  const activeOffers = offers.filter((o) => o.isActive && o.validUntil.slice(0, 10) >= today)
  const clicks = offers.reduce((s, o) => s + o.whatsappClicks, 0)
  const limitReached = panel.offersThisWeek >= panel.weeklyLimit

  function openForm(offer: Offer | 'new') {
    setFormError('')
    setEditing(offer)
    setForm(offer === 'new'
      ? { ...EMPTY_FORM, validUntil: inDays(14) }
      : {
          title: offer.title, category: offer.category, price: offer.price ? String(offer.price).replace('.', ',') : '',
          unit: matchUnit(offer.unit ?? ''), description: offer.description ?? '', imageUrl: offer.imageUrl ?? '',
          reach: offer.reach, validUntil: offer.validUntil.slice(0, 10),
        })
  }

  async function saveOffer(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setFormError('')
    try {
      const isNew = editing === 'new'
      const res = await fetch(isNew ? '/api/fornecedor/ofertas' : `/api/fornecedor/ofertas/${(editing as Offer).id}`, {
        method: isNew ? 'POST' : 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) return setFormError(data.error || 'Não foi possível salvar')
      setEditing(null)
      load()
    } catch {
      setFormError('Sem conexão. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  async function toggleOffer(offer: Offer) {
    await fetch(`/api/fornecedor/ofertas/${offer.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !offer.isActive }),
    })
    load()
  }

  async function deleteOffer(offer: Offer) {
    if (!(await confirm({ title: 'Excluir esta oferta?', message: offer.title, confirmLabel: 'Excluir', danger: true }))) return
    await fetch(`/api/fornecedor/ofertas/${offer.id}`, { method: 'DELETE' })
    load()
  }

  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const inviteMessage = `Olá! Uso o Anota Aí Agro para mostrar minhas ofertas de insumos. Cadastre seu sítio ou fazenda por este link e receba as promoções da ${vendor.companyName}: ${inviteUrl}`

  return (
    <div>
      {/* O cadastro (nome, telefone, senha e dados da empresa) fica em Meu cadastro: o atalho aqui evita procurar no menu */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-gray-900">{vendor.companyName}</h1>
          <p className="text-gray-500 text-sm mt-1">Painel do fornecedor · {vendor.contactName}</p>
        </div>
        <Link href="/perfil" className="inline-flex min-h-11 items-center rounded-xl border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
          Meu cadastro
        </Link>
      </div>

      {vendor.status === 'pendente' && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <p className="font-semibold">Cadastro em análise</p>
          <p className="text-sm mt-0.5">
            Você já pode convidar seus clientes. As ofertas poderão ser publicadas assim que o cadastro for aprovado.
          </p>
        </div>
      )}

      {/* Os cartões são o menu: cada um mostra o número e abre a sua seção (sem abas que arrastam para o lado) */}
      {/* div com role (não <nav>): o globals.css diminui o texto de "nav p", pensado para o menu lateral */}
      <div role="navigation" aria-label="Seções do painel" className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        {([
          ['pedidos', 'Pedidos novos', newRequests, newRequests > 0],
          ['precisando', 'Precisando repor', needs.length, needs.length > 0],
          ['ofertas', 'Ofertas ativas', activeOffers.length, false],
          ['vendas', 'Vendas no mês', panel.salesThisMonth, panel.contactsToConfirm > 0],
          ['clientes', 'Clientes', clients.length, false],
        ] as const).map(([target, label, value, highlight]) => {
          const active = tab === target
          return (
            <button key={target} type="button" onClick={() => setTab(target)} aria-current={active ? 'page' : undefined}
              className={`text-left rounded-xl border-2 p-3 sm:p-4 ${active ? 'border-green-700 bg-green-50' : highlight ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
              <p className={`text-sm ${active ? 'font-semibold text-green-800' : 'text-gray-600'}`}>{label}</p>
              <p className={`mt-1 text-2xl font-bold ${highlight ? 'text-amber-800' : 'text-gray-900'}`}>{value}</p>
            </button>
          )
        })}
        <button type="button" onClick={() => setTab('convidar')} aria-current={tab === 'convidar' ? 'page' : undefined}
          className={`col-span-2 lg:col-span-1 flex items-center justify-center rounded-xl border-2 p-3 text-sm font-semibold ${tab === 'convidar' ? 'border-green-700 bg-green-50 text-green-800' : 'border-dashed border-green-700 text-green-700 hover:bg-green-50'}`}>
          + Convidar clientes
        </button>
      </div>

      {tab === 'pedidos' && (
        requests.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <p>Nenhum pedido de orçamento ainda.</p>
            <p className="mt-1 text-sm">Quando um cliente pedir um produto pelo app, ele aparece aqui.</p>
          </div>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {requests.map((r) => <RequestCard key={r.id} request={r} vendorName={vendor.companyName} onChanged={load} />)}
          </ul>
        )
      )}

      {tab === 'precisando' && (
        <NeedsTab needs={needs} vendor={vendor} onChanged={load} />
      )}

      {tab === 'ofertas' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-sm text-gray-500">
              {limitReached
                ? 'Limite de ofertas novas da semana atingido. Você ainda pode editar ou reativar as existentes.'
                : 'Seus clientes são avisados no app quando você publica uma oferta.'}
              {' '}Ofertas novas na semana: {panel.offersThisWeek} de {panel.weeklyLimit} · {clicks} chamada{clicks === 1 ? '' : 's'} no WhatsApp.
            </p>
            <button type="button" onClick={() => openForm('new')} disabled={!approved || limitReached}
              className="bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
              + Nova oferta
            </button>
          </div>

          {offers.length === 0 ? (
            <p className="py-12 text-center text-gray-400">Nenhuma oferta publicada ainda.</p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {offers.map((o) => {
                const expired = o.validUntil.slice(0, 10) < today
                const status = expired ? 'Vencida' : o.isActive ? 'Ativa' : 'Pausada'
                return (
                  <li key={o.id} className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4">
                    {o.imageUrl && <img src={o.imageUrl} alt="" className="w-20 h-20 rounded-lg object-cover shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-gray-900">{o.title}</p>
                        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${
                          status === 'Ativa' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                        }`}>{status}</span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {o.category}
                        {o.price ? ` · ${fmtMoney(o.price)}${o.unit ? ` / ${o.unit.toLowerCase()}` : ''}` : ''}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Até {fmtDate(o.validUntil)} · {o.reach === 'regiao' ? `Clientes e região (${vendor.state ?? '—'})` : 'Só clientes'} · {o.whatsappClicks} chamada{o.whatsappClicks === 1 ? '' : 's'}
                      </p>
                      <div className="mt-3 flex gap-2 text-sm">
                        <button onClick={() => openForm(o)} className="font-medium text-green-700 hover:underline">Editar</button>
                        {!expired && (
                          <button onClick={() => toggleOffer(o)} className="font-medium text-gray-600 hover:underline">
                            {o.isActive ? 'Pausar' : 'Reativar'}
                          </button>
                        )}
                        <button onClick={() => deleteOffer(o)} className="font-medium text-red-600 hover:underline">Excluir</button>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}

      {tab === 'vendas' && (
        <VendasTab offers={offers.map((o) => ({ id: o.id, title: o.title, price: o.price }))} clients={clients.map((c) => ({ farmId: c.farmId, name: c.name }))} onChanged={load} />
      )}

      {tab === 'clientes' && (
        clients.length === 0 ? (
          <div className="py-12 text-center text-gray-500">
            <p>Nenhum cliente ainda.</p>
            <button onClick={() => setTab('convidar')} className="mt-2 font-medium text-green-700 hover:underline">Convidar meus clientes</button>
          </div>
        ) : (
          <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {clients.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{c.name}</p>
                  <p className="text-sm text-gray-500">
                    {[c.owner, [c.city, c.state].filter(Boolean).join('/')].filter(Boolean).join(' · ') || '—'} · desde {fmtDate(c.since)}
                  </p>
                </div>
                {c.phone && (
                  <a href={whatsappLink(c.phone, `Olá! Aqui é da ${vendor.companyName}.`)} target="_blank" rel="noopener noreferrer"
                    className="text-sm font-semibold text-green-700 border border-green-700 rounded-lg px-3 py-1.5 hover:bg-green-50">
                    WhatsApp
                  </a>
                )}
              </li>
            ))}
          </ul>
        )
      )}

      {tab === 'convidar' && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 max-w-2xl">
          <h2 className="text-lg font-semibold text-gray-900">Traga seus clientes</h2>
          <p className="mt-1 text-gray-600">
            Mande este link para seus clientes. Quem se cadastrar ou entrar por ele já fica com a {vendor.companyName} na lista de fornecedores
            e passa a ver suas ofertas.
          </p>
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input readOnly value={inviteUrl} onFocus={(e) => e.target.select()} className={`${input} bg-gray-50 text-sm`} />
            <button onClick={copyInvite} className="shrink-0 border-2 border-green-700 text-green-700 font-semibold px-4 py-2 rounded-lg hover:bg-green-50">
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <a href={`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`} target="_blank" rel="noopener noreferrer"
            className="mt-3 inline-flex items-center justify-center w-full sm:w-auto bg-green-700 hover:bg-green-600 text-white font-semibold px-5 py-3 rounded-lg">
            Enviar pelo WhatsApp
          </a>
          <p className="mt-4 text-sm text-gray-500">
            Código do convite: <span className="font-mono font-semibold text-gray-800">{vendor.inviteCode}</span>
          </p>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={saveOffer} className="p-5 sm:p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-gray-900">{editing === 'new' ? 'Nova oferta' : 'Editar oferta'}</h2>
                <button type="button" onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>

              <label className="text-sm font-medium text-gray-700">Produto *
                <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Ex.: Sal mineral 30 kg" className={`mt-1 ${input}`} />
              </label>
              <label className="text-sm font-medium text-gray-700">Categoria *
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`mt-1 ${input}`}>
                  {SUPPLY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm font-medium text-gray-700">Preço (R$)
                  <input inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value.replace(/[^\d.,]/g, '') })} placeholder="Opcional" className={`mt-1 ${input}`} />
                </label>
                <label className="text-sm font-medium text-gray-700">Por
                  <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className={`mt-1 ${input} bg-white`}>
                    <option value="">—</option>
                    {OFFER_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                    {/* Oferta antiga com unidade escrita à mão: mantém o valor até ser trocado */}
                    {form.unit && !OFFER_UNITS.some((u) => u.toLowerCase() === form.unit.toLowerCase()) && <option value={form.unit}>{form.unit}</option>}
                  </select>
                </label>
              </div>
              <label className="text-sm font-medium text-gray-700">Detalhes
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                  placeholder="Ex.: entrega grátis acima de 10 sacos" className={`mt-1 ${input} resize-none`} />
              </label>
              <label className="text-sm font-medium text-gray-700">Vale até *
                <input type="date" value={form.validUntil} min={today} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} required className={`mt-1 ${input}`} />
              </label>

              <fieldset>
                <legend className="text-sm font-medium text-gray-700 mb-1">Quem vê</legend>
                {[
                  ['clientes', 'Só meus clientes'],
                  ['regiao', `Meus clientes e produtores de ${vendor.state ?? 'meu estado'}`],
                ].map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2 py-1.5 text-base text-gray-700">
                    <input type="radio" name="reach" value={value} checked={form.reach === value} onChange={() => setForm({ ...form, reach: value })} className="w-4 h-4 accent-green-700" />
                    {label}
                  </label>
                ))}
                {form.reach === 'regiao' && (
                  <p className="text-xs text-gray-500">Produtores que não são seus clientes só são avisados se estiverem com esse insumo em falta.</p>
                )}
              </fieldset>

              <div>
                <p className="text-sm font-medium text-gray-700 mb-1">Foto</p>
                <ImagePicker value={form.imageUrl} onChange={(imageUrl) => setForm({ ...form, imageUrl })} />
              </div>

              {formError && <p className="text-sm text-red-600">{formError}</p>}

              <div className="flex gap-2">
                <button type="button" onClick={() => setEditing(null)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white font-semibold py-3 rounded-lg">
                  {saving ? 'Salvando...' : editing === 'new' ? 'Publicar' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const REQUEST_STATUS: Record<SupplyRequest['status'], { label: string; style: string }> = {
  novo: { label: 'Novo', style: 'bg-red-100 text-red-700' },
  respondido: { label: 'Respondido', style: 'bg-blue-100 text-blue-800' },
  fechado: { label: 'Atendido', style: 'bg-green-100 text-green-800' },
  cancelado: { label: 'Cancelado', style: 'bg-gray-100 text-gray-600' },
}

function RequestCard({ request: r, vendorName, onChanged }: { request: SupplyRequest; vendorName: string; onChanged: () => void }) {
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Resposta acabou de ser enviada: oferece avisar o cliente pelo WhatsApp com o mesmo texto
  const [sent, setSent] = useState<{ reply: string; price: number | null } | null>(null)
  const qty = r.quantity ? `${fmtQty(r.quantity)}${r.unit ? ` ${r.unit}` : ''}` : null
  // Mensagem solta do produtor (sem item do estoque): o "item" é o assunto
  const isMessage = !r.supplyId && !r.quantity
  const subjectText = isMessage ? `sua mensagem sobre ${r.itemName}` : `seu pedido de ${r.itemName}${qty ? ` (${qty})` : ''}`
  const status = REQUEST_STATUS[r.status]

  async function send(body: { reply?: string; replyPrice?: string; status?: string }) {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/fornecedor/pedidos/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Não foi possível salvar')
      setReplying(false)
      setSent(body.reply ? { reply: data.reply, price: data.replyPrice } : null)
      onChanged()
    } catch {
      setError('Sem conexão. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className={`bg-white rounded-xl border p-4 ${r.status === 'novo' ? 'border-red-200' : 'border-gray-200'}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{r.itemName}{qty && <span className="font-normal text-gray-600"> · {qty}</span>}</p>
          <p className="text-sm text-gray-500">{r.farm.name}{place(r.farm) && ` · ${place(r.farm)}`}</p>
        </div>
        <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${status.style}`}>{status.label}</span>
      </div>
      {r.note && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">{r.note}</p>}
      <p className="mt-1 text-xs text-gray-500">{isMessage ? 'Mensagem' : `${r.category} · pedido`} em {fmtDate(r.createdAt)}{r.createdBy ? ` por ${r.createdBy}` : ''}</p>

      {r.reply && !replying && (
        <p className="mt-2 text-sm text-blue-900">
          <span className="font-semibold">Sua resposta:</span> {r.reply}{r.replyPrice !== null && ` · ${fmtMoney(r.replyPrice)}`}
        </p>
      )}

      {sent && !replying && (
        <div role="status" className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-semibold text-green-900">Resposta enviada. O cliente vê no app, no sino e em Ofertas.</p>
          {r.farm.phone ? (
            <a href={whatsappLink(r.farm.phone, `Olá! Aqui é da ${vendorName}. Respondi ${subjectText} no Anota Aí Agro: ${sent.reply}${sent.price !== null ? ` Valor: ${fmtMoney(sent.price)}.` : ''}`)}
              target="_blank" rel="noopener noreferrer" onClick={() => setSent(null)}
              className="mt-2 flex w-full items-center justify-center bg-green-700 hover:bg-green-600 text-white text-sm font-semibold py-2.5 rounded-lg">
              Avisar o cliente pelo WhatsApp
            </a>
          ) : (
            <p className="mt-1 text-xs text-green-900">Este cliente não tem telefone cadastrado.</p>
          )}
          <button type="button" onClick={() => setSent(null)} className="mt-2 w-full text-sm font-medium text-gray-600 hover:underline">Agora não</button>
        </div>
      )}

      {replying ? (
        <div className="mt-3 flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">Resposta para o cliente
            <textarea value={reply} onChange={(e) => setReply(e.target.value)} rows={3} autoFocus
              placeholder="Ex.: Tenho sim. Entrego na quinta, frete grátis." className={`mt-1 ${input} resize-none`} />
          </label>
          <label className="text-sm font-medium text-gray-700">Preço total (R$)
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="Opcional" className={`mt-1 ${input}`} />
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setReplying(false)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-lg">Cancelar</button>
            <button type="button" disabled={saving || !reply.trim()} onClick={() => send({ reply, replyPrice: price })}
              className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg">
              {saving ? 'Enviando...' : 'Enviar resposta'}
            </button>
          </div>
        </div>
      ) : r.status !== 'cancelado' && (
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          {r.status !== 'fechado' && (
            <button type="button" onClick={() => { setReply(r.reply ?? ''); setPrice(r.replyPrice !== null ? String(r.replyPrice).replace('.', ',') : ''); setReplying(true) }}
              className="bg-green-700 hover:bg-green-600 text-white font-semibold px-3 py-2 rounded-lg">
              {r.reply ? 'Mudar resposta' : 'Responder'}
            </button>
          )}
          {r.farm.phone && (
            <a href={whatsappLink(r.farm.phone, `Olá! Aqui é da ${vendorName}. Recebi ${subjectText} pelo Anota Aí Agro.`)}
              target="_blank" rel="noopener noreferrer" className="border border-green-700 text-green-700 font-semibold px-3 py-2 rounded-lg hover:bg-green-50">
              WhatsApp
            </a>
          )}
          {r.status !== 'fechado' && (
            <button type="button" disabled={saving} onClick={() => send({ status: 'fechado' })} className="font-medium text-gray-600 hover:underline px-1">
              Marcar como atendido
            </button>
          )}
          {error && <p className="w-full text-sm text-red-600">{error}</p>}
        </div>
      )}
    </li>
  )
}

function NeedsTab({ needs, vendor, onChanged }: { needs: ClientNeed[]; vendor: Vendor; onChanged: () => void }) {
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<string[]>(vendor.categories)
  const [saving, setSaving] = useState(false)

  async function saveCategories() {
    setSaving(true)
    try {
      await fetch('/api/fornecedor', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ categories: selected }) })
      setEditing(false)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-700">
            <span className="font-semibold">O que você vende:</span>{' '}
            {vendor.categories.length ? vendor.categories.join(', ') : 'todas as categorias'}
          </p>
          {!editing && (
            <button type="button" onClick={() => { setSelected(vendor.categories); setEditing(true) }} className="text-sm font-semibold text-green-700 hover:underline">
              Alterar
            </button>
          )}
        </div>
        {editing && (
          <div className="mt-3">
            <div className="flex flex-wrap gap-2">
              {SUPPLY_CATEGORIES.map((c) => {
                const on = selected.includes(c)
                return (
                  <button key={c} type="button" aria-pressed={on} onClick={() => setSelected(on ? selected.filter((x) => x !== c) : [...selected, c])}
                    className={`px-3 py-2 rounded-full text-sm font-medium border ${on ? 'bg-green-700 border-green-700 text-white' : 'border-gray-300 text-gray-700 bg-white'}`}>
                    {c}
                  </button>
                )
              })}
            </div>
            <p className="mt-2 text-xs text-gray-500">Você só vê a falta destes produtos nos clientes. Nenhum marcado = todos.</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => setEditing(false)} className="border border-gray-200 text-gray-600 font-medium px-4 py-2 rounded-lg">Cancelar</button>
              <button type="button" onClick={saveCategories} disabled={saving} className="bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold px-4 py-2 rounded-lg">
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        )}
      </div>

      {needs.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <p>Nenhum cliente com estoque baixo agora.</p>
          <p className="mt-1 text-sm">Aparecem aqui os clientes com {vendor.categories.length ? vendor.categories.join(', ').toLowerCase() : 'algum produto'} abaixo do mínimo que eles mesmos definiram.</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {needs.map((c) => {
            const list = c.items.map((i) => i.name.toLowerCase()).join(', ')
            return (
              <li key={c.farmId} className="bg-white rounded-xl border border-amber-200 p-4">
                <p className="font-semibold text-gray-900">{c.name}</p>
                {place(c) && <p className="text-sm text-gray-500">{place(c)}</p>}
                <ul className="mt-2 space-y-1">
                  {c.items.map((i) => (
                    <li key={i.name} className="flex justify-between gap-3 text-sm">
                      <span className="text-gray-800">{i.name} <span className="text-xs text-gray-500">({i.category})</span></span>
                      <span className="shrink-0 font-semibold text-amber-800">{fmtQty(i.current)} de {fmtQty(i.minimum)} {i.unit}</span>
                    </li>
                  ))}
                </ul>
                {c.phone ? (
                  <a href={whatsappLink(c.phone, `Olá! Aqui é da ${vendor.companyName}. Posso ajudar com a reposição de ${list}? Tenho para entrega.`)}
                    target="_blank" rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
                    Oferecer pelo WhatsApp
                  </a>
                ) : (
                  <p className="mt-3 text-xs text-gray-500">Cliente sem telefone cadastrado. Publique uma oferta: ele vê no app.</p>
                )}
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-4 text-xs text-gray-500">Cada cliente pode deixar de mostrar o estoque para você quando quiser.</p>
    </div>
  )
}
