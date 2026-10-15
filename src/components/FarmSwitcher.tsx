'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { useDialog } from '@/components/DialogProvider'
import { CheckIcon } from '@/components/ModuleIcons'
import { switchFarm } from '@/lib/farmSwitch'

/** Nome da propriedade no topo. Com mais de uma propriedade, vira um seletor para trocar. */
export function FarmSwitcher({ fallback }: { fallback: string }) {
  const { user } = useUser()
  const { notify } = useDialog()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const farms = user?.farms ?? []

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close) }
  }, [open])

  const name = user?.farmName || fallback
  if (farms.length < 2) return <p className="truncate text-xs text-gray-500">{name}</p>

  async function choose(id: string) {
    if (id === user?.farmId) return setOpen(false)
    setBusy(id)
    const error = await switchFarm(id)
    setBusy(null)
    if (error) { setOpen(false); await notify('Não foi possível trocar', error) }
  }

  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="listbox"
        className="flex max-w-full items-center gap-1 rounded text-xs font-semibold text-green-700 hover:underline focus-visible:outline-2 focus-visible:outline-green-700">
        <span className="truncate">{name}</span>
        <svg aria-hidden="true" className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-64 rounded-xl border border-gray-200 bg-white p-1 shadow-lg">
          <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Trocar de propriedade</p>
          <ul role="listbox" aria-label="Propriedades">
            {farms.map((f) => (
              <li key={f.id}>
                <button type="button" role="option" aria-selected={f.id === user?.farmId} onClick={() => void choose(f.id)} disabled={!!busy}
                  className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg px-3 text-left text-sm text-gray-800 hover:bg-green-50 disabled:opacity-60">
                  <span className="truncate">{busy === f.id ? 'Abrindo...' : f.name}</span>
                  {f.id === user?.farmId && <CheckIcon className="h-4 w-4 shrink-0 text-green-700" />}
                </button>
              </li>
            ))}
          </ul>
          <Link href="/fazendas" onClick={() => setOpen(false)} className="mt-1 flex min-h-11 items-center rounded-lg border-t border-gray-100 px-3 text-sm font-semibold text-green-700 hover:bg-green-50">
            + Cadastrar outra propriedade
          </Link>
        </div>
      )}
    </div>
  )
}
