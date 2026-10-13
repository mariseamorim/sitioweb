'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useDialog } from '@/components/DialogProvider'
import { CadeadoIcon } from '@/components/ModuleIcons'
import { fmtDate } from '@/lib/reports'
import { whatsappLink } from '@/lib/utils'
import { ORG_TYPES, type OrgType } from '@/lib/organizations'

interface Organization {
  id: string
  type: OrgType
  name: string
  document: string | null
  contactName: string
  phone: string
  email: string
  city: string | null
  state: string | null
  status: 'pendente' | 'aprovado' | 'bloqueado'
  createdAt: string
  _count: { points: number; routes: number; members: number }
}

const STATUS_LABEL = { pendente: 'Em análise', aprovado: 'Aprovado', bloqueado: 'Bloqueado' }
const STATUS_STYLE = { pendente: 'bg-amber-100 text-amber-800', aprovado: 'bg-green-100 text-green-800', bloqueado: 'bg-gray-200 text-gray-700' }

// Admin aprova ou bloqueia laticínios e associações
export default function AdminOrganizacoesPage() {
  const { isAdmin, loading: userLoading } = useUser()
  const { confirm } = useDialog()
  const [organizations, setOrganizations] = useState<Organization[] | null>(null)

  function load() {
    fetch('/api/organizacoes')
      .then((r) => (r.ok ? r.json() : []))
      .then(setOrganizations)
      .catch(() => setOrganizations([]))
  }

  useEffect(load, [])

  async function setStatus(o: Organization, status: Organization['status']) {
    if (status === 'bloqueado' && !(await confirm({ title: `Bloquear ${o.name}?`, message: 'A conta deixa de conseguir usar o painel.', confirmLabel: 'Bloquear', danger: true }))) return
    await fetch(`/api/organizacoes/${o.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) })
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

  const pending = organizations?.filter((o) => o.status === 'pendente').length ?? 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Laticínios e associações</h1>
        <p className="text-gray-500 text-sm mt-1">
          {pending ? `${pending} cadastro${pending > 1 ? 's' : ''} aguardando aprovação` : 'Aprove quem pode usar os painéis de laticínio e associação'}
        </p>
      </div>

      {!organizations ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : organizations.length === 0 ? (
        <p className="py-12 text-center text-gray-500">Nenhum cadastro ainda. O link de cadastro fica em Criar conta.</p>
      ) : (
        <ul className="grid gap-3">
          {organizations.map((o) => (
            <li key={o.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase text-green-700">{ORG_TYPES[o.type]?.label ?? o.type}</p>
                  <p className="text-base font-semibold text-gray-900">{o.name}</p>
                  <p className="text-sm text-gray-500">{o.contactName} · {o.email} · {o.phone}{o.document && ` · ${o.document}`}</p>
                  <p className="text-sm text-gray-500">
                    {[o.city, o.state].filter(Boolean).join('/') || 'Cidade não informada'} · cadastrado em {fmtDate(o.createdAt)} ·{' '}
                    {o.type === 'laticinio'
                      ? `${o._count.points} ponto${o._count.points === 1 ? '' : 's'} de coleta · ${o._count.routes} rota${o._count.routes === 1 ? '' : 's'}`
                      : `${o._count.members} associado${o._count.members === 1 ? '' : 's'}`}
                  </p>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_STYLE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {o.status !== 'aprovado' && (
                  <button onClick={() => setStatus(o, 'aprovado')} className="bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2 rounded-lg">Aprovar</button>
                )}
                {o.status !== 'bloqueado' && (
                  <button onClick={() => setStatus(o, 'bloqueado')} className="border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50">Bloquear</button>
                )}
                <a href={whatsappLink(o.phone, `Olá, ${o.contactName}! Aqui é do Anota Aí Agro, sobre o cadastro de ${o.name}.`)}
                  target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-green-700 px-2 py-2 hover:underline">WhatsApp</a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
