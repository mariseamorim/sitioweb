'use client'

// "Entrar na recria": data da desmama, peso na desmama e peso-alvo. Com internet grava na hora; sem, fica na fila do aparelho.

import { useState } from 'react'
import { animalToday } from '@/lib/animalRules'
import { type RearingAnimal, day, rearingEntryError } from '@/lib/rearing'
import { queueRearing } from '@/lib/rearingQueue'

const FIELD = 'mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
const kgOf = (v: string) => { const n = Number(v.replace(',', '.')); return v.trim() ? (Number.isFinite(n) ? n : NaN) : null }

export function RearingEntryForm({ animal, farmId, isOnline, onCancel, onSaved }: {
  animal: { id: string; name: string; birthDate: string; gender: string }
  farmId: string
  isOnline: boolean
  onCancel: () => void
  /** O animal devolvido pelo servidor, ou null quando ficou na fila do aparelho */
  onSaved: (saved: RearingAnimal | null) => void
}) {
  const today = animalToday()
  const [form, setForm] = useState({ start: today, weight: '', target: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const decimal = (v: string) => v.replace(/[^\d.,]/g, '')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const weight = kgOf(form.weight)
    const target = kgOf(form.target)
    const ruleError = rearingEntryError({ start: form.start, birthDate: day(animal.birthDate), today, weight, target })
    if (ruleError) return setError(ruleError)
    setSaving(true)
    setError('')
    if (!isOnline) {
      queueRearing({ _type: 'entrar', animalId: animal.id, farmId, start: form.start, weight, target })
      setSaving(false)
      onSaved(null)
      return
    }
    try {
      const res = await fetch(`/api/animals/${animal.id}/recria`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ start: form.start, weight, target }) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar')
      onSaved(data)
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : 'Sem internet. Tente de novo: o registro vai para a fila do aparelho.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 rounded-xl bg-sky-50 p-3 sm:grid-cols-3">
      <p className="text-sm text-gray-700 sm:col-span-3"><strong>{animal.name}</strong> entra na recria. A partir daqui o app acompanha o peso, o ganho por dia{animal.gender === 'Fêmea' ? ' e a cobertura' : ''}.</p>
      <label className="text-sm font-medium text-gray-700">Data da desmama
        <input type="date" required max={today} value={form.start} onChange={(e) => setForm({ ...form, start: e.target.value })} className={FIELD} />
      </label>
      <label className="text-sm font-medium text-gray-700">Peso na desmama (kg)
        <input inputMode="decimal" value={form.weight} onChange={(e) => setForm({ ...form, weight: decimal(e.target.value) })} placeholder="Ex.: 180" className={FIELD} />
      </label>
      <label className="text-sm font-medium text-gray-700">Peso-alvo (kg, opcional)
        <input inputMode="decimal" value={form.target} onChange={(e) => setForm({ ...form, target: decimal(e.target.value) })} placeholder={animal.gender === 'Fêmea' ? 'Ex.: 320 para cobrir' : 'Ex.: 360 para a engorda'} className={FIELD} />
      </label>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700 sm:col-span-3">{error}</p>}
      {!isOnline && <p className="text-xs text-amber-800 sm:col-span-3">Sem internet: fica guardado no aparelho e sobe quando o sinal voltar.</p>}
      <div className="flex gap-2 sm:col-span-3">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-gray-300 py-2.5 font-semibold text-gray-700">Cancelar</button>
        <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-sky-700 py-2.5 font-semibold text-white disabled:bg-gray-300">{saving ? 'Salvando...' : 'Entrar na recria'}</button>
      </div>
    </form>
  )
}
