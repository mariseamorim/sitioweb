'use client'

import { useState } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { todayISO } from '@/lib/utils'
import { type DairyPanel, type Reception, field, fmtDay, fmtL, send } from './types'
import { PeriodPicker } from './CollectionsSection'

// Recebimento: litros que chegaram ao laticínio, comparados com os coletados (mesmo dia e rota)
export function ReceptionSection({ panel, period, onPeriod, onChanged }: {
  panel: DairyPanel
  period: { from: string; to: string }
  onPeriod: (p: { from: string; to: string }) => void
  onChanged: () => void
}) {
  const { confirm } = useDialog()
  const [form, setForm] = useState({ date: todayISO(), routeId: '', liters: '', note: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const routeName = new Map(panel.routes.map((r) => [r.id, r.name]))

  // Coletado no dia: pontos da rota (ou todos, se o recebimento não indicar rota)
  function collected(r: Reception) {
    const points = r.routeId ? new Set(panel.routes.find((x) => x.id === r.routeId)?.stops.map((s) => s.pointId) ?? []) : null
    return panel.entries.filter((e) => e.date === r.date && !e.skipReason && (!points || points.has(e.pointId))).reduce((s, e) => s + e.liters, 0)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const { ok, data } = await send('/api/laticinio/recebimentos', 'POST', form)
    setSaving(false)
    if (!ok) return setError(data.error || 'Não foi possível salvar')
    setForm({ ...form, liters: '', note: '' })
    onChanged()
  }

  async function remove(r: Reception) {
    if (!(await confirm({ title: 'Apagar este recebimento?', message: `${fmtDay(r.date)} · ${fmtL(r.liters)}`, confirmLabel: 'Apagar', danger: true }))) return
    await send(`/api/laticinio/recebimentos/${r.id}`, 'DELETE')
    onChanged()
  }

  return (
    <div>
      <form onSubmit={save} className="mb-5 grid gap-3 rounded-xl border border-gray-200 bg-white p-4 sm:grid-cols-4">
        <h2 className="font-semibold text-gray-900 sm:col-span-4">Anotar leite recebido</h2>
        <label className="text-sm font-medium text-gray-700">Data
          <input type="date" value={form.date} max={todayISO()} onChange={(e) => setForm({ ...form, date: e.target.value })} required className={field} />
        </label>
        <label className="text-sm font-medium text-gray-700">Rota
          <select value={form.routeId} onChange={(e) => setForm({ ...form, routeId: e.target.value })} className={`${field} bg-white`}>
            <option value="">Todas / sem rota</option>
            {panel.routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">Litros recebidos *
          <input value={form.liters} onChange={(e) => setForm({ ...form, liters: e.target.value.replace(/[^\d.,]/g, '') })} required inputMode="decimal" className={field} />
        </label>
        <label className="text-sm font-medium text-gray-700">Observação
          <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className={field} />
        </label>
        {error && <p className="text-sm text-red-600 sm:col-span-4">{error}</p>}
        <button type="submit" disabled={saving} className="bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white font-semibold py-2.5 rounded-lg sm:col-span-4 sm:justify-self-start sm:px-8">
          {saving ? 'Salvando...' : 'Salvar recebimento'}
        </button>
      </form>

      <PeriodPicker period={period} onPeriod={onPeriod} />
      {panel.receptions.length === 0 ? (
        <p className="py-8 text-center text-gray-500">Nenhum recebimento no período.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3 text-left">Data</th>
                <th className="px-4 py-3 text-left">Rota</th>
                <th className="px-4 py-3 text-right">Coletado</th>
                <th className="px-4 py-3 text-right">Recebido</th>
                <th className="px-4 py-3 text-right">Diferença</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {panel.receptions.map((r) => {
                const c = collected(r)
                const diff = r.liters - c
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">{fmtDay(r.date)}</td>
                    <td className="px-4 py-2.5">{r.routeId ? routeName.get(r.routeId) ?? '—' : 'Todas'}{r.note && <span className="block text-xs text-gray-500">{r.note}</span>}</td>
                    <td className="px-4 py-2.5 text-right">{fmtL(c)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{fmtL(r.liters)}</td>
                    <td className={`px-4 py-2.5 text-right font-semibold ${Math.abs(diff) < 0.05 ? 'text-green-700' : 'text-amber-800'}`}>{diff > 0 ? '+' : ''}{fmtL(diff)}</td>
                    <td className="px-4 py-2.5 text-right"><button type="button" onClick={() => remove(r)} className="text-red-600 hover:underline">Apagar</button></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
