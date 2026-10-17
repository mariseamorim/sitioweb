'use client'

import { useMemo, useState } from 'react'
import { FARM_SEGMENTS } from '@/lib/farmSegments'
import {
  OWNER_FILTERS, STALE_DAYS, activityLabel, filterOwnerGroups, groupFarmsByOwner, isStale, ownerTotals,
  type AdminFarmSummary, type OwnerFilter, type OwnerGroup,
} from '@/lib/ownerGroups'

// Administrador: propriedades agrupadas por proprietário, com busca, filtros e os números do topo.
// Cada proprietário abre e fecha; dentro, as propriedades com animais, pessoas, último lançamento e "Abrir".

interface Props {
  farms: AdminFarmSummary[]
  /** Propriedade aberta agora (admin dentro de uma) */
  activeFarmId?: string | null
  /** Abre a propriedade (troca). Sem isso, o botão não aparece. */
  onOpen?: (farm: AdminFarmSummary) => void
  openingId?: string | null
  onEdit?: (farm: AdminFarmSummary) => void
  onDelete?: (farm: AdminFarmSummary) => void
  deletingId?: string | null
}

const SEGMENT_STYLE: Record<string, string> = {
  leite: 'bg-green-50 text-green-800',
  cria: 'bg-green-50 text-green-800',
  recria: 'bg-blue-50 text-blue-800',
  engorda: 'bg-blue-50 text-blue-800',
}

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || '?'

export function OwnerGroups({ farms, activeFarmId, onOpen, openingId, onEdit, onDelete, deletingId }: Props) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<OwnerFilter>('todos')
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({})

  const groups = useMemo(() => groupFarmsByOwner(farms), [farms])
  const totals = useMemo(() => ownerTotals(groups), [groups])
  const visible = useMemo(() => filterOwnerGroups(groups, filter, query), [groups, filter, query])
  const searching = query.trim().length > 0

  // Buscando ou filtrando, os grupos abrem para mostrar o que combinou; sem filtro, o primeiro abre e os outros ficam fechados
  const isOpen = (g: OwnerGroup, index: number) => openKeys[g.key] ?? (searching || filter !== 'todos' || index === 0)

  return (
    <div>
      <dl className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="proprietários" value={totals.owners} />
        <Stat label="propriedades ativas" value={totals.farms} />
        <Stat label={`sem lançamento há ${STALE_DAYS} dias`} value={totals.stale} tone={totals.stale ? 'bad' : 'muted'} onClick={() => setFilter('paradas')} />
        <Stat label="sem proprietário informado" value={totals.unknown} tone={totals.unknown ? 'warn' : 'muted'} onClick={() => setFilter('semdono')} />
      </dl>

      <label className="mb-3 flex min-h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 focus-within:ring-2 focus-within:ring-green-600">
        <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="m20 20-3.5-3.5" /></svg>
        <span className="sr-only">Buscar proprietário, CPF/CNPJ, propriedade ou cidade</span>
        <input id="owner-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Proprietário, CPF/CNPJ, propriedade ou cidade" className="min-w-0 flex-1 bg-transparent py-2 text-sm focus:outline-none" />
      </label>

      <div role="group" aria-label="Filtros" className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {OWNER_FILTERS.filter((f) => f.key !== 'inativas' || totals.inactive > 0).map((f) => (
          <button key={f.key} type="button" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}
            className={`shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold ${filter === f.key ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {f.label}{f.key === 'inativas' ? ` (${totals.inactive})` : ''}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-gray-500">
          {searching ? `Nenhum proprietário ou propriedade com "${query.trim()}".` : 'Nenhuma propriedade neste filtro.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((g, index) => {
            const open = isOpen(g, index)
            const stale = g.farms.some((f) => f.isActive && isStale(f.lastActivity))
            return (
              <section key={g.key} aria-label={g.name} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <button type="button" aria-expanded={open} onClick={() => setOpenKeys({ ...openKeys, [g.key]: !open })}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-green-700">
                  <span aria-hidden="true" className={`flex h-10 w-10 shrink-0 items-center justify-center font-bold ${g.unknown ? 'rounded-full bg-amber-50 text-amber-700' : stale ? 'rounded-full bg-red-50 text-red-700' : g.document?.includes('/') ? 'rounded-lg bg-green-50 text-green-800' : 'rounded-full bg-green-50 text-green-800'}`}>
                    {g.unknown ? '?' : initial(g.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 font-bold leading-tight text-gray-900">{g.name}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {g.unknown
                        ? 'Cadastros sem nome nem CPF/CNPJ do dono'
                        : [g.document, g.city, g.animals ? `${g.animals} ${g.animals === 1 ? 'animal' : 'animais'}` : null, activityLabel(g.lastActivity)].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-lg font-bold leading-none text-gray-900">{g.farms.length}</span>
                    <span className="block text-[11px] text-gray-500">{g.farms.length === 1 ? 'propriedade' : 'propriedades'}</span>
                  </span>
                  <svg aria-hidden="true" className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" /></svg>
                </button>
                {open && (
                  <ul className="border-t border-gray-100 bg-gray-50/60 px-4">
                    {g.farms.map((f) => <FarmRow key={f.id} farm={f} active={f.id === activeFarmId} unknownOwner={g.unknown}
                      onOpen={onOpen} opening={openingId === f.id} onEdit={onEdit} onDelete={onDelete} deleting={deletingId === f.id} />)}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone = 'neutral', onClick }: { label: string; value: number; tone?: 'neutral' | 'muted' | 'warn' | 'bad'; onClick?: () => void }) {
  const color = { neutral: 'text-gray-900', muted: 'text-gray-400', warn: 'text-amber-700', bad: 'text-red-600' }[tone]
  const body = <><dd className={`text-2xl font-bold leading-none ${color}`}>{value}</dd><dt className="mt-1 text-xs text-gray-500">{label}</dt></>
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3">
      {onClick && value > 0 ? <button type="button" onClick={onClick} className="w-full text-left hover:underline">{body}</button> : body}
    </div>
  )
}

function FarmRow({ farm, active, unknownOwner, onOpen, opening, onEdit, onDelete, deleting }: {
  farm: AdminFarmSummary; active: boolean; unknownOwner: boolean
  onOpen?: (f: AdminFarmSummary) => void; opening: boolean
  onEdit?: (f: AdminFarmSummary) => void; onDelete?: (f: AdminFarmSummary) => void; deleting: boolean
}) {
  const stale = farm.isActive && isStale(farm.lastActivity)
  const place = [farm.city, farm.state].filter(Boolean).join(', ')
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-gray-100 py-3 last:border-b-0">
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate font-semibold text-gray-900">{farm.name}</p>
        <p className={`text-xs ${stale ? 'text-red-600' : 'text-gray-500'}`}>
          {[
            place || null,
            `${farm.animals} ${farm.animals === 1 ? 'animal' : 'animais'}`,
            `${farm.members} ${farm.members === 1 ? 'pessoa' : 'pessoas'}`,
            farm.isActive ? activityLabel(farm.lastActivity) : 'inativa',
          ].filter(Boolean).join(' · ')}
        </p>
        {(farm.segments.length > 0 || !farm.isActive) && (
          <p className="mt-1 flex flex-wrap gap-1">
            {FARM_SEGMENTS.filter((s) => farm.segments.includes(s.key)).map((s) => (
              <span key={s.key} className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${SEGMENT_STYLE[s.key]}`}>{s.label}</span>
            ))}
            {!farm.isActive && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-700">Inativa</span>}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {onEdit && (
          <button type="button" onClick={() => onEdit(farm)} aria-label={`Editar propriedade ${farm.name}`}
            className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${unknownOwner ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100' : 'text-green-700 hover:bg-green-50'}`}>
            {unknownOwner ? 'Completar' : 'Editar'}
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={() => onDelete(farm)} disabled={deleting} aria-label={`Excluir propriedade ${farm.name}`} title="Excluir propriedade"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        )}
        {onOpen && farm.isActive && (active
          ? <span className="rounded-full bg-green-100 px-3 py-1.5 text-sm font-semibold text-green-800">Aberta</span>
          : <button type="button" onClick={() => onOpen(farm)} disabled={opening}
              className="min-h-10 rounded-lg bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-600 disabled:opacity-60">
              {opening ? 'Abrindo...' : 'Abrir'}
            </button>)}
      </div>
    </li>
  )
}
