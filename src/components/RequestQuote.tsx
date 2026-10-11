'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FecharIcon } from '@/components/ModuleIcons'
import { whatsappLink } from '@/lib/utils'

interface Item {
  id: string
  name: string
  category: string
  unit: string
  currentQuantity: number
  minimumQuantity: number
}

interface LinkedVendor {
  id: string
  companyName: string
  city: string | null
  whatsapp: string | null
  phone: string
  status: string
}

const field = 'mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
const fmtQty = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 })

// Pedido de orçamento de um item do estoque para um fornecedor vinculado
export function RequestQuote({ item, onClose }: { item: Item; onClose: () => void }) {
  const [vendors, setVendors] = useState<LinkedVendor[] | null>(null)
  const [vendorId, setVendorId] = useState('')
  // Sugestão: o que falta para voltar ao dobro do mínimo
  const suggested = Math.max(item.minimumQuantity * 2 - item.currentQuantity, 0)
  const [quantity, setQuantity] = useState(suggested ? fmtQty(suggested).replace(/\./g, '') : '')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sentTo, setSentTo] = useState<LinkedVendor | null>(null)

  useEffect(() => {
    fetch('/api/meus-fornecedores')
      .then((r) => (r.ok ? r.json() : []))
      .then((list: LinkedVendor[]) => {
        const usable = list.filter((v) => v.status !== 'bloqueado')
        setVendors(usable)
        if (usable.length === 1) setVendorId(usable[0].id)
      })
      .catch(() => setVendors([]))
  }, [])

  async function send(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError('')
    try {
      const res = await fetch('/api/pedidos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendorId, supplyId: item.id, itemName: item.name, category: item.category, quantity, unit: item.unit, note }),
      })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Não foi possível enviar')
      setSentTo(vendors?.find((v) => v.id === vendorId) ?? null)
    } catch {
      setError('Sem internet. O pedido precisa de conexão para chegar ao fornecedor.')
    } finally {
      setSending(false)
    }
  }

  const qtyText = quantity ? `${quantity} ${item.unit} de ` : ''

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">{sentTo ? 'Pedido enviado' : 'Pedir orçamento'}</h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
          </div>

          {sentTo ? (
            <div>
              <p className="text-gray-700">
                A <strong>{sentTo.companyName}</strong> já vê o pedido no painel dela. A resposta aparece em <strong>Ofertas → Meus pedidos</strong> e no sino.
              </p>
              <a href={whatsappLink(sentTo.whatsapp || sentTo.phone, `Olá! Pedi um orçamento de ${qtyText}${item.name} pelo Anota Aí Agro. Pode ver?`)}
                target="_blank" rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center bg-green-700 hover:bg-green-600 text-white font-semibold py-3 rounded-lg">
                Avisar também pelo WhatsApp
              </a>
              <button type="button" onClick={onClose} className="mt-2 w-full border border-gray-200 text-gray-600 font-medium py-3 rounded-lg">Fechar</button>
            </div>
          ) : vendors === null ? (
            <p className="text-sm text-gray-400">Carregando...</p>
          ) : vendors.length === 0 ? (
            <div>
              <p className="text-gray-700">Você ainda não tem fornecedor no app.</p>
              <Link href="/ofertas" className="mt-3 inline-block font-semibold text-green-700 underline">Procurar fornecedor em Ofertas</Link>
            </div>
          ) : (
            <form onSubmit={send} className="flex flex-col gap-3">
              <p className="text-sm text-gray-600">
                <strong className="text-gray-900">{item.name}</strong> · você tem {fmtQty(item.currentQuantity)} {item.unit} (mínimo {fmtQty(item.minimumQuantity)})
              </p>
              <label className="text-sm font-medium text-gray-700">Fornecedor
                <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} required className={field}>
                  <option value="" disabled>Escolha</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.companyName}{v.city ? ` (${v.city})` : ''}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">Quantidade ({item.unit})
                <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="Opcional" className={field} />
              </label>
              <label className="text-sm font-medium text-gray-700">Recado
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500}
                  placeholder="Ex.: preciso até sexta, entrega no sítio" className={`${field} resize-none`} />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={sending || !vendorId}
                className="bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg">
                {sending ? 'Enviando...' : 'Enviar pedido'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
