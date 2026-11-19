'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FecharIcon } from '@/components/ModuleIcons'
import { whatsappLink } from '@/lib/utils'
import { useLocale, useT } from '@/lib/i18n'

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
const fmtQty = (n: number, locale = 'pt-BR') => n.toLocaleString(locale, { maximumFractionDigits: 2 })

// Pedido de orçamento de um item do estoque, ou mensagem solta (sem item), para um fornecedor vinculado.
// Os dois chegam na aba "Pedidos" do fornecedor e a resposta volta em "Meus pedidos".
export function RequestQuote({ item, vendorId: initialVendorId = '', onClose }: { item?: Item; vendorId?: string; onClose: () => void }) {
  const t = useT()
  const locale = useLocale()
  const [vendors, setVendors] = useState<LinkedVendor[] | null>(null)
  const [vendorId, setVendorId] = useState(initialVendorId)
  // Sugestão: o que falta para voltar ao dobro do mínimo
  const suggested = item ? Math.max(item.minimumQuantity * 2 - item.currentQuantity, 0) : 0
  const [quantity, setQuantity] = useState(suggested ? fmtQty(suggested).replace(/\./g, '') : '')
  const [subject, setSubject] = useState('')
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
        if (usable.length === 1) setVendorId((v) => v || usable[0].id)
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
        body: JSON.stringify(item
          ? { vendorId, supplyId: item.id, itemName: item.name, category: item.category, quantity, unit: item.unit, note }
          : { vendorId, itemName: subject, category: 'Outro', note }),
      })
      const data = await res.json()
      if (!res.ok) return setError(t(data.error || 'Não foi possível enviar'))
      setSentTo(vendors?.find((v) => v.id === vendorId) ?? null)
    } catch {
      setError(t('Sem internet. O pedido precisa de conexão para chegar ao fornecedor.'))
    } finally {
      setSending(false)
    }
  }

  const whatsappText = item
    ? t('Olá! Pedi um orçamento de {what} pelo Anota Aí Agro. Pode ver?', { what: `${quantity ? `${quantity} ${item.unit} ${t('de')} ` : ''}${item.name}` })
    : t('Olá! Mandei uma mensagem pelo Anota Aí Agro sobre {subject}: {note}', { subject, note })

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70] p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 sm:p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">
              {t(sentTo ? (item ? 'Pedido enviado' : 'Mensagem enviada') : (item ? 'Pedir orçamento' : 'Mandar mensagem'))}
            </h2>
            <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1" aria-label={t('Fechar')}><FecharIcon /></button>
          </div>

          {sentTo ? (
            <div>
              <p className="text-gray-700">
                <strong>{sentTo.companyName}</strong> {t(item ? 'já vê o pedido no painel dela. A resposta aparece em' : 'já vê a mensagem no painel dela. A resposta aparece em')} <strong>{t('Ofertas → Meus pedidos')}</strong> {t('e no sino.')}
              </p>
              <a href={whatsappLink(sentTo.whatsapp || sentTo.phone, whatsappText)}
                target="_blank" rel="noopener noreferrer"
                className="mt-4 flex w-full items-center justify-center bg-green-700 hover:bg-green-600 text-white font-semibold py-3 rounded-lg">
                {t('Avisar também pelo WhatsApp')}
              </a>
              <button type="button" onClick={onClose} className="mt-2 w-full border border-gray-200 text-gray-600 font-medium py-3 rounded-lg">{t('Fechar')}</button>
            </div>
          ) : vendors === null ? (
            <p className="text-sm text-gray-400">{t('Carregando...')}</p>
          ) : vendors.length === 0 ? (
            <div>
              <p className="text-gray-700">{t('Você ainda não tem fornecedor no app.')}</p>
              <Link href="/ofertas" className="mt-3 inline-block font-semibold text-green-700 underline">{t('Procurar fornecedor em Ofertas')}</Link>
            </div>
          ) : (
            <form onSubmit={send} className="flex flex-col gap-3">
              {item && (
                <p className="text-sm text-gray-600">
                  <strong className="text-gray-900">{item.name}</strong> · {t('você tem {qty} {unit} (mínimo {min})', { qty: fmtQty(item.currentQuantity, locale), unit: item.unit, min: fmtQty(item.minimumQuantity, locale) })}
                </p>
              )}
              <label className="text-sm font-medium text-gray-700">{t('Fornecedor')}
                <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} required className={field}>
                  <option value="" disabled>{t('Escolha')}</option>
                  {vendors.map((v) => <option key={v.id} value={v.id}>{v.companyName}{v.city ? ` (${v.city})` : ''}</option>)}
                </select>
              </label>
              {item ? (
                <label className="text-sm font-medium text-gray-700">{t('Quantidade')} ({item.unit})
                  <input inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d.,]/g, ''))} placeholder={t('Opcional')} className={field} />
                </label>
              ) : (
                <label className="text-sm font-medium text-gray-700">{t('Assunto')}
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} required maxLength={120}
                    placeholder={t('Ex.: arame farpado, horário de entrega')} className={field} />
                </label>
              )}
              <label className="text-sm font-medium text-gray-700">{t(item ? 'Recado' : 'Mensagem')}
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={item ? 2 : 4} maxLength={500} required={!item}
                  placeholder={t(item ? 'Ex.: preciso até sexta, entrega no sítio' : 'Ex.: Vocês têm arame farpado? Quanto custa o rolo?')}
                  className={`${field} resize-none`} />
              </label>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={sending || !vendorId}
                className="bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg">
                {t(sending ? 'Enviando...' : item ? 'Enviar pedido' : 'Enviar mensagem')}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
