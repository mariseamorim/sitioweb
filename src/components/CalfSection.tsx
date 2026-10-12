'use client'

import { useEffect, useRef, useState } from 'react'
import { addPendingRecord } from '@/lib/offlineStorage'
import { todayISO } from '@/lib/utils'
import { calvingStarts, cowCalving, monthsLabel, plural } from '@/lib/calving'
import { canAddCalf } from '@/lib/animalRules'

export interface HerdAnimal {
  id: string
  code: string
  name: string
  species: string
  gender: string
  birthDate: string
  status: string
  motherId?: string | null
}

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
const calfLabel = (a: HerdAnimal) => (a.gender === 'Fêmea' ? 'Bezerra' : 'Bezerro')
const OUTCOMES = [['Vivo', 'Viva'], ['Morto', 'Morreu'], ['Vendido', 'Vendida']] as const

const field = 'mt-1 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'

// Crias da vaca dentro da ficha dela: lista com o intervalo entre partos e "Adicionar cria"
export function CalfSection({ mother, animals, farmId, canEdit, isOnline, onOpen, onChanged }: {
  mother: HerdAnimal
  animals: HerdAnimal[]
  farmId: string
  canEdit: boolean
  isOnline: boolean
  onOpen: (animal: HerdAnimal) => void
  onChanged: () => void
}) {
  const calves = animals.filter((a) => a.motherId === mother.id).sort((a, b) => a.birthDate.localeCompare(b.birthDate))
  const [adding, setAdding] = useState(false)
  const eligible = canAddCalf(mother)

  // Intervalo conta entre partos (gêmeos são o mesmo parto)
  const stats = cowCalving(mother, animals)
  const calvingStart = calvingStarts(calves.map((c) => c.birthDate))
  const { averageInterval: average, monthsSinceLast: sinceLast } = stats
  // Nota em cada cria: intervalo desde o parto anterior, ou "mesmo parto" para gêmeos
  const opened = new Set<string>()
  const note = calves.map((c) => {
    const iso = new Date(c.birthDate).toISOString()
    const index = calvingStart.indexOf(iso)
    if (index < 0 || opened.has(iso)) return 'mesmo parto (gêmeos)'
    opened.add(iso)
    return index > 0 ? `${monthsLabel(stats.intervals[index - 1])} depois do parto anterior` : ''
  })

  return (
    <section className="mt-5 border-t border-gray-100 pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-gray-900">Crias</h3>
        {canEdit && !adding && !mother.id.startsWith('pending_') && (
          <button type="button" disabled={!eligible} onClick={() => setAdding(true)} className="bg-green-700 hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-3 py-2 rounded-lg">
            + Adicionar cria
          </button>
        )}
      </div>
      {!eligible && <p className="mt-2 text-sm text-amber-700">Adicionar cria fica disponível quando a fêmea completar 2 anos e meio.</p>}

      {calves.length > 0 && (
        <p className="mt-1 text-sm text-gray-600">
          {plural(calves.length, 'cria', 'crias')}
          {calvingStart.length < calves.length && ` em ${plural(calvingStart.length, 'parto', 'partos')}`}
          {average !== null && ` · um parto a cada ${monthsLabel(average)} em média`}
          {sinceLast !== null && ` · última há ${monthsLabel(sinceLast)}`}
        </p>
      )}

      {adding && eligible && (
        <AddCalfForm mother={mother} animals={animals} farmId={farmId} isOnline={isOnline}
          onCancel={() => setAdding(false)} onSaved={() => { setAdding(false); onChanged() }} />
      )}

      {calves.length === 0 && !adding ? (
        <p className="mt-2 text-sm text-gray-500">Nenhuma cria anotada ainda.</p>
      ) : (
        <ol className="mt-3 space-y-2">
          {calves.map((c, i) => (
            <li key={c.id}>
              <button type="button" onClick={() => onOpen(c)} className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-left hover:bg-gray-50">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900">{fmtDate(c.birthDate)} · {calfLabel(c)}</span>
                  {c.status !== 'Vivo' && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{c.status}</span>}
                </span>
                <span className="block text-sm text-gray-600">
                  {c.name}{c.code ? ` (${c.code})` : ''}
                  {note[i] && <span className="text-gray-500"> · {note[i]}</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** Formulário de cria (usado na ficha da vaca e no "Registrar parto" da Reprodução) */
export function AddCalfForm({ mother, animals, farmId, isOnline, onCancel, onSaved }: {
  mother: HerdAnimal
  animals: HerdAnimal[]
  farmId: string
  isOnline: boolean
  onCancel: () => void
  onSaved: () => void
}) {
  const [birthDate, setBirthDate] = useState(todayISO())
  const [gender, setGender] = useState<'Fêmea' | 'Macho' | ''>('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<(typeof OUTCOMES)[number][0]>('Vivo')
  const [existing, setExisting] = useState(false)
  const [existingId, setExistingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const year = birthDate.slice(0, 4)
  const defaultName = `Cria da ${mother.name} ${year}`
  // Para ligar uma cria já cadastrada: animais sem mãe, mais novos que a vaca
  const candidates = animals
    .filter((a) => !a.motherId && a.id !== mother.id && !a.id.startsWith('pending_') && a.birthDate > mother.birthDate)
    .sort((a, b) => b.birthDate.localeCompare(a.birthDate))

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (!canAddCalf(mother)) return setError('A mãe precisa ter pelo menos 2 anos e meio para adicionar cria')
    if (existing) {
      if (!existingId) return setError('Escolha a cria')
      if (!isOnline) return setError('Para ligar uma cria já cadastrada, é preciso internet.')
      setSaving(true)
      try {
        const res = await fetch(`/api/animals/${existingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ motherId: mother.id }) })
        const data = await res.json()
        if (!res.ok) return setError(data.error || 'Não foi possível salvar')
        onSaved()
      } catch {
        setError('Sem conexão. Tente de novo.')
      } finally {
        setSaving(false)
      }
      return
    }

    if (!gender) return setError('Escolha bezerro ou bezerra')
    const calf = { name: name.trim() || defaultName, species: 'Bezerro', gender, birthDate, status, motherId: mother.id }
    // Sem internet: guarda no celular e envia junto com os outros animais
    if (!isOnline) {
      addPendingRecord('animais', { ...calf, code: '', farmId, _type: 'create' })
      onSaved()
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/animals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(calf) })
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Não foi possível salvar')
      onSaved()
    } catch {
      addPendingRecord('animais', { ...calf, code: '', farmId, _type: 'create' })
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  // No celular o formulário abre abaixo da ficha: rola até ele
  const formRef = useRef<HTMLFormElement>(null)
  useEffect(() => { formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }, [])

  const choice = (on: boolean) => `flex-1 rounded-xl border-2 py-3 text-base font-semibold ${on ? 'border-green-700 bg-green-50 text-green-800' : 'border-gray-200 text-gray-700'}`

  return (
    <form ref={formRef} onSubmit={save} className="mt-3 scroll-mt-4 flex flex-col gap-3 rounded-xl border border-green-200 bg-green-50/40 p-3">
      <div className="flex gap-2 text-sm">
        <button type="button" onClick={() => setExisting(false)} className={`flex-1 rounded-lg py-2 font-semibold ${!existing ? 'bg-white text-green-800 shadow-sm' : 'text-gray-600'}`}>Nova cria</button>
        <button type="button" onClick={() => setExisting(true)} className={`flex-1 rounded-lg py-2 font-semibold ${existing ? 'bg-white text-green-800 shadow-sm' : 'text-gray-600'}`}>Já está cadastrada</button>
      </div>

      {existing ? (
        <label className="text-sm font-medium text-gray-700">Qual animal é cria da {mother.name}?
          <select value={existingId} onChange={(e) => setExistingId(e.target.value)} className={`${field} bg-white`}>
            <option value="">Escolha</option>
            {candidates.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.code}) · nasceu em {fmtDate(a.birthDate)}</option>)}
          </select>
          {candidates.length === 0 && <span className="mt-1 block text-xs text-gray-500">Nenhum animal sem mãe e mais novo que ela.</span>}
        </label>
      ) : (
        <>
          <label className="text-sm font-medium text-gray-700">Data do parto
            <input type="date" value={birthDate} max={todayISO()} min={mother.birthDate.slice(0, 10)} onChange={(e) => setBirthDate(e.target.value)} required className={`${field} bg-white`} />
          </label>
          <div>
            <p className="text-sm font-medium text-gray-700">É bezerro ou bezerra?</p>
            <div className="mt-1 flex gap-2">
              <button type="button" aria-pressed={gender === 'Macho'} onClick={() => setGender('Macho')} className={choice(gender === 'Macho')}>Bezerro</button>
              <button type="button" aria-pressed={gender === 'Fêmea'} onClick={() => setGender('Fêmea')} className={choice(gender === 'Fêmea')}>Bezerra</button>
            </div>
          </div>
          <label className="text-sm font-medium text-gray-700">Nome <span className="font-normal text-gray-500">(opcional)</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={defaultName} className={`${field} bg-white`} />
          </label>
          <div>
            <p className="text-sm font-medium text-gray-700">A cria</p>
            <div className="mt-1 flex gap-2">
              {OUTCOMES.map(([value, label]) => (
                <button key={value} type="button" aria-pressed={status === value} onClick={() => setStatus(value)} className={choice(status === value)}>{label}</button>
              ))}
            </div>
          </div>
        </>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {!isOnline && !existing && <p className="text-xs text-amber-800">Sem internet: a cria fica guardada no celular e é enviada quando o sinal voltar.</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-gray-200 bg-white py-2.5 font-medium text-gray-600">Cancelar</button>
        <button type="submit" disabled={saving} className="flex-1 rounded-lg bg-green-700 py-2.5 font-semibold text-white hover:bg-green-600 disabled:bg-gray-300">
          {saving ? 'Salvando...' : 'Salvar cria'}
        </button>
      </div>
    </form>
  )
}
