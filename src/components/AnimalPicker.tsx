'use client'

import { useId, useRef, useState } from 'react'
import { animalCodes, animalSearchText } from '@/lib/animalCode'
import { useT } from '@/lib/i18n'

interface AnimalOption { id: string; code: string; name: string; customCode?: string | null }

/** Quantos animais a lista mostra de uma vez (digitar filtra o resto) */
const SHOWN = 60

const SearchIcon = () => (
  <svg aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24" strokeLinecap="round"><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></svg>
)

// Campo único de busca (lupa à esquerda): digita o nome, o código ou o brinco e escolhe na lista que abre.
// O id interno do banco não aparece. Teclado: setas para andar na lista, Enter para escolher, Esc para fechar.
export function AnimalPicker({ animals, value, onChange, label = 'Animal', required = true }: {
  animals: AnimalOption[]
  value: string
  onChange: (id: string) => void
  label?: string
  required?: boolean
}) {
  const id = useId()
  const t = useT()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const selected = animals.find(a => a.id === value)
  const term = query.trim().toLocaleLowerCase('pt-BR')
  const matches = (term ? animals.filter(a => animalSearchText(a).includes(term)) : animals).slice(0, SHOWN)
  const shown = (a: AnimalOption) => `${animalCodes(a)} — ${a.name}`

  function choose(a: AnimalOption) {
    onChange(a.id)
    setQuery('')
    setOpen(false)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && open && matches[active]) { e.preventDefault(); choose(matches[active]) }
    else if (e.key === 'Escape' && open) { e.stopPropagation(); setOpen(false) }
  }

  return <div className="relative">
    <label htmlFor={`${id}-search`} className="text-sm font-semibold text-gray-800">{t(label)} {required ? <span className="font-normal text-gray-500">* ({t('obrigatório')})</span> : <span className="font-normal text-gray-500">({t('opcional')})</span>}</label>
    <div className="relative mt-1">
      <SearchIcon />
      <input ref={input} id={`${id}-search`} type="text" role="combobox" aria-expanded={open} aria-controls={`${id}-list`} aria-autocomplete="list" autoComplete="off"
        value={open || !selected ? query : shown(selected)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
        onFocus={() => { setOpen(true); setActive(0) }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKey}
        placeholder={t('Buscar por nome, código ou brinco...')}
        className={`w-full rounded-xl border px-3 py-2.5 pl-10 text-base focus:outline-none focus:ring-2 focus:ring-green-600 ${selected && !open ? 'border-green-600 bg-green-50 font-semibold text-green-900' : 'border-gray-300 bg-white'}`} />
    </div>
    {/* Mantém o "obrigatório" do formulário: sem animal escolhido, o navegador avisa no campo de busca */}
    {required && <input tabIndex={-1} aria-hidden="true" required value={value} onChange={() => {}} onFocus={() => input.current?.focus()} className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0" />}
    {open && (
      <ul id={`${id}-list`} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl">
        {matches.length === 0
          ? <li className="px-3 py-2.5 text-sm text-gray-500">{t('Nenhum animal encontrado nesta busca.')}</li>
          : matches.map((a, i) => (
            <li key={a.id} role="option" aria-selected={a.id === value}
              onMouseDown={(e) => { e.preventDefault(); choose(a) }} onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-2.5 text-sm ${i === active ? 'bg-green-50' : ''} ${a.id === value ? 'font-semibold text-green-900' : 'text-gray-800'}`}>
              <span><span className="font-semibold">{animalCodes(a)}</span> — {a.name}</span>
              {a.id === value && <span aria-hidden="true" className="text-green-700">✓</span>}
            </li>
          ))}
      </ul>
    )}
  </div>
}
