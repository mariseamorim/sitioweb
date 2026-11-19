'use client'
// Gráficos por mês, de uma série só (o título do cartão diz o que é, então não há legenda).
// Colunas para quantidades, linha para taxa ao longo do tempo. Rótulos só no maior valor e no último ponto;
// o valor de cada mês aparece ao passar o mouse ou focar, e a tabela abaixo do gráfico traz todos.
import { useLocale, useT } from '@/lib/i18n'

export interface MonthPoint {
  /** Rótulo do eixo: "nov", "jan/27" */
  label: string
  /** null = mês sem dado (não ganha ponto) */
  value: number | null
  /** Texto do ponto para leitura e para a dica: "novembro: 12 partos" */
  title: string
}

const W = 360
const H = 190
const PAD = { top: 18, right: 18, bottom: 26, left: 46 }
const PLOT_W = W - PAD.left - PAD.right
const PLOT_H = H - PAD.top - PAD.bottom
const SERIES = '#15803d'
const GRID = '#e5e7eb'
const TEXT = '#6b7280'
const INK = '#111827'

/** Topo do eixo arredondado para um número limpo cuja metade também é limpa (4 → 4, 13 → 20, 870 → 1000) */
export function niceMax(max: number): number {
  if (max <= 4) return 4
  const power = 10 ** Math.floor(Math.log10(max))
  const step = [1, 2, 4, 5, 10].find((s) => s * power >= max) ?? 10
  return step * power
}

// "mil" é igual em português e espanhol; o separador de milhar segue o idioma
const compact = (n: number, locale: string) => (n >= 10000 ? `${Math.round(n / 1000)} mil` : n.toLocaleString(locale))

export function Frame({ max, unit, labels, name, children }: { max: number; unit: string; labels: string[]; name: string; children: React.ReactNode }) {
  const band = PLOT_W / labels.length
  // Com 12 meses, rótulo em meses alternados para não encostar
  const every = labels.length > 8 ? 2 : 1
  const locale = useLocale()
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={name} className="w-full h-auto">
      {[0, 0.5, 1].map((t) => {
        const y = PAD.top + PLOT_H * (1 - t)
        return (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 3.5} textAnchor="end" fontSize={10} fill={TEXT}>{compact(Math.round(max * t), locale)}{unit}</text>
          </g>
        )
      })}
      {labels.map((label, i) => ((labels.length - 1 - i) % every === 0
        ? <text key={i} x={PAD.left + band * (i + 0.5)} y={H - 8} textAnchor="middle" fontSize={10} fill={TEXT}>{label}</text>
        : null))}
      {children}
    </svg>
  )
}

/** Índices que levam rótulo: o maior valor e o último ponto com valor */
function labeled(points: MonthPoint[]): Set<number> {
  const set = new Set<number>()
  let best = -1
  points.forEach((p, i) => { if (p.value !== null && p.value > 0 && (best < 0 || p.value > (points[best].value ?? 0))) best = i })
  if (best >= 0) set.add(best)
  for (let i = points.length - 1; i >= 0; i--) if (points[i].value !== null && (points[i].value ?? 0) > 0) { set.add(i); break }
  return set
}

export function ColumnChart({ points, name, unit = '' }: { points: MonthPoint[]; name: string; unit?: string }) {
  const max = niceMax(Math.max(0, ...points.map((p) => p.value ?? 0)))
  const band = PLOT_W / points.length
  const width = Math.min(24, band - 4)
  const base = PAD.top + PLOT_H
  const marks = labeled(points)
  const locale = useLocale()
  return (
    <Frame max={max} unit={unit} labels={points.map((p) => p.label)} name={name}>
      {points.map((p, i) => {
        const value = p.value ?? 0
        const h = (value / max) * PLOT_H
        const x = PAD.left + band * (i + 0.5) - width / 2
        const r = Math.min(4, h)
        return (
          <g key={i} tabIndex={0} aria-label={p.title} className="outline-none [&:focus-visible>rect:first-of-type]:fill-green-100 [&:hover>rect:first-of-type]:fill-gray-100">
            <title>{p.title}</title>
            {/* Alvo do toque: a faixa inteira do mês, maior que a coluna */}
            <rect x={PAD.left + band * i} y={PAD.top} width={band} height={PLOT_H} fill="transparent" />
            {h > 0 && <path d={`M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + width - r} Q${x + width},${base - h} ${x + width},${base - h + r} V${base} Z`} fill={SERIES} />}
            {marks.has(i) && <text x={x + width / 2} y={base - h - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK}>{compact(value, locale)}{unit}</text>}
          </g>
        )
      })}
    </Frame>
  )
}

export function LineChart({ points, name, unit = '', max: fixedMax }: { points: MonthPoint[]; name: string; unit?: string; max?: number }) {
  const max = fixedMax ?? niceMax(Math.max(0, ...points.map((p) => p.value ?? 0)))
  const band = PLOT_W / points.length
  const xy = (i: number, value: number) => [PAD.left + band * (i + 0.5), PAD.top + PLOT_H * (1 - value / max)] as const
  // Mês sem dado não tem ponto; a linha liga os meses que têm, para a tendência ficar legível
  let d = ''
  let pen = false
  points.forEach((p, i) => {
    if (p.value === null) return
    const [x, y] = xy(i, p.value)
    d += `${pen ? 'L' : 'M'}${x},${y} `
    pen = true
  })
  const marks = labeled(points)
  const locale = useLocale()
  return (
    <Frame max={max} unit={unit} labels={points.map((p) => p.label)} name={name}>
      <path d={d} fill="none" stroke={SERIES} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => {
        if (p.value === null) return null
        const [x, y] = xy(i, p.value)
        return (
          <g key={i} tabIndex={0} aria-label={p.title} className="outline-none [&:focus-visible>rect:first-of-type]:fill-green-100 [&:hover>rect:first-of-type]:fill-gray-100">
            <title>{p.title}</title>
            <rect x={PAD.left + band * i} y={PAD.top} width={band} height={PLOT_H} fill="transparent" />
            <circle cx={x} cy={y} r={4} fill={SERIES} stroke="#ffffff" strokeWidth={2} />
            {marks.has(i) && <text x={x} y={y - 9} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK}>{compact(p.value, locale)}{unit}</text>}
          </g>
        )
      })}
    </Frame>
  )
}

/** Os mesmos números em tabela, para quem não lê o gráfico (leitor de tela, impressão) ou quer o valor exato de cada mês */
export function ChartTable({ caption, columns, rows }: { caption: string; columns: string[]; rows: (string | number)[][] }) {
  const t = useT()
  return (
    <details className="mt-2 text-sm">
      <summary className="cursor-pointer text-gray-600 hover:text-gray-900">{t('Ver em tabela')}</summary>
      <table className="mt-2 w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{columns.map((c) => <th key={c} scope="col" className="border-b border-gray-200 py-1.5 pr-3 font-medium text-gray-600">{c}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j} className="border-b border-gray-100 py-1.5 pr-3 text-gray-800">{cell}</td>)}</tr>)}</tbody>
      </table>
    </details>
  )
}
