'use client'

import { useState } from 'react'
import { type Point, field, send } from './types'
import { maskPhone } from '@/lib/masks'

const EMPTY = { name: '', kind: 'sitio', contactName: '', phone: '', address: '', tankLiters: '', accessNotes: '' }

// Pontos de coleta: sítio ou tanque comunitário, com responsável, telefone, localização, tanque e acesso
export function PointsSection({ points, onChanged }: { points: Point[]; onChanged: () => void }) {
  const [editing, setEditing] = useState<Point | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value })

  function open(point: Point | 'new') {
    setError('')
    setEditing(point)
    setForm(point === 'new' ? EMPTY : {
      name: point.name, kind: point.kind, contactName: point.contactName ?? '', phone: point.phone ?? '',
      address: point.address ?? '', tankLiters: point.tankLiters ? String(point.tankLiters).replace('.', ',') : '', accessNotes: point.accessNotes ?? '',
    })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const isNew = editing === 'new'
    const { ok, data } = await send(isNew ? '/api/laticinio/pontos' : `/api/laticinio/pontos/${(editing as Point).id}`, isNew ? 'POST' : 'PATCH', form)
    setSaving(false)
    if (!ok) return setError(data.error || 'Não foi possível salvar')
    setEditing(null)
    onChanged()
  }

  async function toggle(point: Point) {
    await send(`/api/laticinio/pontos/${point.id}`, 'PATCH', { active: !point.active })
    onChanged()
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Sítios e tanques comunitários onde o caminhão passa.</p>
        <button type="button" onClick={() => open('new')} className="bg-green-700 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">+ Novo ponto</button>
      </div>

      {editing && (
        <form onSubmit={save} className="mb-5 grid gap-3 rounded-xl border border-green-200 bg-green-50/40 p-4 sm:grid-cols-2">
          <h2 className="font-semibold text-gray-900 sm:col-span-2">{editing === 'new' ? 'Novo ponto de coleta' : 'Editar ponto de coleta'}</h2>
          <label className="text-sm font-medium text-gray-700">Nome *
            <input value={form.name} onChange={set('name')} required placeholder="Ex.: Sítio Boa Vista" className={`${field} bg-white`} />
          </label>
          <label className="text-sm font-medium text-gray-700">Tipo
            <select value={form.kind} onChange={set('kind')} className={`${field} bg-white`}>
              <option value="sitio">Sítio</option>
              <option value="tanque">Tanque comunitário</option>
            </select>
          </label>
          <label className="text-sm font-medium text-gray-700">Responsável
            <input value={form.contactName} onChange={set('contactName')} className={`${field} bg-white`} />
          </label>
          <label className="text-sm font-medium text-gray-700">Telefone
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} inputMode="tel" placeholder="(35) 99999-0000" className={`${field} bg-white`} />
          </label>
          <label className="text-sm font-medium text-gray-700 sm:col-span-2">Localização / como chegar
            <input value={form.address} onChange={set('address')} placeholder="Ex.: estrada do Córrego Fundo, km 4" className={`${field} bg-white`} />
          </label>
          <label className="text-sm font-medium text-gray-700">Tanque (litros)
            <input value={form.tankLiters} onChange={set('tankLiters')} inputMode="decimal" placeholder="Ex.: 500" className={`${field} bg-white`} />
          </label>
          <label className="text-sm font-medium text-gray-700 sm:col-span-2">Instruções de acesso
            <textarea value={form.accessNotes} onChange={set('accessNotes')} rows={2} placeholder="Ex.: porteira com cadeado, chave com o vizinho" className={`${field} bg-white resize-none`} />
          </label>
          {error && <p className="text-sm text-red-600 sm:col-span-2">{error}</p>}
          <div className="flex gap-2 sm:col-span-2">
            <button type="button" onClick={() => setEditing(null)} className="flex-1 border border-gray-300 bg-white text-gray-700 font-medium py-2.5 rounded-lg">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg">{saving ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      )}

      {points.length === 0 ? (
        <p className="py-10 text-center text-gray-500">Nenhum ponto de coleta ainda.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {points.map((p) => (
            <li key={p.id} className={`rounded-xl border border-gray-200 bg-white p-4 ${p.active ? '' : 'opacity-60'}`}>
              <p className="font-semibold text-gray-900">
                {p.name}
                {p.kind === 'tanque' && <span className="ml-2 text-xs font-medium text-gray-500">Tanque comunitário</span>}
                {!p.active && <span className="ml-2 text-xs text-gray-500">(arquivado)</span>}
              </p>
              <p className="text-sm text-gray-600">
                {[p.contactName, p.phone].filter(Boolean).join(' · ') || 'Sem contato'}
                {p.tankLiters ? ` · tanque ${p.tankLiters.toLocaleString('pt-BR')} L` : ''}
              </p>
              {p.address && <p className="text-sm text-gray-500">{p.address}</p>}
              {p.accessNotes && <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-sm text-amber-900">Acesso: {p.accessNotes}</p>}
              <div className="mt-3 flex gap-3 text-sm">
                <button type="button" onClick={() => open(p)} className="font-semibold text-green-700 hover:underline">Editar</button>
                <button type="button" onClick={() => toggle(p)} className="font-medium text-gray-600 hover:underline">{p.active ? 'Arquivar' : 'Reativar'}</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
