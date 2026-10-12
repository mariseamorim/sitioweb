'use client'

import { useId, useState } from 'react'

interface AnimalOption { id: string; code: string; name: string }

export function AnimalPicker({ animals, value, onChange, label = 'Animal', required = true }: {
  animals: AnimalOption[]
  value: string
  onChange: (id: string) => void
  label?: string
  required?: boolean
}) {
  const id = useId()
  const [query, setQuery] = useState('')
  const term = query.trim().toLocaleLowerCase('pt-BR')
  const matches = animals.filter(a => [a.id, a.code, a.name].some(v => v.toLocaleLowerCase('pt-BR').includes(term)))
  const selected = animals.find(a => a.id === value)
  const options = selected && !matches.some(a => a.id === value) ? [selected, ...matches] : matches
  return <div>
    <label htmlFor={`${id}-search`} className="text-xs font-medium text-gray-600">Buscar por ID, código ou nome</label>
    <input id={`${id}-search`} type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="Digite o ID, código ou nome do animal" className="mt-1 mb-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
    <label htmlFor={`${id}-animal`} className="text-xs font-medium text-gray-600">{label}{required ? ' *' : ' (opcional)'}</label>
    <select id={`${id}-animal`} value={value} onChange={e => onChange(e.target.value)} required={required} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
      <option value="">— Selecione —</option>
      {options.map(a => <option key={a.id} value={a.id}>{a.code || a.id} — {a.name}</option>)}
    </select>
    {term && matches.length === 0 && <p role="status" className="mt-1 text-xs text-gray-500">Nenhum animal encontrado nesta busca.</p>}
    {selected && <p className="mt-1 break-all text-xs text-gray-500">Código: {selected.code || 'Não informado'} · ID: {selected.id}</p>}
  </div>
}
