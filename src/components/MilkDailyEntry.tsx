'use client'
import { MilkDecimalInput } from '@/components/MilkDecimalInput'

import { useMemo, useState } from 'react'
import { addPendingRecord } from '@/lib/offlineStorage'
import { todayISO } from '@/lib/utils'
import { fmtNumber } from '@/lib/reports'
import { OfflineVoiceSetup, VoiceButton } from '@/components/VoiceButton'
import { milkNumber, milkPrice } from '@/lib/milkValidation'

interface Cow {
  id: string
  name: string
  code: string
}

interface Props {
  defaultPrice?: number | null
  cows: Cow[]
  productions: { animalId: string | null; date: string; quantity: number }[]
  isOnline: boolean
  onDone: (result: { saved: number; pending: number }) => void
  onCancel: () => void
}

// Lançamento da ordenha do dia: todas as vacas numa lista, um campo de litros por vaca
export function MilkDailyEntry({ cows, productions, isOnline, onDone, onCancel, defaultPrice = null }: Props) {
  const [date, setDate] = useState(todayISO())
  const [liters, setLiters] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [price, setPrice] = useState(defaultPrice === null ? '' : defaultPrice.toFixed(2).replace('.', ','))

  // Quanto cada vaca já tem lançado na data escolhida
  const alreadyByCow = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of productions) {
      if (!p.animalId || p.date.slice(0, 10) !== date) continue
      map.set(p.animalId, (map.get(p.animalId) ?? 0) + p.quantity)
    }
    return map
  }, [productions, date])

  const filled = cows
    .map((c) => ({ animalId: c.id, quantity: milkNumber(liters[c.id] ?? '') }))
    .filter((i) => i.quantity > 0)
  const total = filled.reduce((s, i) => s + i.quantity, 0)

  async function handleSave() {
    if (filled.length === 0) return
    setError('')
    const pricePerLiter = milkPrice(price)
    if (pricePerLiter === undefined) { setError('Informe um preço por litro válido, por exemplo 2,50'); return }

    if (!isOnline) {
      let pending = 0
      for (const item of filled) {
        pending = addPendingRecord('milk_productions', { animalId: item.animalId, date, quantity: item.quantity, observations: '', pricePerLiter })
      }
      onDone({ saved: 0, pending })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/milk-production/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, items: filled, pricePerLiter }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Não foi possível salvar. Tente de novo.')
        return
      }
      onDone({ saved: data.created, pending: 0 })
    } catch {
      setError('Sem conexão. Tente de novo ou salve quando o sinal voltar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Data da ordenha</label>
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      </div>

      {cows.length === 0 ? (
        <p className="text-center text-gray-500 py-8">Nenhuma vaca cadastrada. Use a aba &quot;Total do dia&quot; ou cadastre as vacas em Animais.</p>
      ) : (
        <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl max-h-[50vh] overflow-y-auto">
          {cows.map((c) => {
            const already = alreadyByCow.get(c.id)
            return (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="w-10 h-10 shrink-0 rounded-lg bg-gray-100 text-gray-600 flex items-center justify-center text-sm font-bold">
                  {c.code}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-medium text-gray-800 truncate">{c.name}</p>
                  {already !== undefined && (
                    <p className="text-xs text-amber-700">Já lançado neste dia: {fmtNumber(already)} L</p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <MilkDecimalInput
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    aria-label={`Litros de ${c.name}`}
                    value={liters[c.id] ?? ''}
                    onChange={(e) => setLiters({ ...liters, [c.id]: e.target.value.replace(/[^\d.,]/g, '') })}
                    className="w-20 border border-gray-200 rounded-lg px-2 py-2.5 text-base text-right focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                  <span className="text-sm text-gray-500">L</span>
                </div>
                <VoiceButton size="sm" label={`os litros de ${c.name}`}
                  onNumber={(v) => setLiters((l) => ({ ...l, [c.id]: String(v).replace('.', ',') }))} />
              </li>
            )
          })}
        </ul>
      )}
      {cows.length > 0 && <OfflineVoiceSetup online={isOnline} />}

      <label className="text-sm font-medium text-gray-700">Preço por litro (R$) <span className="font-normal text-gray-400">(opcional, aplicado a todas as vacas deste lançamento)</span>
        <MilkDecimalInput decimals={2} inputMode="decimal" value={price} onChange={e => setPrice(e.target.value)} placeholder="Ex.: 2,50" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-3 text-base" />
      </label>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{filled.length} de {cows.length} vacas</span>
        <span className="text-lg font-bold text-green-700">{fmtNumber(total)} L</span>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-200 text-gray-600 text-base font-medium py-3 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || filled.length === 0}
          className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white text-base font-semibold py-3 rounded-lg"
        >
          {saving ? 'Salvando...' : isOnline ? 'Salvar ordenha' : 'Salvar no celular'}
        </button>
      </div>
    </div>
  )
}
