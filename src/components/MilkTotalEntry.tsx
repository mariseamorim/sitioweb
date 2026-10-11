'use client'

import { useEffect, useRef, useState } from 'react'
import { addPendingRecord } from '@/lib/offlineStorage'
import { todayISO } from '@/lib/utils'
import { fmtNumber } from '@/lib/reports'
import { OfflineVoiceSetup, VoiceButton } from '@/components/VoiceButton'

interface Props {
  /** Total já lançado por data (yyyy-mm-dd), para avisar lançamento em dobro */
  totalsByDay: Map<string, number>
  isOnline: boolean
  onDone: (result: { pending: number }) => void
  /** Salvo sozinho: atualiza a tela sem fechar o formulário */
  onSaved: (result: { pending: number }) => void
  onCancel: () => void
}

// Cada lançamento soma ao dia, então o salvar sozinho espera a pessoa parar e salva uma vez só
const AUTO_SAVE_SECONDS = 5
const toQuantity = (text: string) => parseFloat(text.replace(',', '.'))

// Lançamento do leite do dia todo, sem separar por vaca (comum em sítio pequeno)
export function MilkTotalEntry({ totalsByDay, isOnline, onDone, onSaved, onCancel }: Props) {
  const [date, setDate] = useState(todayISO())
  const [liters, setLiters] = useState('')
  const [cows, setCows] = useState('')
  const [observations, setObservations] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [savedNote, setSavedNote] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  // O salvar sozinho mantém o formulário aberto; o botão Salvar fecha
  const autoRef = useRef(false)

  const quantity = toQuantity(liters)
  const already = totalsByDay.get(date)

  // Recomeça a contagem a cada mudança (só com litros válidos)
  const restartAutoSave = (litersText = liters) => {
    setSavedNote('')
    setCountdown(toQuantity(litersText) > 0 ? AUTO_SAVE_SECONDS : null)
  }

  useEffect(() => {
    if (countdown === null || saving) return
    const timer = setTimeout(() => {
      if (countdown > 1) return setCountdown(countdown - 1)
      setCountdown(null)
      autoRef.current = true
      formRef.current?.requestSubmit()
    }, 1000)
    return () => clearTimeout(timer)
  }, [countdown, saving])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setCountdown(null)
    const auto = autoRef.current
    autoRef.current = false
    if (!(quantity > 0) || saving) return
    setError('')
    const record = { date, quantity, cowsMilked: cows ? parseInt(cows, 10) : undefined, observations }

    // Sozinho: limpa os campos para a próxima ordenha e continua aberto
    const finish = (result: { pending: number }) => {
      if (!auto) return onDone(result)
      setLiters('')
      setCows('')
      setObservations('')
      setSavedNote(`Salvo: ${fmtNumber(quantity)} L${result.pending ? ' no celular (envia quando houver internet)' : ''}. Pode fechar ou anotar outra ordenha.`)
      onSaved(result)
    }

    if (!isOnline) {
      finish({ pending: addPendingRecord('milk_productions', record) })
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/milk-production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Não foi possível salvar. Tente de novo.')
        return
      }
      finish({ pending: 0 })
    } catch {
      setError('Sem conexão. Tente de novo ou salve quando o sinal voltar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form ref={formRef} onSubmit={handleSave} className="flex flex-col gap-4">
      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Data</label>
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => { setDate(e.target.value); restartAutoSave() }}
          required
          className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        {already !== undefined && (
          <p className="mt-1 text-sm text-amber-700">
            Já há {fmtNumber(already)} L lançados neste dia. O novo valor será somado (ex.: ordenha da tarde).
          </p>
        )}
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">Litros de leite</label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            inputMode="decimal"
            placeholder="0"
            autoFocus
            value={liters}
            onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, ''); setLiters(v); restartAutoSave(v) }}
            required
            className="w-full border border-gray-200 rounded-lg px-3 py-3 text-2xl font-semibold text-right focus:outline-none focus:ring-2 focus:ring-green-600"
          />
          <span className="text-lg text-gray-500">L</span>
        </div>
        {savedNote && countdown === null && (
          <p role="status" className="mt-2 rounded-lg bg-green-50 px-3 py-2.5 text-sm font-medium text-green-900">{savedNote}</p>
        )}
        {countdown !== null && !saving && (
          <div role="status" className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-green-50 px-3 py-2.5 text-sm text-green-900">
            <span>Salvando sozinho em {countdown} s...</span>
            <button type="button" onClick={() => setCountdown(null)} className="shrink-0 font-semibold underline">Não salvar ainda</button>
          </div>
        )}
        <VoiceButton label="os litros do dia" onNumber={(v) => { const t = String(v).replace('.', ','); setLiters(t); restartAutoSave(t) }} />
        <OfflineVoiceSetup online={isOnline} />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Vacas ordenhadas <span className="font-normal text-gray-400">(opcional)</span>
        </label>
        <input
          type="text"
          inputMode="numeric"
          placeholder="Ex.: 6"
          value={cows}
          onChange={(e) => setCows(e.target.value.replace(/\D/g, ''))}
          onFocus={() => setCountdown(null)}
          onBlur={() => restartAutoSave()}
          className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 block mb-1">
          Observações <span className="font-normal text-gray-400">(opcional)</span>
        </label>
        <input
          type="text"
          placeholder="Ex.: ordenha da manhã"
          value={observations}
          onChange={(e) => setObservations(e.target.value)}
          onFocus={() => setCountdown(null)}
          onBlur={() => restartAutoSave()}
          className="w-full border border-gray-200 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-green-600"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-gray-200 text-gray-600 text-base font-medium py-3 rounded-lg hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving || !(quantity > 0)}
          className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white text-base font-semibold py-3 rounded-lg"
        >
          {saving ? 'Salvando...' : isOnline ? 'Salvar' : 'Salvar no celular'}
        </button>
      </div>
    </form>
  )
}
