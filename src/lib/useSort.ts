'use client'

import { useMemo, useState } from 'react'

// Ordenação das tabelas: tocar no título da coluna ordena; tocar de novo inverte

export type SortValue = string | number | Date | boolean | null | undefined
export type SortDir = 'asc' | 'desc'

export interface SortState {
  key: string | null
  dir: SortDir
  toggle: (key: string) => void
}

const collator = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' })
const isEmpty = (v: SortValue) => v === null || v === undefined || v === ''

/** Compara dois valores; vazios ficam sempre no fim, nas duas direções */
export function compareValues(a: SortValue, b: SortValue, dir: SortDir = 'asc'): number {
  if (isEmpty(a) || isEmpty(b)) return isEmpty(a) === isEmpty(b) ? 0 : isEmpty(a) ? 1 : -1
  let result: number
  if (a instanceof Date || b instanceof Date) result = new Date(a as Date).getTime() - new Date(b as Date).getTime()
  else if (typeof a === 'number' && typeof b === 'number') result = a - b
  else if (typeof a === 'boolean' && typeof b === 'boolean') result = Number(a) - Number(b)
  else result = collator.compare(String(a), String(b))
  return dir === 'asc' ? result : -result
}

/**
 * `getters`: como ler o valor de cada coluna ordenável. Sem ordenação escolhida, mantém a ordem original.
 */
export function useSort<T>(rows: T[], getters: Record<string, (row: T) => SortValue>, initial: { key: string; dir: SortDir } | null = null) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(initial)
  const get = sort ? getters[sort.key] : undefined
  const sorted = useMemo(() => {
    if (!sort || !get) return rows
    // sort estável: empates mantêm a ordem original
    return rows.map((row, i) => ({ row, i })).sort((a, b) => compareValues(get(a.row), get(b.row), sort.dir) || a.i - b.i).map((x) => x.row)
  }, [rows, sort, get])
  const state: SortState = {
    key: sort?.key ?? null,
    dir: sort?.dir ?? 'asc',
    toggle: (key) => setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' })),
  }
  return { rows: sorted, sort: state }
}

/** Texto de célula de relatório ("12/10/2026", "1.234,5", "R$ 10,00") como valor ordenável */
export function cellSortValue(cell: string | number): SortValue {
  if (typeof cell === 'number') return cell
  const text = cell.trim()
  if (!text || text === '—') return null
  const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text)
  if (date) return new Date(`${date[3]}-${date[2]}-${date[1]}T00:00:00Z`)
  const number = text.replace(/^R\$\s*/, '').replace(/\s*(L|kg|%)$/i, '')
  if (/^-?[\d.]+(,\d+)?$/.test(number)) return Number(number.replace(/\./g, '').replace(',', '.'))
  return text
}
