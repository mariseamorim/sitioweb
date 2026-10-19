'use client'

import { useCallback, useEffect, useState } from 'react'
import { FecharIcon } from '@/components/ModuleIcons'
import type { SalesReport } from '@/lib/offerSales'
import { fmtDate, fmtMoney } from '@/lib/reports'
import { todayISO } from '@/lib/utils'

// Relatório de vendas do fornecedor: qual oferta mais virou venda, contatos do WhatsApp a confirmar
// e as vendas do período (confirmadas a partir do contato ou registradas à mão).

export interface SalesOffer { id: string; title: string; price: number | null }
export interface SalesClient { farmId: string; name: string }

interface ContactRow {
  id: string
  promotionId: string
  offerTitle: string
  farmId: string | null
  farm: { name: string; owner: string | null; city: string | null; state: string | null; phone: string | null } | null
  buyerName: string | null
  status: 'contato' | 'venda' | 'perdido'
  source: 'clique' | 'manual'
  saleValue: number | null
  quantity: number | null
  soldAt: string | null
  note: string | null
  createdAt: string
}

type Data = SalesReport & { pending: ContactRow[]; sales: ContactRow[] }
type Preset = 'mes' | 'mes-passado' | 'ano' | 'outro'

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'mes', label: 'Este mês' },
  { key: 'mes-passado', label: 'Mês passado' },
  { key: 'ano', label: 'Este ano' },
  { key: 'outro', label: 'Outro período' },
]
const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function presetRange(preset: Exclude<Preset, 'outro'>): [string, string] {
  const now = new Date()
  if (preset === 'mes') return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), todayISO()]
  if (preset === 'mes-passado') return [iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), iso(new Date(now.getFullYear(), now.getMonth(), 0))]
  return [iso(new Date(now.getFullYear(), 0, 1)), todayISO()]
}
const monthLabel = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]}/${m.slice(0, 4)}`
const who = (c: ContactRow) => c.farm?.name ?? c.buyerName ?? '—'
const money = (v: number | null) => (v === null ? '—' : fmtMoney(v))

const input = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
const EMPTY_SALE = { promotionId: '', farmId: '', buyerName: '', saleValue: '', quantity: '1', soldAt: todayISO() }
const toNumber = (raw: string) => Number(raw.replace(',', '.'))
/** Valor sugerido: preço da oferta × quantidade, no formato "95,00" (vazio sem preço) */
const suggestedValue = (price: number | null, quantity: string) => {
  const qty = toNumber(quantity)
  return price !== null && qty > 0 ? (Math.round(price * qty * 100) / 100).toFixed(2).replace('.', ',') : ''
}

export function VendasTab({ offers, clients, onChanged }: { offers: SalesOffer[]; clients: SalesClient[]; onChanged: () => void }) {
  const [preset, setPreset] = useState<Preset>('mes')
  const [[from, to], setRange] = useState<[string, string]>(presetRange('mes'))
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState<ContactRow | null>(null)
  const [registering, setRegistering] = useState(false)
  const [sale, setSale] = useState(EMPTY_SALE)
  // A pessoa mexeu no valor: para de sugerir pelo preço da oferta
  const [valueTouched, setValueTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const priceOf = (promotionId: string) => offers.find((o) => o.id === promotionId)?.price ?? null

  function startSale(promotionId: string, extra: Partial<typeof EMPTY_SALE> = {}) {
    setValueTouched(false)
    setFormError('')
    setSale({ ...EMPTY_SALE, promotionId, soldAt: todayISO(), saleValue: suggestedValue(priceOf(promotionId), '1'), ...extra })
  }
  const changeOffer = (promotionId: string) => setSale({ ...sale, promotionId, saleValue: valueTouched ? sale.saleValue : suggestedValue(priceOf(promotionId), sale.quantity) })
  const changeQuantity = (raw: string, promotionId: string) => {
    const quantity = raw.replace(/[^\d.,]/g, '')
    setSale({ ...sale, quantity, saleValue: valueTouched ? sale.saleValue : suggestedValue(priceOf(promotionId), quantity) })
  }
  const changeValue = (raw: string) => { setValueTouched(true); setSale({ ...sale, saleValue: raw.replace(/[^\d.,]/g, '') }) }
  const [formError, setFormError] = useState('')

  const load = useCallback(() => {
    if (from > to) return
    setLoading(true)
    setError('')
    fetch(`/api/fornecedor/vendas?from=${from}&to=${to}`)
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error)
        setData(body)
      })
      .catch((e: Error) => setError(e.message || 'Não foi possível carregar as vendas'))
      .finally(() => setLoading(false))
  }, [from, to])

  useEffect(load, [load])

  function choosePreset(p: Preset) {
    setPreset(p)
    if (p !== 'outro') setRange(presetRange(p))
  }

  async function send(url: string, method: string, body?: unknown): Promise<boolean> {
    setSaving(true)
    setFormError('')
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
      const result = await res.json().catch(() => ({}))
      if (!res.ok) { setFormError(result.error || 'Não foi possível salvar'); return false }
      load()
      onChanged()
      return true
    } catch {
      setFormError('Sem conexão. Tente de novo.')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function confirmSale(e: React.FormEvent) {
    e.preventDefault()
    if (!confirming) return
    if (await send(`/api/fornecedor/vendas/${confirming.id}`, 'PATCH', { status: 'venda', saleValue: sale.saleValue, quantity: sale.quantity, soldAt: sale.soldAt })) setConfirming(null)
  }

  async function registerSale(e: React.FormEvent) {
    e.preventDefault()
    if (await send('/api/fornecedor/vendas', 'POST', sale)) { setRegistering(false); setSale(EMPTY_SALE) }
  }

  const markLost = (c: ContactRow) => send(`/api/fornecedor/vendas/${c.id}`, 'PATCH', { status: 'perdido' })
  const undo = (c: ContactRow) => (c.source === 'manual' ? send(`/api/fornecedor/vendas/${c.id}`, 'DELETE') : send(`/api/fornecedor/vendas/${c.id}`, 'PATCH', { status: 'contato' }))

  const totals = data?.totals
  const top = data?.byOffer[0]

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {PRESETS.map((p) => (
          <button key={p.key} type="button" onClick={() => choosePreset(p.key)} aria-pressed={preset === p.key}
            className={`rounded-full border px-3 py-1.5 text-sm font-medium ${preset === p.key ? 'border-green-700 bg-green-700 text-white' : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
            {p.label}
          </button>
        ))}
        {preset === 'outro' && (
          <div className="flex items-center gap-2 text-sm">
            <label className="text-gray-600">De <input type="date" value={from} max={to} onChange={(e) => setRange([e.target.value, to])} className="ml-1 border border-gray-200 rounded-lg px-2 py-1.5" /></label>
            <label className="text-gray-600">Até <input type="date" value={to} min={from} onChange={(e) => setRange([from, e.target.value])} className="ml-1 border border-gray-200 rounded-lg px-2 py-1.5" /></label>
          </div>
        )}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
      {loading && !data && <p className="text-sm text-gray-400">Carregando...</p>}

      {totals && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            {([
              ['Contatos pelo WhatsApp', String(totals.contacts), 'text-gray-900'],
              ['Vendas', String(totals.sales), 'text-green-700'],
              ['Conversão', totals.rate === null ? '—' : `${totals.rate}%`, 'text-gray-900'],
              ['Valor vendido', fmtMoney(totals.revenue), 'text-green-700'],
            ] as const).map(([label, value, tone]) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
                <p className="text-sm text-gray-600">{label}</p>
                <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
              </div>
            ))}
          </div>
          <p className="mb-6 text-xs text-gray-500">
            Conversão = vendas ÷ contatos. Vendas registradas à mão contam como contato e venda.
            {data.requestsClosed.count > 0 && ` Fora das ofertas: ${data.requestsClosed.count} pedido${data.requestsClosed.count === 1 ? '' : 's'} de orçamento atendido${data.requestsClosed.count === 1 ? '' : 's'} (${fmtMoney(data.requestsClosed.value)}).`}
          </p>

          <section aria-labelledby="ranking" className="mb-6">
            <h2 id="ranking" className="text-lg font-semibold text-gray-900">Ofertas que mais venderam</h2>
            {top ? (
              <p className="mt-1 mb-3 text-sm text-gray-600">
                <strong>{top.title}</strong> foi a melhor do período: {top.sales} venda{top.sales === 1 ? '' : 's'} em {top.contacts} contato{top.contacts === 1 ? '' : 's'}
                {top.rate !== null ? ` (${top.rate}%)` : ''}{top.revenue ? `, ${fmtMoney(top.revenue)}` : ''}.
              </p>
            ) : (
              <p className="mt-1 mb-3 text-sm text-gray-600">Nenhum contato nas ofertas neste período. Quando um produtor chamar no WhatsApp a partir de uma oferta, ele aparece aqui.</p>
            )}
            {data.byOffer.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-3 py-2 text-left">Oferta</th>
                      <th className="px-3 py-2 text-right">Contatos</th>
                      <th className="px-3 py-2 text-right">Vendas</th>
                      <th className="px-3 py-2 text-right">Conversão</th>
                      <th className="px-3 py-2 text-right">Valor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.byOffer.map((o, i) => (
                      <tr key={o.id} className={i === 0 ? 'bg-green-50' : ''}>
                        <td className="px-3 py-2 font-medium text-gray-900">{i + 1}. {o.title}<span className="block text-xs font-normal text-gray-500">{o.category}{o.lost ? ` · ${o.lost} não fechou` : ''}</span></td>
                        <td className="px-3 py-2 text-right text-gray-700">{o.contacts}</td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700">{o.sales}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{o.rate === null ? '—' : `${o.rate}%`}</td>
                        <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">{fmtMoney(o.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {data.byMonth.length > 1 && (
            <section aria-labelledby="por-mes" className="mb-6">
              <h2 id="por-mes" className="mb-3 text-lg font-semibold text-gray-900">Mês a mês</h2>
              <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr><th className="px-3 py-2 text-left">Mês</th><th className="px-3 py-2 text-right">Contatos</th><th className="px-3 py-2 text-right">Vendas</th><th className="px-3 py-2 text-right">Valor</th></tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.byMonth.map((m) => (
                      <tr key={m.month}>
                        <td className="px-3 py-2 text-gray-900">{monthLabel(m.month)}</td>
                        <td className="px-3 py-2 text-right text-gray-700">{m.contacts}</td>
                        <td className="px-3 py-2 text-right font-semibold text-green-700">{m.sales}</td>
                        <td className="px-3 py-2 text-right text-gray-700 whitespace-nowrap">{fmtMoney(m.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section aria-labelledby="confirmar" className="mb-6">
            <h2 id="confirmar" className="text-lg font-semibold text-gray-900">Contatos a confirmar</h2>
            <p className="mt-1 mb-3 text-sm text-gray-600">Quem chamou no WhatsApp a partir de uma oferta. Diga se virou venda: é isso que entra no relatório.</p>
            {data.pending.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum contato esperando resposta.</p>
            ) : (
              <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {data.pending.map((c) => (
                  <li key={c.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900">{who(c)}</p>
                        <p className="text-sm text-gray-500">{c.offerTitle} · {fmtDate(c.createdAt)}</p>
                      </div>
                      {confirming?.id !== c.id && (
                        <div className="flex gap-2 text-sm">
                          <button type="button" onClick={() => { setConfirming(c); startSale(c.promotionId) }}
                            className="bg-green-700 hover:bg-green-600 text-white font-semibold px-3 py-2 rounded-lg">Virou venda</button>
                          <button type="button" disabled={saving} onClick={() => void markLost(c)} className="border border-gray-200 text-gray-600 font-medium px-3 py-2 rounded-lg hover:bg-gray-50">Não fechou</button>
                        </div>
                      )}
                    </div>
                    {confirming?.id === c.id && (
                      <form onSubmit={confirmSale} className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <label className="text-sm font-medium text-gray-700">Valor (R$)
                          <input inputMode="decimal" value={sale.saleValue} onChange={(e) => changeValue(e.target.value)} placeholder="Opcional" className={`mt-1 ${input}`} />
                        </label>
                        <label className="text-sm font-medium text-gray-700">Quantidade
                          <input inputMode="decimal" value={sale.quantity} onChange={(e) => changeQuantity(e.target.value, c.promotionId)} className={`mt-1 ${input}`} />
                        </label>
                        <label className="text-sm font-medium text-gray-700">Dia da venda
                          <input type="date" value={sale.soldAt} max={todayISO()} onChange={(e) => setSale({ ...sale, soldAt: e.target.value })} className={`mt-1 ${input}`} />
                        </label>
                        {formError && <p className="sm:col-span-3 text-sm text-red-600">{formError}</p>}
                        <div className="sm:col-span-3 flex gap-2">
                          <button type="button" onClick={() => setConfirming(null)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-2.5 rounded-lg">Cancelar</button>
                          <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg">{saving ? 'Salvando...' : 'Confirmar venda'}</button>
                        </div>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="vendas-periodo">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h2 id="vendas-periodo" className="text-lg font-semibold text-gray-900">Vendas do período</h2>
              <button type="button" onClick={() => { setRegistering(true); startSale(offers[0]?.id ?? '') }} disabled={offers.length === 0}
                className="bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
                + Registrar venda
              </button>
            </div>
            {data.sales.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma venda confirmada neste período.{offers.length === 0 ? ' Publique uma oferta para registrar vendas.' : ''}</p>
            ) : (
              <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {data.sales.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900">{who(c)} <span className="font-normal text-gray-500">· {c.offerTitle}</span></p>
                      <p className="text-sm text-gray-500">{fmtDate(c.soldAt ?? c.createdAt)} · {money(c.saleValue)}{c.quantity ? ` · ${c.quantity}` : ''}{c.source === 'manual' ? ' · registrada à mão' : ''}</p>
                    </div>
                    <button type="button" disabled={saving} onClick={() => void undo(c)} className="text-sm font-medium text-gray-600 hover:underline">{c.source === 'manual' ? 'Excluir' : 'Desfazer'}</button>
                  </li>
                ))}
              </ul>
            )}
            {formError && !confirming && !registering && <p className="mt-2 text-sm text-red-600">{formError}</p>}
          </section>
        </>
      )}

      {registering && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={registerSale} className="p-5 sm:p-6 flex flex-col gap-4" aria-labelledby="registrar-venda">
              <div className="flex items-center justify-between">
                <h2 id="registrar-venda" className="text-lg font-bold text-gray-900">Registrar venda</h2>
                <button type="button" onClick={() => setRegistering(false)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>
              <p className="text-sm text-gray-600">Venda fechada fora do app (balcão, telefone). Entra no relatório da oferta escolhida. O valor vem do preço da oferta vezes a quantidade; pode corrigir.</p>
              <label className="text-sm font-medium text-gray-700">Oferta *
                <select value={sale.promotionId} onChange={(e) => changeOffer(e.target.value)} required className={`mt-1 ${input} bg-white`}>
                  {offers.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">Cliente do app
                <select value={sale.farmId} onChange={(e) => setSale({ ...sale, farmId: e.target.value })} className={`mt-1 ${input} bg-white`}>
                  <option value="">Não está no app</option>
                  {clients.map((c) => <option key={c.farmId} value={c.farmId}>{c.name}</option>)}
                </select>
              </label>
              {!sale.farmId && (
                <label className="text-sm font-medium text-gray-700">Nome do comprador
                  <input value={sale.buyerName} onChange={(e) => setSale({ ...sale, buyerName: e.target.value })} placeholder="Opcional. Ex.: Sítio Boa Vista" className={`mt-1 ${input}`} />
                </label>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="text-sm font-medium text-gray-700">Valor (R$)
                  <input inputMode="decimal" value={sale.saleValue} onChange={(e) => changeValue(e.target.value)} placeholder="Opcional" className={`mt-1 ${input}`} />
                </label>
                <label className="text-sm font-medium text-gray-700">Quantidade
                  <input inputMode="decimal" value={sale.quantity} onChange={(e) => changeQuantity(e.target.value, sale.promotionId)} className={`mt-1 ${input}`} />
                </label>
                <label className="text-sm font-medium text-gray-700">Dia da venda *
                  <input type="date" value={sale.soldAt} max={todayISO()} onChange={(e) => setSale({ ...sale, soldAt: e.target.value })} required className={`mt-1 ${input}`} />
                </label>
              </div>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setRegistering(false)} className="flex-1 border border-gray-200 text-gray-600 font-medium py-3 rounded-lg hover:bg-gray-50">Cancelar</button>
                <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white font-semibold py-3 rounded-lg">{saving ? 'Salvando...' : 'Salvar venda'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
