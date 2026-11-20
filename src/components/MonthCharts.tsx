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
const PAD = { top: 18, right: 18, bottom: 26, left: 52 }
/** Largura útil do gráfico; `width` maior deixa o gráfico mais largo sem aumentar letras e altura */
const plotWidth = (width = W) => width - PAD.left - PAD.right
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

// Número curto para caber na margem do eixo: 9.500 · 12 mil · 6,2 mi ("mil" é igual em português e espanhol; milhão é "mi" / "M")
export function compact(n: number, locale: string): string {
  if (n >= 1e6) return `${(n / 1e6).toLocaleString(locale, { maximumFractionDigits: n < 1e7 ? 1 : 0 })} ${locale.startsWith('es') ? 'M' : 'mi'}`
  if (n >= 10000) return `${Math.round(n / 1000)} mil`
  return n.toLocaleString(locale)
}

export function Frame({ max, unit, labels, name, children, width = W }: { max: number; unit: string; labels: string[]; name: string; children: React.ReactNode; width?: number }) {
  const band = plotWidth(width) / labels.length
  // Com 12 meses, rótulo em meses alternados para não encostar
  const every = labels.length > 8 ? 2 : 1
  const locale = useLocale()
  return (
    <svg viewBox={`0 0 ${width} ${H}`} role="img" aria-label={name} className="w-full h-auto">
      {[0, 0.5, 1].map((t) => {
        const y = PAD.top + PLOT_H * (1 - t)
        return (
          <g key={t}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y} y2={y} stroke={GRID} strokeWidth={1} />
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

/** Índices que levam rótulo: o maior valor e o último ponto com valor (este só se não encostar no do maior) */
function labeled(points: MonthPoint[], band: number): Set<number> {
  const set = new Set<number>()
  let best = -1
  points.forEach((p, i) => { if (p.value !== null && p.value > 0 && (best < 0 || p.value > (points[best].value ?? 0))) best = i })
  if (best >= 0) set.add(best)
  for (let i = points.length - 1; i >= 0; i--) {
    if (points[i].value === null || (points[i].value ?? 0) <= 0) continue
    // Rótulos vizinhos com colunas estreitas (gráfico de 30 dias) ficariam um em cima do outro
    if (best < 0 || Math.abs(i - best) * band >= 48) set.add(i)
    break
  }
  return set
}

export function ColumnChart({ points, name, unit = '', width }: { points: MonthPoint[]; name: string; unit?: string; width?: number }) {
  const max = niceMax(Math.max(0, ...points.map((p) => p.value ?? 0)))
  const band = plotWidth(width) / points.length
  const barWidth = Math.min(24, band - 4)
  const base = PAD.top + PLOT_H
  const marks = labeled(points, band)
  const locale = useLocale()
  return (
    <Frame max={max} unit={unit} labels={points.map((p) => p.label)} name={name} width={width}>
      {points.map((p, i) => {
        const value = p.value ?? 0
        const h = (value / max) * PLOT_H
        const x = PAD.left + band * (i + 0.5) - barWidth / 2
        const r = Math.min(4, h)
        return (
          <g key={i} tabIndex={0} aria-label={p.title} className="outline-none [&:focus-visible>rect:first-of-type]:fill-green-100 [&:hover>rect:first-of-type]:fill-gray-100">
            <title>{p.title}</title>
            {/* Alvo do toque: a faixa inteira do mês, maior que a coluna */}
            <rect x={PAD.left + band * i} y={PAD.top} width={band} height={PLOT_H} fill="transparent" />
            {h > 0 && <path d={`M${x},${base} V${base - h + r} Q${x},${base - h} ${x + r},${base - h} H${x + barWidth - r} Q${x + barWidth},${base - h} ${x + barWidth},${base - h + r} V${base} Z`} fill={SERIES} />}
            {marks.has(i) && <text x={x + barWidth / 2} y={base - h - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK}>{compact(value, locale)}{unit}</text>}
          </g>
        )
      })}
    </Frame>
  )
}

export function LineChart({ points, name, unit = '', max: fixedMax, width }: { points: MonthPoint[]; name: string; unit?: string; max?: number; width?: number }) {
  const max = fixedMax ?? niceMax(Math.max(0, ...points.map((p) => p.value ?? 0)))
  const band = plotWidth(width) / points.length
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
  const marks = labeled(points, band)
  const locale = useLocale()
  return (
    <Frame max={max} unit={unit} labels={points.map((p) => p.label)} name={name} width={width}>
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

// Paleta categórica validada (ordem fixa; a cor segue a entidade, não a posição no gráfico).
// Da 8ª série em diante, todas entram juntas em "Outras", em cinza.
export const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6']
export const OTHER = '#9ca3af'
/** Espaço branco entre as partes empilhadas */
const GAP = 2

export interface Series { key: string; name: string; color: string; counts: number[] }

/** Colunas empilhadas, uma cor por série; o total vai em cima de cada coluna */
export function StackedColumns({ months, series, totals, label, title, name }: {
  months: string[]; series: Series[]; totals: number[]
  label: (month: string) => string
  title: (month: string, series: string | null, n: number) => string
  name: string
}) {
  const max = niceMax(Math.max(0, ...totals))
  const band = plotWidth() / months.length
  const width = Math.min(28, band - 6)
  const base = PAD.top + PLOT_H
  return (
    <Frame max={max} unit="" labels={months.map(label)} name={name}>
      {months.map((month, i) => {
        const x = PAD.left + band * (i + 0.5) - width / 2
        const parts = series.filter((s) => s.counts[i] > 0)
        let y = base
        return (
          <g key={month} tabIndex={0} aria-label={title(month, null, totals[i])} className="outline-none [&:focus-visible>rect:first-of-type]:fill-green-100 [&:hover>rect:first-of-type]:fill-gray-100">
            <title>{title(month, null, totals[i])}</title>
            {/* Alvo do toque: a faixa inteira do mês */}
            <rect x={PAD.left + band * i} y={PAD.top} width={band} height={PLOT_H} fill="transparent" />
            {parts.map((s, j) => {
              const h = (s.counts[i] / max) * PLOT_H
              const top = y - h
              y = top
              const last = j === parts.length - 1
              // Folga branca entre as partes; a de cima tem os cantos arredondados
              const visible = Math.max(1, h - (j > 0 ? GAP : 0))
              const bottom = top + visible
              const r = last ? Math.min(4, visible) : 0
              return (
                <path key={s.key} fill={s.color} d={`M${x},${bottom} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${bottom} Z`}>
                  <title>{title(month, s.name, s.counts[i])}</title>
                </path>
              )
            })}
            {totals[i] > 0 && <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill={INK}>{totals[i]}</text>}
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
      {/* Com muitas colunas (uma por propriedade) a tabela rola para o lado em vez de quebrar os meses */}
      <div className="mt-2 overflow-x-auto">
      <table className="w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{columns.map((c, j) => <th key={c} scope="col" className={`border-b border-gray-200 py-1.5 pr-3 align-bottom font-medium text-gray-600 ${j ? 'text-right' : 'whitespace-nowrap'}`}>{c}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => j
          ? <td key={j} className="border-b border-gray-100 py-1.5 pr-3 text-right tabular-nums text-gray-800">{cell}</td>
          : <th key={j} scope="row" className="whitespace-nowrap border-b border-gray-100 py-1.5 pr-3 font-normal text-gray-800">{cell}</th>)}</tr>)}</tbody>
      </table>
      </div>
    </details>
  )
}
