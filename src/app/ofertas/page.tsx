'use client'

import { useEffect, useRef, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useDialog } from '@/components/DialogProvider'
import { AlertaIcon } from '@/components/ModuleIcons'
import { fmtDate, fmtMoney } from '@/lib/reports'
import { whatsappLink } from '@/lib/utils'
import { RequestQuote } from '@/components/RequestQuote'

interface Offer {
  id: string
  title: string
  description: string | null
  category: string
  price: number | null
  unit: string | null
  imageUrl: string | null
  validUntil: string
  isMyVendor: boolean
  matchesLowStock: boolean
  vendor: { id: string; companyName: string; city: string | null; state: string | null; whatsapp: string | null; phone: string }
}

interface MyVendor {
  id: string
  companyName: string
  contactName: string
  city: string | null
  state: string | null
  whatsapp: string | null
  phone: string
  status: string
  muted: boolean
  shareStock: boolean
}

interface MyRequest {
  id: string
  itemName: string
  quantity: number | null
  unit: string | null
  note: string | null
  status: 'novo' | 'respondido' | 'fechado' | 'cancelado'
  reply: string | null
  replyPrice: number | null
  repliedAt: string | null
  createdAt: string
  supplyId: string | null
  vendor: { id: string; companyName: string; whatsapp: string | null; phone: string }
}

const REQUEST_STATUS: Record<MyRequest['status'], { label: string; style: string }> = {
  novo: { label: 'Aguardando resposta', style: 'bg-amber-100 text-amber-800' },
  respondido: { label: 'Respondido', style: 'bg-blue-100 text-blue-800' },
  fechado: { label: 'Resolvido', style: 'bg-green-100 text-green-800' },
  cancelado: { label: 'Cancelado', style: 'bg-gray-100 text-gray-600' },
}

interface Found {
  id: string
  companyName: string
  contactName: string
  city: string | null
  state: string | null
  description: string | null
  linked: boolean
}

export default function OfertasPage() {
  const { user } = useUser()
  const { confirm } = useDialog()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const [offers, setOffers] = useState<Offer[] | null>(null)
  const [lowCategories, setLowCategories] = useState<string[]>([])
  const [vendors, setVendors] = useState<MyVendor[]>([])
  const [requests, setRequests] = useState<MyRequest[]>([])
  const [category, setCategory] = useState('')
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Found[]>([])
  const [error, setError] = useState('')
  // Fornecedor escolhido para "Mandar mensagem"
  const [messageTo, setMessageTo] = useState<string | null>(null)

  function load() {
    fetch('/api/ofertas')
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error)
        setOffers(data.offers)
        setLowCategories(data.lowCategories)
      })
      .catch((e: Error) => setError(e.message || 'Não foi possível carregar as ofertas'))
    fetch('/api/meus-fornecedores')
      .then((r) => (r.ok ? r.json() : []))
      .then(setVendors)
      .catch(() => {})
    fetch('/api/pedidos')
      .then((r) => (r.ok ? r.json() : []))
      .then(setRequests)
      .catch(() => {})
  }

  // Vindo do sino (#pedidos): as listas chegam depois da página, então rola quando as duas estiverem na tela
  const scrolledToRequests = useRef(false)
  useEffect(() => {
    if (scrolledToRequests.current || offers === null || requests.length === 0 || window.location.hash !== '#pedidos') return
    scrolledToRequests.current = true
    document.getElementById('pedidos')?.scrollIntoView({ behavior: 'smooth' })
  }, [offers, requests])

  async function setRequestStatus(r: MyRequest, status: 'fechado' | 'cancelado') {
    if (status === 'cancelado' && !(await confirm({ title: 'Cancelar este pedido?', message: `${r.itemName} · ${r.vendor.companyName}`, confirmLabel: 'Cancelar pedido', danger: true }))) return
    await fetch(`/api/pedidos/${r.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
    load()
  }

  async function toggleShareStock(v: MyVendor) {
    await fetch(`/api/meus-fornecedores/${v.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shareStock: !v.shareStock }),
    })
    load()
  }

  useEffect(load, [])

  // Busca de fornecedores com pequena espera entre as teclas
  useEffect(() => {
    if (query.trim().length < 2) return
    const timer = setTimeout(() => {
      fetch(`/api/fornecedores/busca?q=${encodeURIComponent(query.trim())}`)
        .then((r) => (r.ok ? r.json() : []))
        .then(setFound)
        .catch(() => setFound([]))
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  function callVendor(offer: Offer) {
    // Conta o clique para o fornecedor; não segura a abertura do WhatsApp
    fetch(`/api/ofertas/${offer.id}/whatsapp`, { method: 'POST', keepalive: true }).catch(() => {})
  }

  async function addVendor(id: string) {
    await fetch('/api/meus-fornecedores', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vendorId: id }),
    })
    setQuery('')
    setFound([])
    load()
  }

  async function toggleMute(v: MyVendor) {
    await fetch(`/api/meus-fornecedores/${v.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muted: !v.muted }),
    })
    load()
  }

  async function removeVendor(v: MyVendor) {
    const ok = await confirm({
      title: `Remover ${v.companyName}?`,
      message: 'Você deixa de ver as ofertas dele e ele deixa de ver sua propriedade como cliente.',
      confirmLabel: 'Remover',
      danger: true,
    })
    if (!ok) return
    await fetch(`/api/meus-fornecedores/${v.id}`, { method: 'DELETE' })
    load()
  }

  const categories = [...new Set((offers ?? []).map((o) => o.category))]
  const visible = (offers ?? []).filter((o) => !category || o.category === category)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Ofertas</h1>
        <p className="text-gray-500 text-sm mt-1">Insumos dos seus fornecedores e da sua região</p>
      </div>

      {lowCategories.length > 0 && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <AlertaIcon className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm">
            Estoque baixo em <strong>{lowCategories.join(', ')}</strong>. As ofertas dessas categorias aparecem primeiro.
          </p>
        </div>
      )}

      {categories.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {['', ...categories].map((c) => (
            <button key={c || 'todas'} type="button" onClick={() => setCategory(c)}
              className={`px-4 py-2 rounded-full text-sm font-medium border ${
                category === c ? 'bg-green-700 border-green-700 text-white' : 'border-gray-200 text-gray-600 bg-white hover:bg-gray-50'
              }`}>
              {c || 'Todas'}
            </button>
          ))}
        </div>
      )}

      {error ? (
        <p className="text-gray-500">{error}</p>
      ) : !offers ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : visible.length === 0 ? (
        <div className="py-12 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
          <p className="text-lg">Nenhuma oferta no momento</p>
          <p className="text-sm mt-1">Peça ao seu fornecedor o link de convite ou procure por ele abaixo.</p>
        </div>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {visible.map((o) => {
            const phone = o.vendor.whatsapp || o.vendor.phone
            return (
              <li key={o.id} className={`bg-white rounded-xl border p-4 flex gap-4 ${o.matchesLowStock ? 'border-amber-300' : 'border-gray-200'}`}>
                {o.imageUrl && <img src={o.imageUrl} alt="" className="w-24 h-24 rounded-lg object-cover shrink-0" />}
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex flex-wrap gap-1.5 mb-1">
                    {o.matchesLowStock && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">Seu estoque está baixo</span>}
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{o.category}</span>
                  </div>
                  <p className="text-base font-semibold text-gray-900">{o.title}</p>
                  {o.price && (
                    <p className="text-lg font-bold text-green-700">{fmtMoney(o.price)}{o.unit && <span className="text-sm font-normal text-gray-500"> / {o.unit.toLowerCase()}</span>}</p>
                  )}
                  {o.description && <p className="text-sm text-gray-600 mt-1">{o.description}</p>}
                  <p className="text-xs text-gray-500 mt-1">
                    {o.vendor.companyName}{o.isMyVendor ? ' · seu fornecedor' : o.vendor.city ? ` · ${o.vendor.city}` : ''} · até {fmtDate(o.validUntil)}
                  </p>
                  <a href={whatsappLink(phone, `Olá! Vi a oferta "${o.title}" no Anota Aí Agro e tenho interesse.`)}
                    target="_blank" rel="noopener noreferrer" onClick={() => callVendor(o)}
                    className="mt-3 self-start inline-flex items-center bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
                    Chamar no WhatsApp
                  </a>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {requests.length > 0 && (
        <section id="pedidos" className="mt-10 scroll-mt-24">
          <h2 className="text-lg font-bold text-gray-900">Meus pedidos e mensagens</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {requests.map((r) => {
              const status = REQUEST_STATUS[r.status]
              const open = r.status === 'novo' || r.status === 'respondido'
              const isMessage = !r.supplyId && !r.quantity
              return (
                <li key={r.id} className={`bg-white rounded-xl border p-4 ${r.status === 'respondido' ? 'border-blue-300' : 'border-gray-200'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">
                        {r.itemName}
                        {r.quantity && <span className="font-normal text-gray-600"> · {r.quantity.toLocaleString('pt-BR')}{r.unit ? ` ${r.unit}` : ''}</span>}
                      </p>
                      <p className="text-sm text-gray-500">{r.vendor.companyName} · {isMessage ? 'mensagem enviada' : 'pedido'} em {fmtDate(r.createdAt)}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full ${status.style}`}>{status.label}</span>
                  </div>
                  {r.note && <p className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"><span className="text-gray-500">Você: </span>{r.note}</p>}
                  {r.reply && (
                    <div className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">
                      <p><span className="font-semibold">{r.vendor.companyName}: </span>{r.reply}</p>
                      {r.replyPrice !== null && <p className="mt-1 text-base font-bold">{fmtMoney(r.replyPrice)}</p>}
                    </div>
                  )}
                  {open && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      <a href={whatsappLink(r.vendor.whatsapp || r.vendor.phone, `Olá! Sobre o meu pedido de ${r.itemName} pelo Anota Aí Agro.`)}
                        target="_blank" rel="noopener noreferrer"
                        className="bg-green-700 hover:bg-green-600 text-white font-semibold px-3 py-2 rounded-lg">WhatsApp</a>
                      {canEdit && <button onClick={() => setRequestStatus(r, 'fechado')} className="font-medium text-green-700 hover:underline">Resolvido</button>}
                      {canEdit && r.status === 'novo' && <button onClick={() => setRequestStatus(r, 'cancelado')} className="font-medium text-red-600 hover:underline">Cancelar</button>}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-bold text-gray-900">Meus fornecedores</h2>
        <p className="mt-1 text-sm text-gray-500">
          Seus fornecedores veem os itens do seu estoque que estão abaixo do mínimo, para oferecer a reposição. Você pode desligar para cada um.
        </p>
        {vendors.length === 0 ? (
          <p className="mt-2 text-gray-500">Nenhum fornecedor ainda.</p>
        ) : (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {vendors.map((v) => (
              <li key={v.id} className="bg-white rounded-xl border border-gray-200 p-4">
                {/* Dados em cima, ações embaixo: no celular o nome não fica espremido pelos botões */}
                <p className="font-semibold text-gray-900">{v.companyName}</p>
                <p className="text-sm text-gray-500">
                  {[v.contactName, [v.city, v.state].filter(Boolean).join('/')].filter(Boolean).join(' · ')}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {v.shareStock ? 'Vê seu estoque baixo' : 'Não vê seu estoque'}
                  {v.muted && ' · ofertas silenciadas'}
                  {v.status === 'pendente' && ' · cadastro em análise'}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {canEdit && (
                    <button type="button" onClick={() => setMessageTo(v.id)}
                      className="bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-3 py-2 rounded-lg">
                      Mandar mensagem
                    </button>
                  )}
                  <a href={whatsappLink(v.whatsapp || v.phone, 'Olá! Te encontrei pelo Anota Aí Agro.')} target="_blank" rel="noopener noreferrer"
                    className="border border-green-700 text-green-700 text-sm font-semibold px-3 py-2 rounded-lg hover:bg-green-50">WhatsApp</a>
                </div>
                {canEdit && (
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 pt-3 text-sm">
                    <button type="button" onClick={() => toggleMute(v)} className="font-medium text-gray-600 hover:underline">
                      {v.muted ? 'Voltar a receber ofertas' : 'Silenciar ofertas'}
                    </button>
                    <button type="button" onClick={() => toggleShareStock(v)} className="font-medium text-gray-600 hover:underline">
                      {v.shareStock ? 'Esconder estoque' : 'Mostrar estoque'}
                    </button>
                    <button type="button" onClick={() => removeVendor(v)} className="font-medium text-red-600 hover:underline">Remover</button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <div className="mt-4 max-w-xl">
            <label className="text-sm font-medium text-gray-700">Procurar fornecedor
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Nome da loja, do vendedor ou cidade"
                className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600" />
            </label>
            {query.trim().length >= 2 && (
              <ul className="mt-2 bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {found.length === 0 ? (
                  <li className="px-4 py-3 text-sm text-gray-500">Nenhum fornecedor encontrado.</li>
                ) : found.map((f) => (
                  <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{f.companyName}</p>
                      <p className="text-sm text-gray-500">
                        {[f.contactName, [f.city, f.state].filter(Boolean).join('/')].filter(Boolean).join(' · ')}
                      </p>
                      {f.description && <p className="text-xs text-gray-500 line-clamp-1">{f.description}</p>}
                    </div>
                    {f.linked ? (
                      <span className="shrink-0 rounded-full bg-green-100 px-3 py-1.5 text-xs font-semibold text-green-800">Já é seu fornecedor</span>
                    ) : (
                      <button onClick={() => addVendor(f.id)} className="shrink-0 text-sm font-semibold text-green-700 border border-green-700 rounded-lg px-3 py-1.5 hover:bg-green-50">
                        Adicionar
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      {messageTo && <RequestQuote vendorId={messageTo} onClose={() => { setMessageTo(null); load() }} />}
    </div>
  )
}
