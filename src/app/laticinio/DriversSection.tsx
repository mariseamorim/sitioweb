'use client'

import { useState } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { whatsappLink } from '@/lib/utils'
import { type Driver, type Route, field, send } from './types'

const EMPTY = { name: '', email: '', password: '', phone: '', vehicle: '' }

// Motoristas: o laticínio cria o acesso; o motorista entra no Anota Aí Leite e vê as rotas atribuídas
export function DriversSection({ drivers, routes, onChanged }: { drivers: Driver[]; routes: Route[]; onChanged: () => void }) {
  const { confirm } = useDialog()
  const [editing, setEditing] = useState<Driver | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ name: string; email: string; password: string; phone: string } | null>(null)
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })

  function open(driver: Driver | 'new') {
    setError('')
    setCreated(null)
    setEditing(driver)
    setForm(driver === 'new' ? EMPTY : { name: driver.name, email: driver.email, password: '', phone: driver.phone ?? '', vehicle: driver.vehicle ?? '' })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const isNew = editing === 'new'
    const body = isNew ? form : { name: form.name, phone: form.phone, vehicle: form.vehicle }
    const { ok, data } = await send(isNew ? '/api/laticinio/motoristas' : `/api/laticinio/motoristas/${(editing as Driver).id}`, isNew ? 'POST' : 'PATCH', body)
    setSaving(false)
    if (!ok) return setError(data.error || 'Não foi possível salvar')
    if (isNew) setCreated({ name: form.name, email: form.email, password: form.password, phone: form.phone })
    setEditing(null)
    onChanged()
  }

  async function unlink(driver: Driver) {
    if (!(await confirm({ title: `Desligar ${driver.name}?`, message: 'Ele sai das rotas e deixa de ver os pontos de coleta. As coletas já feitas continuam no histórico.', confirmLabel: 'Desligar', danger: true }))) return
    await send(`/api/laticinio/motoristas/${driver.id}`, 'DELETE')
    onChanged()
  }

  const accessText = created && `Olá, ${created.name}! Seu acesso ao Anota Aí Leite para as coletas: entre em ${typeof window !== 'undefined' ? window.location.origin : ''}/login com o e-mail ${created.email} e a senha ${created.password}.`

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">O motorista usa o Anota Aí Leite no celular, mesmo sem internet.</p>
        <button type="button" onClick={() => open('new')} className="bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">+ Novo motorista</button>
      </div>

      {created && (
        <div role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="font-semibold text-green-900">Acesso criado para {created.name}.</p>
          <p className="mt-1 text-sm text-green-900">Passe o e-mail e a senha para ele. Ele entra pelo login normal e já vê as rotas.</p>
          {created.phone && accessText && (
            <a href={whatsappLink(created.phone, accessText)} target="_blank" rel="noopener noreferrer"
              className="mt-3 inline-flex bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">Mandar o acesso pelo WhatsApp</a>
          )}
        </div>
      )}

      {editing && (
        <form onSubmit={save} className="mb-5 grid gap-3 rounded-xl border border-green-200 bg-green-50/40 p-4 sm:grid-cols-2">
          <h2 className="font-semibold text-gray-900 sm:col-span-2">{editing === 'new' ? 'Novo motorista' : 'Editar motorista'}</h2>
          <label className="text-sm font-medium text-gray-700">Nome *
            <input value={form.name} onChange={set('name')} required className={`${field} bg-white`} />
          </label>
          <label className="text-sm font-medium text-gray-700">Telefone / WhatsApp
            <input value={form.phone} onChange={set('phone')} inputMode="tel" className={`${field} bg-white`} />
          </label>
          <label className="text-sm font-medium text-gray-700">Veículo
            <input value={form.vehicle} onChange={set('vehicle')} placeholder="Ex.: caminhão tanque ABC-1234" className={`${field} bg-white`} />
          </label>
          {editing === 'new' && (
            <>
              <label className="text-sm font-medium text-gray-700">E-mail para entrar *
                <input type="email" value={form.email} onChange={set('email')} required className={`${field} bg-white`} />
              </label>
              <label className="text-sm font-medium text-gray-700">Senha *
                <input value={form.password} onChange={set('password')} required minLength={6} placeholder="Pelo menos 6 caracteres" className={`${field} bg-white`} />
              </label>
            </>
          )}
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" onClick={() => setEditing(null)} className="flex-1 border border-gray-300 bg-white text-gray-700 font-medium py-2.5 rounded-lg">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      )}

      {drivers.length === 0 ? (
        <p className="py-10 text-center text-gray-500">Nenhum motorista ainda.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {drivers.map((d) => {
            const mine = routes.filter((r) => r.driverId === d.id)
            return (
              <li key={d.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="font-semibold text-gray-900">{d.name}</p>
                <p className="text-sm text-gray-600">{[d.phone, d.vehicle].filter(Boolean).join(' · ') || d.email}</p>
                <p className="mt-1 text-sm text-gray-500">{mine.length ? `Rotas: ${mine.map((r) => r.name).join(', ')}` : 'Sem rota atribuída'}</p>
                <div className="mt-3 flex flex-wrap gap-3 text-sm">
                  <button type="button" onClick={() => open(d)} className="font-semibold text-green-700 hover:underline">Editar</button>
                  {d.phone && <a href={whatsappLink(d.phone, `Olá, ${d.name}!`)} target="_blank" rel="noopener noreferrer" className="font-semibold text-green-700 hover:underline">WhatsApp</a>}
                  <button type="button" onClick={() => unlink(d)} className="font-medium text-red-600 hover:underline">Desligar</button>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
