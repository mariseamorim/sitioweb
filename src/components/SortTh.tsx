'use client'

import type { SortState } from '@/lib/useSort'

// Título de coluna que ordena a tabela ao tocar (▲ crescente, ▼ decrescente)
export function SortTh({ label, sortKey, sort, className = '', align = 'left' }: {
  label: string
  sortKey: string
  sort: SortState
  className?: string
  align?: 'left' | 'right'
}) {
  const active = sort.key === sortKey
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
  return (
    <th className={className} aria-sort={ariaSort}>
      <button type="button" onClick={() => sort.toggle(sortKey)} title={`Ordenar por ${label.toLowerCase()}`}
        className={`inline-flex items-center gap-1 uppercase hover:text-gray-800 ${align === 'right' ? 'flex-row-reverse' : ''} ${active ? 'text-gray-800' : ''}`}>
        {label}
        <span aria-hidden="true" className={`text-[10px] ${active ? '' : 'text-gray-300'}`}>{active ? (sort.dir === 'asc' ? '▲' : '▼') : '▲▼'}</span>
      </button>
    </th>
  )
}
