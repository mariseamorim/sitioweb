'use client'
import { MilkDecimalInput } from '@/components/MilkDecimalInput'
import { useState } from 'react'
import { milkDay, milkNumber, milkPrice } from '@/lib/milkValidation'
import { fmtMoney } from '@/lib/reports'
import { useT } from '@/lib/i18n'
import { AppModal, modalButton } from '@/components/AppModal'
import { LeiteIcon } from '@/components/ModuleIcons'

export interface EditableMilkProduction {
  id: string
  animalId: string | null
  date: string
  quantity: number
  pricePerLiter?: number | null
  cowsMilked?: number | null
  observations?: string | null
}

const fmtDate = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-'); return `${d}/${m}/${y}` }

export function MilkProductionEditor({ production, onCancel, onSaved }: { production: EditableMilkProduction; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ date: production.date.slice(0, 10), quantity: String(production.quantity).replace('.', ','), pricePerLiter: production.pricePerLiter == null ? '' : production.pricePerLiter.toFixed(2).replace('.', ','), cowsMilked: production.cowsMilked == null ? '' : String(production.cowsMilked), observations: production.observations || '' })
  const t = useT()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const quantity = milkNumber(form.quantity), price = milkPrice(form.pricePerLiter)
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError('')
    if (!milkDay(form.date) || !Number.isFinite(quantity) || quantity <= 0) { setError(t('Informe data e quantidade válidas')); return }
    if (price === undefined) { setError(t('Informe um preço por litro válido')); return }
    setSaving(true)
    try {
      const res = await fetch(`/api/milk-production/${production.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, quantity, pricePerLiter: price, cowsMilked: production.animalId || !form.cowsMilked ? null : form.cowsMilked }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar')
      onSaved()
    } catch (e) { setError(e instanceof Error ? t(e.message) : t('Verifique a conexão e tente novamente')) }
    finally { setSaving(false) }
  }
  const input = 'mt-1 block w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
  const label = 'text-sm font-medium text-gray-700'
  return <AppModal title={t('Editar produção de leite')} subtitle={fmtDate(production.date)} icon={<LeiteIcon className="h-6 w-6" />} tone="blue" onClose={onCancel}
    footer={<>
      <button type="button" onClick={onCancel} disabled={saving} className={modalButton.ghost}>{t('Cancelar')}</button>
      <button type="submit" form="form-editar-leite" disabled={saving} className={modalButton.primary}>{t(saving ? 'Salvando...' : 'Salvar alterações')}</button>
    </>}>
    <form id="form-editar-leite" onSubmit={save}>
      <fieldset disabled={saving} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>{t('Data')}<input required type="date" className={input} value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></label>
          <label className={label}>{t('Quantidade (litros)')}<MilkDecimalInput required inputMode="decimal" className={input} value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} placeholder={t('Ex.: 25')} /></label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>{t('Preço por litro (R$)')}<MilkDecimalInput decimals={2} inputMode="decimal" className={input} value={form.pricePerLiter} onChange={e => setForm({ ...form, pricePerLiter: e.target.value })} placeholder={t('Opcional')} /></label>
          {!production.animalId && <label className={label}>{t('Vacas ordenhadas')}<input inputMode="numeric" className={input} value={form.cowsMilked} onChange={e => setForm({ ...form, cowsMilked: e.target.value })} placeholder={t('Ex.: 12')} /></label>}
        </div>
        <label className={label}>{t('Observações')}<textarea rows={2} className={`${input} resize-none`} value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} placeholder={t('Ex.: uma vaca não ordenhou de tarde')} /></label>
        {price != null && Number.isFinite(quantity) && quantity > 0 && <p className="text-sm font-semibold text-green-700">{t('Valor estimado: {value}', { value: fmtMoney(quantity * price) })}</p>}
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </fieldset>
    </form>
  </AppModal>
}
