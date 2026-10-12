'use client'
import { MilkDecimalInput } from '@/components/MilkDecimalInput'
import { useState } from 'react'
import { milkPrice } from '@/lib/milkValidation'

export function MilkPriceSettings({ price, canEdit, online, onSaved }: { price: number | null; canEdit: boolean; online: boolean; onSaved: (price: number | null) => void }) {
  const [editedValue, setEditedValue] = useState<string | null>(null)
  const value = editedValue ?? (price === null ? '' : price.toFixed(2).replace('.', ','))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaved(false)
    if (milkPrice(value) === undefined) { setError('Informe um preço válido, por exemplo 2,50'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/milk-production/price', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ price: value }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar')
      setSaved(true); setEditedValue(null); onSaved(data.price)
    } catch (e) { setError(e instanceof Error ? e.message : 'Verifique a conexão e tente novamente') }
    finally { setSaving(false) }
  }
  return <form onSubmit={save} className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium text-gray-700">Preço padrão por litro (R$)
        <MilkDecimalInput decimals={2} inputMode="decimal" value={value} disabled={!canEdit || saving} onChange={e => { setEditedValue(e.target.value); setSaved(false) }} placeholder="Ex.: 2,50" className="mt-1 block w-full max-w-48 rounded-lg border border-gray-200 px-3 py-2.5" />
      </label>
      {canEdit && <button type="submit" disabled={!online || saving} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white disabled:bg-gray-300">{saving ? 'Salvando...' : 'Salvar preço'}</button>}
    </div>
    <p className="mt-2 text-xs text-gray-500">Usado nos próximos lançamentos. Cada registro mantém seu próprio preço; alterações não mudam o histórico.</p>
    {!online && <p className="mt-1 text-xs text-amber-800">Conecte-se à internet para alterar o preço padrão.</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
    {saved && <p role="status" className="mt-2 text-sm text-green-700">Preço salvo.</p>}
  </form>
}
