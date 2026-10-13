'use client'

import { useState } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { WEEKDAYS } from '@/lib/organizations'
import { type DairyPanel, type Route, field, send } from './types'

const EMPTY = { name: '', days: [] as number[], driverId: '', pointIds: [] as string[] }

// Rotas: nome, dias de coleta, motorista e a sequência das paradas
export function RoutesSection({ panel, onChanged }: { panel: DairyPanel; onChanged: () => void }) {
  const { confirm } = useDialog()
  const [editing, setEditing] = useState<Route | 'new' | null>(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const pointName = new Map(panel.points.map((p) => [p.id, p.name]))
  const driverName = new Map(panel.drivers.map((d) => [d.id, d.name]))

  function open(route: Route | 'new') {
    setError('')
    setEditing(route)
    setForm(route === 'new' ? EMPTY : { name: route.name, days: route.days, driverId: route.driverId ?? '', pointIds: route.stops.map((s) => s.pointId) })
  }

  function move(index: number, delta: number) {
    const ids = [...form.pointIds]
    const [id] = ids.splice(index, 1)
    ids.splice(index + delta, 0, id)
    setForm({ ...form, pointIds: ids })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const isNew = editing === 'new'
    const { ok, data } = await send(isNew ? '/api/laticinio/rotas' : `/api/laticinio/rotas/${(editing as Route).id}`, isNew ? 'POST' : 'PUT', form)
    setSaving(false)
    if (!ok) return setError(data.error || 'Não foi possível salvar')
    setEditing(null)
    onChanged()
  }

  async function remove(route: Route) {
    if (!(await confirm({ title: `Apagar a rota ${route.name}?`, message: 'As coletas já anotadas continuam no histórico.', confirmLabel: 'Apagar', danger: true }))) return
    await send(`/api/laticinio/rotas/${route.id}`, 'DELETE')
    onChanged()
  }

  const available = panel.points.filter((p) => p.active && !form.pointIds.includes(p.id))

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">O motorista vê no Anota Aí Leite as paradas das rotas dele, nos dias marcados.</p>
        <button type="button" onClick={() => open('new')} disabled={panel.points.length === 0}
          className="bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">+ Nova rota</button>
      </div>
      {panel.points.length === 0 && <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Cadastre primeiro os pontos de coleta.</p>}

      {editing && (
        <form onSubmit={save} className="mb-5 flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50/40 p-4">
          <h2 className="font-semibold text-gray-900">{editing === 'new' ? 'Nova rota' : 'Editar rota'}</h2>
          <label className="text-sm font-medium text-gray-700">Nome da rota *
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Ex.: Rota Córrego Fundo" className={`${field} bg-white`} />
          </label>
          <div>
            <p className="text-sm font-medium text-gray-700">Dias de coleta</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {WEEKDAYS.map((label, day) => {
                const on = form.days.includes(day)
                return (
                  <button key={label} type="button" aria-pressed={on} onClick={() => setForm({ ...form, days: on ? form.days.filter((d) => d !== day) : [...form.days, day] })}
                    className={`min-w-12 rounded-lg border-2 px-3 py-2 text-sm font-semibold ${on ? 'border-green-700 bg-green-700 text-white' : 'border-gray-300 bg-white text-gray-700'}`}>
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
          <label className="text-sm font-medium text-gray-700">Motorista
            <select value={form.driverId} onChange={(e) => setForm({ ...form, driverId: e.target.value })} className={`${field} bg-white`}>
              <option value="">Sem motorista por enquanto</option>
              {panel.drivers.map((d) => <option key={d.id} value={d.id}>{d.name}{d.vehicle ? ` (${d.vehicle})` : ''}</option>)}
            </select>
          </label>
          <div>
            <p className="text-sm font-medium text-gray-700">Paradas, na ordem da rota</p>
            {form.pointIds.length === 0 && <p className="mt-1 text-sm text-gray-500">Adicione os pontos de coleta abaixo.</p>}
            <ol className="mt-1 space-y-1">
              {form.pointIds.map((id, i) => (
                <li key={id} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2">
                  <span className="w-6 text-sm text-gray-400">{i + 1}.</span>
                  <span className="flex-1 text-gray-800">{pointName.get(id)}</span>
                  <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir" className="px-2 text-gray-600 disabled:text-gray-300">▲</button>
                  <button type="button" onClick={() => move(i, 1)} disabled={i === form.pointIds.length - 1} aria-label="Descer" className="px-2 text-gray-600 disabled:text-gray-300">▼</button>
                  <button type="button" onClick={() => setForm({ ...form, pointIds: form.pointIds.filter((p) => p !== id) })} aria-label="Tirar da rota" className="px-2 text-red-600">✕</button>
                </li>
              ))}
            </ol>
            {available.length > 0 && (
              <select value="" onChange={(e) => e.target.value && setForm({ ...form, pointIds: [...form.pointIds, e.target.value] })} className={`${field} bg-white`}>
                <option value="">+ Adicionar parada</option>
                {available.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setEditing(null)} className="flex-1 border border-gray-300 bg-white text-gray-700 font-medium py-2.5 rounded-lg">Cancelar</button>
            <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg">{saving ? 'Salvando...' : 'Salvar rota'}</button>
          </div>
        </form>
      )}

      {panel.routes.length === 0 ? (
        <p className="py-10 text-center text-gray-500">Nenhuma rota ainda.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {panel.routes.map((r) => (
            <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="font-semibold text-gray-900">{r.name}</p>
              <p className="text-sm text-gray-600">
                {r.days.length ? r.days.map((d) => WEEKDAYS[d]).join(', ') : <span className="text-amber-800">Sem dias marcados</span>}
                {' · '}{r.driverId ? driverName.get(r.driverId) : <span className="text-red-700">sem motorista</span>}
              </p>
              <p className="mt-1 text-sm text-gray-500">{r.stops.length} parada{r.stops.length === 1 ? '' : 's'}: {r.stops.map((s) => pointName.get(s.pointId)).join(' → ') || '—'}</p>
              <div className="mt-3 flex gap-3 text-sm">
                <button type="button" onClick={() => open(r)} className="font-semibold text-green-700 hover:underline">Editar</button>
                <button type="button" onClick={() => remove(r)} className="font-medium text-red-600 hover:underline">Apagar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
