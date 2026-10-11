'use client'

import { useEffect, useState } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { ImagePicker } from '@/components/ImagePicker'
import { FecharIcon } from '@/components/ModuleIcons'
import { SUPPLY_CATEGORIES } from '@/lib/supplies'
import { fmtDate, fmtMoney } from '@/lib/reports'
import { todayISO, whatsappLink } from '@/lib/utils'

interface Vendor {
  companyName: string
  contactName: string
  status: 'pendente' | 'aprovado' | 'bloqueado'
  inviteCode: string
  state: string | null
  city: string | null
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
}

type Tab = 'ofertas' | 'clientes' | 'convidar'

function inDays(n: number) {
  const d = new Date(todayISO())
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

const EMPTY_FORM = { title: '', category: 'Ração', price: '', unit: '', description: '', imageUrl: '', reach: 'clientes', validUntil: '' }
const input = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'

export default function PainelFornecedorPage() {
  const { confirm } = useDialog()
  const [panel, setPanel] = useState<Panel | null>(null)
  const [loadError, setLoadError] = useState('')
  const [tab, setTab] = useState<Tab>('ofertas')
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

  const { vendor, offers, clients } = panel
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
          unit: offer.unit ?? '', description: offer.description ?? '', imageUrl: offer.imageUrl ?? '',
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{vendor.companyName}</h1>
        <p className="text-gray-500 text-sm mt-1">Painel do fornecedor</p>
      </div>

      {vendor.status === 'pendente' && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <p className="font-semibold">Cadastro em análise</p>
          <p className="text-sm mt-0.5">
            Você já pode convidar seus clientes. As ofertas poderão ser publicadas assim que o cadastro for aprovado.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          ['Clientes', clients.length],
          ['Ofertas ativas', activeOffers.length],
          ['Chamadas no WhatsApp', clicks],
          ['Ofertas novas na semana', `${panel.offersThisWeek} de ${panel.weeklyLimit}`],
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="inline-grid grid-cols-3 gap-1 bg-gray-100 p-1 rounded-xl mb-5">
        {([['ofertas', 'Ofertas'], ['clientes', 'Clientes'], ['convidar', 'Convidar']] as const).map(([t, label]) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 sm:px-6 py-2.5 rounded-lg text-sm font-semibold ${tab === t ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'ofertas' && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <p className="text-sm text-gray-500">
              {limitReached
                ? 'Limite de ofertas novas da semana atingido. Você ainda pode editar ou reativar as existentes.'
                : 'Seus clientes são avisados no app quando você publica uma oferta.'}
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
                        {o.price ? ` · ${fmtMoney(o.price)}${o.unit ? ` / ${o.unit}` : ''}` : ''}
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
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setEditing(null)}>
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
                  <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="saco, kg..." className={`mt-1 ${input}`} />
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
