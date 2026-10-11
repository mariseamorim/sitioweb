'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useDialog } from '@/components/DialogProvider'
import { CadeadoIcon } from '@/components/ModuleIcons'
import { fmtDate } from '@/lib/reports'
import { whatsappLink } from '@/lib/utils'

interface Vendor {
  id: string
  companyName: string
  document: string | null
  contactName: string
  phone: string
  whatsapp: string | null
  email: string
  city: string | null
  state: string | null
  description: string | null
  status: 'pendente' | 'aprovado' | 'bloqueado'
  createdAt: string
  _count: { clients: number; promotions: number }
}

const STATUS_LABEL = { pendente: 'Em análise', aprovado: 'Aprovado', bloqueado: 'Bloqueado' }
const STATUS_STYLE = {
  pendente: 'bg-amber-100 text-amber-800',
  aprovado: 'bg-green-100 text-green-800',
  bloqueado: 'bg-gray-200 text-gray-700',
}

export default function AdminFornecedoresPage() {
  const { isAdmin, loading: userLoading } = useUser()
  const { confirm } = useDialog()
  const [vendors, setVendors] = useState<Vendor[] | null>(null)

  function load() {
    fetch('/api/fornecedores')
      .then((r) => (r.ok ? r.json() : []))
      .then(setVendors)
      .catch(() => setVendors([]))
  }

  useEffect(load, [])

  async function setStatus(v: Vendor, status: Vendor['status']) {
    if (status === 'bloqueado') {
      const ok = await confirm({
        title: `Bloquear ${v.companyName}?`,
        message: 'As ofertas deixam de aparecer e o fornecedor não consegue mais usar o painel.',
        confirmLabel: 'Bloquear',
        danger: true,
      })
      if (!ok) return
    }
    await fetch(`/api/fornecedores/${v.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    load()
  }

  if (userLoading) return <p className="text-gray-400 text-sm mt-8">Carregando...</p>
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <CadeadoIcon className="w-12 h-12 mb-4 text-gray-300" />
        <p className="text-gray-600">Área do administrador.</p>
      </div>
    )
  }

  const pending = vendors?.filter((v) => v.status === 'pendente').length ?? 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Fornecedores</h1>
        <p className="text-gray-500 text-sm mt-1">
          {pending ? `${pending} cadastro${pending > 1 ? 's' : ''} aguardando aprovação` : 'Aprove quem pode publicar ofertas no app'}
        </p>
      </div>

      {!vendors ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : vendors.length === 0 ? (
        <p className="py-12 text-center text-gray-500">Nenhum fornecedor cadastrado. O link de cadastro é /fornecedor/cadastro.</p>
      ) : (
        <ul className="grid gap-3">
          {vendors.map((v) => (
            <li key={v.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base font-semibold text-gray-900">{v.companyName}</p>
                  <p className="text-sm text-gray-500">
                    {v.contactName} · {v.email} · {v.phone}
                    {v.document && ` · ${v.document}`}
                  </p>
                  <p className="text-sm text-gray-500">
                    {[v.city, v.state].filter(Boolean).join('/') || 'Cidade não informada'} · cadastrado em {fmtDate(v.createdAt)} ·{' '}
                    {v._count.clients} cliente{v._count.clients === 1 ? '' : 's'} · {v._count.promotions} oferta{v._count.promotions === 1 ? '' : 's'}
                  </p>
                  {v.description && <p className="mt-1 text-sm text-gray-700">{v.description}</p>}
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[v.status]}`}>{STATUS_LABEL[v.status]}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {v.status !== 'aprovado' && (
                  <button onClick={() => setStatus(v, 'aprovado')} className="bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">
                    Aprovar
                  </button>
                )}
                {v.status !== 'bloqueado' && (
                  <button onClick={() => setStatus(v, 'bloqueado')} className="border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50">
                    Bloquear
                  </button>
                )}
                <a href={whatsappLink(v.whatsapp || v.phone, `Olá, ${v.contactName}! Aqui é do Anota Aí Agro, sobre o cadastro da ${v.companyName}.`)}
                  target="_blank" rel="noopener noreferrer"
                  className="text-sm font-semibold text-green-700 px-2 py-2 hover:underline">
                  WhatsApp
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
