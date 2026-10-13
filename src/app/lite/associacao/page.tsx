'use client'

import { useCallback, useEffect, useState } from 'react'
import { BackLink } from '@/components/BackLink'
import { useDialog } from '@/components/DialogProvider'
import { whatsappLink } from '@/lib/utils'
import { qtyWithUnit } from '@/lib/organizations'

interface Purchase {
  id: string
  title: string
  category: string
  unit: string
  description: string | null
  deadline: string | null
  status: 'aberta' | 'fechada'
  myQuantity: number | null
  myNote: string | null
  total: number
}

interface Association {
  id: string
  name: string
  contactName: string
  phone: string
  status: 'ativo' | 'inativo'
  shareProduction: boolean
  purchases: Purchase[]
}

const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

// Produtor (versão completa ou Anota Aí Leite): suas associações, o que compartilha e as compras coletivas
export default function MinhaAssociacaoPage() {
  const { confirm } = useDialog()
  const [data, setData] = useState<{ canManage: boolean; associations: Association[] } | null>(null)
  const [error, setError] = useState('')
  const [back, setBack] = useState('/')

  const load = useCallback(() => {
    fetch('/api/minhas-associacoes')
      .then(async (r) => {
        const body = await r.json()
        if (!r.ok) throw new Error(body.error)
        setData(body)
      })
      .catch((e: Error) => setError(e.message || 'Não foi possível carregar'))
  }, [])

  useEffect(() => {
    load()
    // Volta para o Anota Aí Leite (produtor Lite) ou para o painel (versão completa)
    fetch('/api/auth/me').then((r) => r.json()).then((me) => setBack(me?.role === 'lite' ? '/lite' : '/')).catch(() => {})
  }, [load])

  async function toggleShare(a: Association) {
    await fetch(`/api/minhas-associacoes/${a.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shareProduction: !a.shareProduction }) })
    load()
  }

  async function leave(a: Association) {
    if (!(await confirm({ title: `Sair da ${a.name}?`, message: 'Seus pedidos nas compras coletivas saem junto.', confirmLabel: 'Sair', danger: true }))) return
    await fetch(`/api/minhas-associacoes/${a.id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="min-h-dvh bg-gray-50">
      <div className="mx-auto max-w-xl px-4 py-5">
        <BackLink href={back} label="Voltar" className="-ml-2" />
        <h1 className="mt-2 text-2xl font-bold text-gray-900">Minha associação</h1>

        {error ? <p className="mt-6 text-gray-600">{error}</p> : !data ? <p className="mt-6 text-sm text-gray-400">Carregando...</p> : data.associations.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 text-center text-gray-600">
            <p>Você ainda não faz parte de nenhuma associação.</p>
            <p className="mt-1 text-sm">Peça à sua associação o link de convite.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            {data.associations.map((a) => (
              <section key={a.id} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-lg font-semibold text-gray-900">{a.name}</h2>
                    <p className="text-sm text-gray-600">{a.contactName}</p>
                  </div>
                  {a.status === 'inativo' && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">Inativo</span>}
                </div>

                <div className="mt-3 rounded-xl bg-gray-50 p-3 text-sm text-gray-700">
                  <p>{a.shareProduction ? 'A associação vê o total de leite que você produz.' : 'A associação não vê o seu leite.'} Os outros dados continuam privados.</p>
                  {data.canManage && (
                    <button type="button" onClick={() => toggleShare(a)} className="mt-1 font-semibold text-green-700 underline">
                      {a.shareProduction ? 'Parar de mostrar o leite' : 'Mostrar o total de leite'}
                    </button>
                  )}
                </div>

                <h3 className="mt-4 text-sm font-semibold text-gray-700">Compras coletivas</h3>
                {a.purchases.length === 0 ? <p className="mt-1 text-sm text-gray-500">Nenhuma compra aberta.</p> : (
                  <ul className="mt-2 space-y-2">
                    {a.purchases.map((p) => <PurchaseItem key={p.id} purchase={p} canOrder={data.canManage && a.status === 'ativo'} onSaved={load} />)}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap gap-4 border-t border-gray-100 pt-3 text-sm">
                  <a href={whatsappLink(a.phone, `Olá! Sou associado da ${a.name}.`)} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-700 hover:underline">Falar com a associação</a>
                  {data.canManage && <button type="button" onClick={() => leave(a)} className="font-medium text-red-600 hover:underline">Sair da associação</button>}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function PurchaseItem({ purchase: p, canOrder, onSaved }: { purchase: Purchase; canOrder: boolean; onSaved: () => void }) {
  const [quantity, setQuantity] = useState(p.myQuantity ? String(p.myQuantity).replace('.', ',') : '')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const open = p.status === 'aberta'

  async function save() {
    setSaving(true)
    setMessage('')
    try {
      const res = await fetch('/api/minhas-associacoes/pedidos', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ purchaseId: p.id, quantity }) })
      const body = await res.json().catch(() => ({}))
      setMessage(res.ok ? (body.quantity === null ? 'Pedido retirado.' : 'Pedido salvo.') : body.error || 'Não foi possível salvar')
      if (res.ok) onSaved()
    } catch {
      setMessage('Sem conexão. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <li className="rounded-xl border border-gray-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900">{p.title}</p>
          <p className="text-sm text-gray-600">{p.category}{p.deadline && ` · pedir até ${fmtDay(p.deadline)}`}{p.description && ` · ${p.description}`}</p>
          <p className="text-xs text-gray-500">Total da associação até agora: {qtyWithUnit(p.total, p.unit)}</p>
        </div>
        {!open && <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">Fechada</span>}
      </div>
      {open && canOrder ? (
        <div className="mt-2 flex items-center gap-2">
          <input value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^\d.,]/g, ''))} inputMode="decimal" placeholder="0"
            aria-label={`Quantidade de ${p.title}`} className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-right text-lg font-semibold" />
          <span className="text-gray-600">{p.unit}</span>
          <button type="button" onClick={save} disabled={saving} className="ml-auto rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:bg-gray-300">
            {saving ? 'Salvando...' : 'Salvar pedido'}
          </button>
        </div>
      ) : p.myQuantity ? (
        <p className="mt-2 text-sm font-semibold text-gray-800">Seu pedido: {qtyWithUnit(p.myQuantity, p.unit)}</p>
      ) : null}
      {message && <p role="status" className="mt-1 text-sm text-green-800">{message}</p>}
    </li>
  )
}
