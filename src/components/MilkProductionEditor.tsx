'use client'
import { MilkDecimalInput } from '@/components/MilkDecimalInput'
import { useState } from 'react'
import { milkDay, milkNumber, milkPrice } from '@/lib/milkValidation'
import { fmtMoney } from '@/lib/reports'

export interface EditableMilkProduction {
  id: string
  animalId: string | null
  date: string
  quantity: number
  pricePerLiter?: number | null
  cowsMilked?: number | null
  observations?: string | null
}

export function MilkProductionEditor({ production, onCancel, onSaved }: { production: EditableMilkProduction; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ date: production.date.slice(0, 10), quantity: String(production.quantity).replace('.', ','), pricePerLiter: production.pricePerLiter == null ? '' : production.pricePerLiter.toFixed(2).replace('.', ','), cowsMilked: production.cowsMilked == null ? '' : String(production.cowsMilked), observations: production.observations || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const quantity = milkNumber(form.quantity), price = milkPrice(form.pricePerLiter)
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!milkDay(form.date) || !Number.isFinite(quantity) || quantity <= 0) { setError('Informe data e quantidade válidas'); return }
    if (price === undefined) { setError('Informe um preço por litro válido'); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/milk-production/${production.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, quantity, pricePerLiter: price, cowsMilked: production.animalId || !form.cowsMilked ? null : form.cowsMilked }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar')
      onSaved()
    } catch (e) { setError(e instanceof Error ? e.message : 'Verifique a conexão e tente novamente') }
    finally { setSaving(false) }
  }
  const input = 'mt-1 block w-full rounded-lg border border-gray-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div role="dialog" aria-modal="true" aria-labelledby="milk-edit-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl">
      <h2 id="milk-edit-title" className="mb-4 text-lg font-bold text-gray-800">Editar produção de leite</h2>
      <form onSubmit={save}>
        <fieldset disabled={saving} className="flex flex-col gap-3">
          <label>Data<input required type="date" className={input} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
          <label>Quantidade (litros)<MilkDecimalInput required inputMode="decimal" className={input} value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} /></label>
          <label>Preço por litro (R$)<MilkDecimalInput decimals={2} inputMode="decimal" className={input} value={form.pricePerLiter} onChange={e => setForm({ ...form, pricePerLiter: e.target.value })} placeholder="Opcional" /></label>
          {!production.animalId && <label>Vacas ordenhadas<input inputMode="numeric" className={input} value={form.cowsMilked} onChange={e => setForm({ ...form, cowsMilked: e.target.value })} /></label>}
          <label>Observações<textarea rows={2} className={input} value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} /></label>
          {price != null && Number.isFinite(quantity) && quantity > 0 && <p className="text-sm font-semibold text-green-700">Valor estimado: {fmtMoney(quantity * price)}</p>}
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <div className="mt-2 flex gap-2"><button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-gray-200 py-3 text-gray-600">Cancelar</button><button type="submit" className="flex-1 rounded-lg bg-green-700 py-3 font-semibold text-white">{saving ? 'Salvando...' : 'Salvar alterações'}</button></div>
        </fieldset>
      </form>
    </div>
  </div>
}
