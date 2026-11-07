// Tabela simples, rolável na horizontal, para os relatórios. Tocar no título da coluna ordena (datas, números e R$ entendidos).
import { useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { colors, font, radius, space } from '@/theme'

export type Cell = string | number

/** Valor de ordenação de uma célula: data dd/mm/aaaa, número em pt-BR (com R$ ou não) ou texto */
export function cellSortValue(v: Cell | undefined): number | string {
  if (typeof v === 'number') return v
  const s = String(v ?? '').trim()
  if (!s || s === '—') return Number.NEGATIVE_INFINITY
  const date = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)
  if (date) return Number(`${date[3]}${date[2]}${date[1]}`)
  const month = /^(\d{2})\/(\d{4})$/.exec(s)
  if (month) return Number(`${month[2]}${month[1]}`)
  const num = s.replace(/R\$\s?/u, '').replace(/\./g, '').replace(',', '.').replace(/\s.*$/, '')
  if (/^-?\d+(\.\d+)?$/.test(num)) return Number(num)
  return s.toLowerCase()
}

function compare(a: number | string, b: number | string): number {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  if (typeof a === 'number') return -1
  if (typeof b === 'number') return 1
  return a.localeCompare(b)
}

/** Largura da coluna pelo texto mais longo (entre 72 e 220 px) */
function widths(columns: string[], rows: Cell[][], footer?: Cell[]): number[] {
  return columns.map((c, j) => {
    const longest = Math.max(c.length, ...rows.map(r => String(r[j] ?? '').length), footer ? String(footer[j] ?? '').length : 0)
    return Math.min(220, Math.max(72, longest * 7.5 + 24))
  })
}

export function Table({ columns, rows, numeric = [], footer }: { columns: string[]; rows: Cell[][]; numeric?: number[]; footer?: Cell[] }) {
  const [sort, setSort] = useState<{ col: number; dir: 'asc' | 'desc' } | null>(null)
  const sorted = useMemo(() => {
    if (!sort) return rows
    return rows.map((row, i) => ({ row, i }))
      .sort((a, b) => (compare(cellSortValue(a.row[sort.col]), cellSortValue(b.row[sort.col])) * (sort.dir === 'asc' ? 1 : -1)) || a.i - b.i)
      .map(x => x.row)
  }, [rows, sort])
  const w = useMemo(() => widths(columns, rows, footer), [columns, rows, footer])
  const toggle = (col: number) => setSort(s => (s?.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
  const align = (j: number) => (numeric.includes(j) ? 'right' : 'left') as 'right' | 'left'

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator style={styles.wrap} contentContainerStyle={{ flexDirection: 'column' }}>
      <View style={[styles.row, styles.head]}>
        {columns.map((c, j) => (
          <Pressable key={j} onPress={() => toggle(j)} style={[styles.cell, { width: w[j] }]} accessibilityRole="button">
            <Text style={[styles.headText, { textAlign: align(j) }, sort?.col === j && { color: colors.text }]} numberOfLines={2}>
              {c}{sort?.col === j ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
            </Text>
          </Pressable>
        ))}
      </View>
      {sorted.length === 0 ? (
        <View style={[styles.row, { width: w.reduce((s, n) => s + n, 0) }]}><Text style={[styles.empty]}>Nenhum registro</Text></View>
      ) : sorted.map((row, i) => (
        <View key={i} style={[styles.row, i % 2 === 1 && { backgroundColor: colors.bg }]}>
          {columns.map((_, j) => (
            <View key={j} style={[styles.cell, { width: w[j] }]}><Text style={[styles.text, { textAlign: align(j) }]}>{String(row[j] ?? '')}</Text></View>
          ))}
        </View>
      ))}
      {footer ? (
        <View style={[styles.row, styles.foot]}>
          {columns.map((_, j) => (
            <View key={j} style={[styles.cell, { width: w[j] }]}><Text style={[styles.text, { fontWeight: '700', textAlign: align(j) }]}>{String(footer[j] ?? '')}</Text></View>
          ))}
        </View>
      ) : null}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white },
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: colors.border },
  head: { backgroundColor: colors.bg },
  foot: { backgroundColor: colors.bg, borderTopWidth: 2, borderTopColor: colors.border, borderBottomWidth: 0 },
  cell: { paddingHorizontal: space.sm, paddingVertical: 8, justifyContent: 'center' },
  headText: { fontSize: 11, fontWeight: '700', color: colors.muted, textTransform: 'uppercase' },
  text: { fontSize: font.sm, color: colors.text },
  empty: { padding: space.lg, color: colors.muted, textAlign: 'center', flex: 1 },
})
