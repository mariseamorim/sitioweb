'use client'

import { useState } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { NOTICE_KINDS, VISIT_STATUS, feeStatus, fmtMonth } from '@/lib/organizations'
import { todayISO, whatsappLink } from '@/lib/utils'
import { field, fmtDay, send } from '@/app/laticinio/types'

// Serviços da associação para os associados: comunicados, assistência técnica e mensalidades

export interface Notice { id: string; kind: string; title: string; body: string | null; eventDate: string | null; createdAt: string }
export interface Visit {
  id: string
  memberId: string
  subject: string
  description: string | null
  status: 'solicitada' | 'agendada' | 'concluida' | 'cancelada'
  scheduledFor: string | null
  technician: string | null
  result: string | null
  createdAt: string
}
export interface Fee { id: string; memberId: string; reference: string; amount: number; dueDate: string; paidAt: string | null }
export interface MemberRef { id: string; name: string; phone: string | null; status: 'ativo' | 'inativo' }

const fmtMoney = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const btnPrimary = 'bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg'
const btnSecondary = 'flex-1 border border-gray-300 bg-white text-gray-700 font-medium py-2.5 rounded-lg'

export function NoticesSection({ orgName, notices, onChange }: { orgName: string; notices: Notice[]; onChange: () => void }) {
  const { confirm } = useDialog()
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ kind: 'aviso', title: '', body: '', eventDate: '' })
  const [error, setError] = useState('')

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { ok, data } = await send('/api/associacao/comunicados', 'POST', form)
    if (!ok) return setError(data.error || 'Não foi possível publicar')
    setCreating(false)
    setForm({ kind: 'aviso', title: '', body: '', eventDate: '' })
    onChange()
  }

  async function remove(n: Notice) {
    if (!(await confirm({ title: `Apagar o comunicado ${n.title}?`, message: 'Os associados deixam de ver.', confirmLabel: 'Apagar', danger: true }))) return
    await send(`/api/associacao/comunicados/${n.id}`, 'DELETE')
    onChange()
  }

  const text = (n: Notice) => [`${orgName}: ${NOTICE_KINDS[n.kind] ?? 'Aviso'}`, n.title, n.eventDate ? `Dia ${fmtDay(n.eventDate)}` : null, n.body].filter(Boolean).join('\n')

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Avisos, reuniões, cursos e campanhas de vacinação aparecem para todos os associados no aplicativo.</p>
        <button type="button" onClick={() => setCreating(true)} className={btnPrimary}>+ Novo comunicado</button>
      </div>
      {creating && (
        <form onSubmit={create} className="mb-5 grid gap-3 rounded-xl border border-green-200 bg-green-50/40 p-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">Tipo
            <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={`${field} bg-white`}>
              {Object.entries(NOTICE_KINDS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Data do evento
            <input type="date" value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} className={`${field} bg-white`} />
          </label>
          <label className="text-sm font-medium text-gray-700 sm:col-span-2">Título *
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required placeholder="Ex.: Reunião mensal na sede" className={`${field} bg-white`} />
          </label>
          <label className="text-sm font-medium text-gray-700 sm:col-span-2">Mensagem
            <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} placeholder="Horário, local, o que levar..." className={`${field} bg-white`} />
          </label>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" onClick={() => setCreating(false)} className={btnSecondary}>Cancelar</button>
            <button type="submit" className="flex-1 bg-green-700 hover:bg-green-600 text-white font-semibold py-2.5 rounded-lg">Publicar</button>
          </div>
        </form>
      )}
      {notices.length === 0 ? (
        <p className="py-10 text-center text-gray-500">Nenhum comunicado ainda.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {notices.map((n) => (
            <li key={n.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">{NOTICE_KINDS[n.kind] ?? 'Aviso'}{n.eventDate && ` · dia ${fmtDay(n.eventDate)}`}</p>
              <p className="mt-0.5 font-semibold text-gray-900">{n.title}</p>
              {n.body && <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{n.body}</p>}
              <p className="mt-1 text-xs text-gray-500">Publicado em {fmtDay(n.createdAt)}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <a href={`https://wa.me/?text=${encodeURIComponent(text(n))}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-700 hover:underline">Mandar pelo WhatsApp</a>
                <button type="button" onClick={() => remove(n)} className="font-medium text-red-600 hover:underline">Apagar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function VisitsSection({ members, visits, onChange }: { members: MemberRef[]; visits: Visit[]; onChange: () => void }) {
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ memberId: '', subject: '', description: '', scheduledFor: '', technician: '' })
  const [error, setError] = useState('')
  // Visita em edição: agendar (data + técnico) ou concluir (resultado)
  const [editing, setEditing] = useState<{ id: string; mode: 'agendar' | 'concluir'; scheduledFor: string; technician: string; result: string } | null>(null)
  const memberName = new Map(members.map((m) => [m.id, m.name]))
  const active = members.filter((m) => m.status === 'ativo')
  const order = { solicitada: 0, agendada: 1, concluida: 2, cancelada: 3 }
  const sorted = [...visits].sort((a, b) => order[a.status] - order[b.status] || (a.scheduledFor ?? a.createdAt).localeCompare(b.scheduledFor ?? b.createdAt))

  async function create(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { ok, data } = await send('/api/associacao/visitas', 'POST', form)
    if (!ok) return setError(data.error || 'Não foi possível salvar')
    setCreating(false)
    setForm({ memberId: '', subject: '', description: '', scheduledFor: '', technician: '' })
    onChange()
  }

  async function update(v: Visit, body: Record<string, unknown>) {
    const { ok } = await send(`/api/associacao/visitas/${v.id}`, 'PATCH', body)
    if (ok) setEditing(null)
    onChange()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Os associados pedem visita pelo aplicativo. Agende com o técnico e anote o resultado.</p>
        <button type="button" onClick={() => setCreating(true)} className={btnPrimary}>+ Nova visita</button>
      </div>
      {creating && (
        <form onSubmit={create} className="mb-5 grid gap-3 rounded-xl border border-green-200 bg-green-50/40 p-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-gray-700">Associado *
            <select value={form.memberId} onChange={(e) => setForm({ ...form, memberId: e.target.value })} required className={`${field} bg-white`}>
              <option value="">Escolha</option>
              {active.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Assunto *
            <input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required placeholder="Ex.: Mastite no rebanho" className={`${field} bg-white`} />
          </label>
          <label className="text-sm font-medium text-gray-700">Data
            <input type="date" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} className={`${field} bg-white`} />
          </label>
          <label className="text-sm font-medium text-gray-700">Técnico
            <input value={form.technician} onChange={(e) => setForm({ ...form, technician: e.target.value })} placeholder="Nome do técnico ou veterinário" className={`${field} bg-white`} />
          </label>
          <label className="text-sm font-medium text-gray-700 sm:col-span-2">Detalhes
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={`${field} bg-white`} />
          </label>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" onClick={() => setCreating(false)} className={btnSecondary}>Cancelar</button>
            <button type="submit" className="flex-1 bg-green-700 hover:bg-green-600 text-white font-semibold py-2.5 rounded-lg">Salvar visita</button>
          </div>
        </form>
      )}
      {sorted.length === 0 ? (
        <p className="py-10 text-center text-gray-500">Nenhuma visita técnica ainda.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {sorted.map((v) => {
            const st = VISIT_STATUS[v.status]
            const open = v.status === 'solicitada' || v.status === 'agendada'
            const edit = editing?.id === v.id ? editing : null
            return (
              <li key={v.id} className={`rounded-xl border border-gray-200 bg-white p-4 ${open ? '' : 'opacity-80'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{memberName.get(v.memberId) ?? '—'}</p>
                    <p className="text-sm text-gray-800">{v.subject}</p>
                    {v.description && <p className="text-sm text-gray-600">{v.description}</p>}
                    <p className="mt-1 text-xs text-gray-500">
                      {v.scheduledFor ? `Dia ${fmtDay(v.scheduledFor)}` : `Pedida em ${fmtDay(v.createdAt)}`}{v.technician && ` · ${v.technician}`}
                    </p>
                    {v.result && <p className="mt-1 text-sm text-gray-700"><span className="font-medium">Resultado:</span> {v.result}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${st.style}`}>{st.label}</span>
                </div>
                {edit ? (
                  <div className="mt-3 grid gap-2">
                    {edit.mode === 'agendar' ? (
                      <>
                        <input type="date" aria-label="Data da visita" value={edit.scheduledFor} onChange={(e) => setEditing({ ...edit, scheduledFor: e.target.value })} className={field} />
                        <input aria-label="Técnico" placeholder="Técnico" value={edit.technician} onChange={(e) => setEditing({ ...edit, technician: e.target.value })} className={field} />
                      </>
                    ) : (
                      <textarea aria-label="Resultado da visita" placeholder="O que foi feito e o que o produtor deve fazer" rows={3} value={edit.result} onChange={(e) => setEditing({ ...edit, result: e.target.value })} className={field} />
                    )}
                    <div className="flex gap-2">
                      <button type="button" onClick={() => setEditing(null)} className={btnSecondary}>Cancelar</button>
                      <button type="button" disabled={edit.mode === 'agendar' && !edit.scheduledFor}
                        onClick={() => update(v, edit.mode === 'agendar' ? { scheduledFor: edit.scheduledFor, technician: edit.technician } : { status: 'concluida', result: edit.result })}
                        className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white font-semibold py-2.5 rounded-lg">
                        {edit.mode === 'agendar' ? 'Agendar' : 'Concluir'}
                      </button>
                    </div>
                  </div>
                ) : open && (
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    <button type="button" onClick={() => setEditing({ id: v.id, mode: 'agendar', scheduledFor: v.scheduledFor?.slice(0, 10) ?? '', technician: v.technician ?? '', result: '' })} className="font-semibold text-green-700 hover:underline">
                      {v.status === 'agendada' ? 'Mudar data' : 'Agendar'}
                    </button>
                    <button type="button" onClick={() => setEditing({ id: v.id, mode: 'concluir', scheduledFor: '', technician: '', result: v.result ?? '' })} className="font-semibold text-green-700 hover:underline">Concluir</button>
                    <button type="button" onClick={() => update(v, { status: 'cancelada' })} className="font-medium text-gray-600 hover:underline">Cancelar visita</button>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

const thisMonth = () => todayISO().slice(0, 7)

export function FeesSection({ orgName, members, fees, onChange }: { orgName: string; members: MemberRef[]; fees: Fee[]; onChange: () => void }) {
  const { confirm } = useDialog()
  const references = [...new Set(fees.map((f) => f.reference))].sort().reverse()
  const [reference, setReference] = useState(references[0] ?? thisMonth())
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ reference: thisMonth(), amount: '', dueDate: `${thisMonth()}-10` })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const today = todayISO()
  const memberById = new Map(members.map((m) => [m.id, m]))
  const monthFees = fees.filter((f) => f.reference === reference)
    .sort((a, b) => (memberById.get(a.memberId)?.name ?? '').localeCompare(memberById.get(b.memberId)?.name ?? ''))
  const sum = (status: string) => monthFees.filter((f) => feeStatus(f, today) === status).reduce((s, f) => s + f.amount, 0)
  const late = fees.filter((f) => feeStatus(f, today) === 'atrasada')

  async function generate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const { ok, data } = await send('/api/associacao/mensalidades', 'POST', form)
    if (!ok) return setError(data.error || 'Não foi possível gerar')
    setCreating(false)
    setReference(form.reference)
    setNotice(data.created ? `${data.created} mensalidade${data.created === 1 ? '' : 's'} gerada${data.created === 1 ? '' : 's'}.` : 'Todos os associados ativos já tinham a mensalidade desse mês.')
    onChange()
  }

  async function setPaid(f: Fee, paid: boolean) {
    await send(`/api/associacao/mensalidades/${f.id}`, 'PATCH', { paid })
    onChange()
  }

  async function remove(f: Fee) {
    if (!(await confirm({ title: 'Apagar esta mensalidade?', message: `${memberById.get(f.memberId)?.name ?? ''} · ${fmtMonth(f.reference)}`, confirmLabel: 'Apagar', danger: true }))) return
    await send(`/api/associacao/mensalidades/${f.id}`, 'DELETE')
    onChange()
  }

  const badge = { paga: 'bg-green-100 text-green-800', aberta: 'bg-amber-100 text-amber-800', atrasada: 'bg-red-100 text-red-700' }
  const label = { paga: 'Paga', aberta: 'Em aberto', atrasada: 'Atrasada' }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Gere a mensalidade do mês para os associados ativos e marque quem já pagou.</p>
        <button type="button" onClick={() => setCreating(true)} className={btnPrimary}>+ Gerar mensalidades</button>
      </div>
      {creating && (
        <form onSubmit={generate} className="mb-5 grid gap-3 rounded-xl border border-green-200 bg-green-50/40 p-4 sm:grid-cols-3">
          <label className="text-sm font-medium text-gray-700">Mês *
            <input type="month" value={form.reference} required onChange={(e) => setForm({ ...form, reference: e.target.value, dueDate: `${e.target.value}-10` })} className={`${field} bg-white`} />
          </label>
          <label className="text-sm font-medium text-gray-700">Valor (R$) *
            <input inputMode="decimal" value={form.amount} required placeholder="Ex.: 50" onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${field} bg-white`} />
          </label>
          <label className="text-sm font-medium text-gray-700">Vencimento *
            <input type="date" value={form.dueDate} required onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className={`${field} bg-white`} />
          </label>
          {error && <p className="text-sm text-red-600 sm:col-span-3">{error}</p>}
          <div className="flex gap-2 sm:col-span-3">
            <button type="button" onClick={() => setCreating(false)} className={btnSecondary}>Cancelar</button>
            <button type="submit" className="flex-1 bg-green-700 hover:bg-green-600 text-white font-semibold py-2.5 rounded-lg">Gerar</button>
          </div>
        </form>
      )}
      {notice && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p>}
      {late.length > 0 && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {late.length} mensalidade{late.length === 1 ? '' : 's'} atrasada{late.length === 1 ? '' : 's'}, somando {fmtMoney(late.reduce((s, f) => s + f.amount, 0))}.
        </p>
      )}
      {references.length === 0 ? (
        <p className="py-10 text-center text-gray-500">Nenhuma mensalidade gerada ainda.</p>
      ) : (
        <>
          <label className="mb-3 block max-w-xs text-sm font-medium text-gray-700">Mês
            <select value={reference} onChange={(e) => setReference(e.target.value)} className={`${field} bg-white`}>
              {references.map((r) => <option key={r} value={r}>{fmtMonth(r)}</option>)}
            </select>
          </label>
          <div className="mb-3 grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-green-50 p-2"><p className="text-green-800">Recebido</p><p className="font-bold text-gray-900">{fmtMoney(sum('paga'))}</p></div>
            <div className="rounded-lg bg-amber-50 p-2"><p className="text-amber-800">Em aberto</p><p className="font-bold text-gray-900">{fmtMoney(sum('aberta'))}</p></div>
            <div className="rounded-lg bg-red-50 p-2"><p className="text-red-700">Atrasado</p><p className="font-bold text-gray-900">{fmtMoney(sum('atrasada'))}</p></div>
          </div>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {monthFees.map((f) => {
              const status = feeStatus(f, today)
              const m = memberById.get(f.memberId)
              return (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{m?.name ?? '—'}</p>
                    <p className="text-xs text-gray-500">{fmtMoney(f.amount)} · vence {fmtDay(f.dueDate)}{f.paidAt && ` · paga em ${fmtDay(f.paidAt)}`}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge[status]}`}>{label[status]}</span>
                    {status === 'atrasada' && m?.phone && (
                      <a href={whatsappLink(m.phone, `Olá! Aqui é da ${orgName}. A mensalidade de ${fmtMonth(f.reference)} (${fmtMoney(f.amount)}) venceu em ${fmtDay(f.dueDate)}.`)} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-700 hover:underline">Lembrar</a>
                    )}
                    <button type="button" onClick={() => setPaid(f, !f.paidAt)} className="font-semibold text-green-700 hover:underline">{f.paidAt ? 'Desfazer' : 'Marcar paga'}</button>
                    {!f.paidAt && <button type="button" onClick={() => remove(f)} className="font-medium text-red-600 hover:underline">Apagar</button>}
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
