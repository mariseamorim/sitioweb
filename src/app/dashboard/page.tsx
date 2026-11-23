'use client'

// Dashboard: os números e gráficos do perfil numa tela só, para deixar numa TV ou monitor.
// Atualiza sozinho a cada 5 minutos. Em "Tela cheia" some o menu, as letras crescem com a largura da tela
// e a tela não apaga (quando o navegador permite). Sem internet, continua mostrando a última atualização.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ColumnChart, LineChart, OTHER, PALETTE, StackedColumns, type MonthPoint, type Series } from '@/components/MonthCharts'
import { StatTile } from '@/components/StatTile'
import { monthName, monthShort } from '@/lib/reproInsights'
import { useLang, useLocale, useT } from '@/lib/i18n'
import type { Accent, Board, Cell, Chart, Tile, Txt, Unit } from '@/lib/dashboardTypes'

const REFRESH_MS = 5 * 60 * 1000
const TONE_DOT = { warn: 'bg-amber-500', bad: 'bg-red-600' } as const
const TONE_BADGE = { good: 'bg-green-100 text-green-800', warn: 'bg-amber-100 text-amber-900', bad: 'bg-red-100 text-red-800' } as const
const TONE_ACCENT = { good: 'green', warn: 'amber', bad: 'red' } as const
/** Cartões sem cor própria: verde, azul, verde-azulado e laranja, nessa ordem */
const ACCENTS: Accent[] = ['green', 'blue', 'teal', 'amber']
const BAR = { green: 'bg-gradient-to-r from-green-600 to-teal-500', blue: 'bg-gradient-to-r from-blue-600 to-cyan-500' } as const
/** Período escolhido fica guardado neste navegador (a TV volta no mesmo) */
const PERIOD_KEY = 'dashboard_meses'

type WakeLock = { release: () => Promise<void> }

/** Cartão com número: some quando está vazio ou zerado */
const hasValue = (tile: Tile) => tile.value !== null && tile.value !== 0

/** Gráfico só aparece com dados; nas barras, as linhas zeradas somem (ex.: "Receitas R$ 0") */
function withData(chart: Chart): Chart | null {
  if (chart.kind === 'columns' || chart.kind === 'line') return chart.points.some((p) => p.value) ? chart : null
  if (chart.kind === 'stacked') return chart.series.some((s) => s.values.some(Boolean)) ? chart : null
  if (chart.kind === 'bars') {
    const rows = chart.rows.filter((r) => r.value)
    return rows.length ? { ...chart, rows } : null
  }
  if (chart.kind === 'table' || chart.kind === 'list') return chart.rows.length ? chart : null
  return chart
}

export default function DashboardPage() {
  const t = useT()
  const locale = useLocale()
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [full, setFull] = useState(false)
  const [months, setMonths] = useState<number | null>(() => {
    try { return Number(localStorage.getItem(PERIOD_KEY)) || null } catch { return null }
  })
  const root = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard${months ? `?meses=${months}` : ''}`, { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Não foi possível carregar o Dashboard.'); return }
      setBoard(data as Board)
      setError('')
      setOffline(false)
    } catch {
      setOffline(true)
    }
  }, [months])

  const choosePeriod = (value: number) => {
    setMonths(value)
    try { localStorage.setItem(PERIOD_KEY, String(value)) } catch { /* sem armazenamento: vale só agora */ }
  }

  useEffect(() => {
    const first = setTimeout(() => void load(), 0)
    const refresh = setInterval(() => void load(), REFRESH_MS)
    const clock = setInterval(() => setNow(new Date()), 30 * 1000)
    return () => { clearTimeout(first); clearInterval(refresh); clearInterval(clock) }
  }, [load])

  // Tela cheia: letras proporcionais à largura (1920 px → 20 px; 4K → 40 px) e tela sempre acesa
  useEffect(() => {
    let lock: WakeLock | null = null
    const html = document.documentElement
    const onChange = () => {
      const on = document.fullscreenElement === root.current
      setFull(on)
      html.style.fontSize = on ? `${Math.max(16, Math.round(window.innerWidth / 96))}px` : ''
      if (on) {
        const wake = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLock> } }).wakeLock
        wake?.request('screen').then((l) => { lock = l }).catch(() => {})
      } else {
        void lock?.release().catch(() => {})
        lock = null
      }
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      html.style.fontSize = ''
      void lock?.release().catch(() => {})
    }
  }, [])

  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    else void root.current?.requestFullscreen().catch(() => {})
  }

  const time = (d: Date) => d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  const tiles = board?.tiles.filter(hasValue) ?? []
  const charts = (board?.charts ?? []).flatMap((c) => { const shown = withData(c); return shown ? [shown] : [] })

  return (
    <div ref={root} className={full ? 'h-full overflow-auto bg-gray-50 p-6' : ''}>
      <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{board?.name ?? t('Dashboard')}</h1>
          <p className="text-gray-500">
            {now.toLocaleDateString(locale, { weekday: 'long', day: 'numeric', month: 'long' })} · {time(now)}
            {board ? <> · {t('atualizado às {time}', { time: time(new Date(board.generatedAt)) })}</> : null}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {board?.period && (
            <label className="flex items-center">
              <span className="sr-only">{t('Período')}</span>
              <select value={board.period.months} onChange={(e) => choosePeriod(Number(e.target.value))} className="rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-600">
                {board.period.options.map((n) => <option key={n} value={n}>{t('Últimos {n} meses', { n })}</option>)}
              </select>
            </label>
          )}
          <button type="button" onClick={() => void load()} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Atualizar')}</button>
          <button type="button" onClick={toggleFull} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600">{full ? t('Sair da tela cheia') : t('Tela cheia')}</button>
        </div>
      </header>

      {offline && <p role="status" className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">{t('Sem internet: mostrando a última atualização. Tenta de novo a cada 5 minutos.')}</p>}
      {error && !board && <p role="alert" className="py-12 text-center text-gray-600">{t(error)}</p>}
      {!board && !error && <p className="py-12 text-center text-gray-500">{offline ? t('Sem internet.') : t('Carregando…')}</p>}

      {board && (
        <>
          {tiles.length > 0 && (
            <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-3">
              {tiles.map((tile, i) => <TileCard key={tile.label} tile={tile} index={i} />)}
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {charts.map((chart) => <ChartCard key={chart.title} chart={chart} />)}
          </div>
          {!tiles.length && !charts.length && <p className="py-12 text-center text-gray-500">{t('Ainda não há dados para mostrar.')}</p>}
        </>
      )}
    </div>
  )
}

function useFormat() {
  const t = useT()
  const locale = useLocale()
  // Números dentro do texto com separador de milhar ("1.587 L/dia")
  const text = (txt: Txt) => (typeof txt === 'string' ? t(txt) : t(txt.text, Object.fromEntries(Object.entries(txt.vars).map(([k, v]) => [k, typeof v === 'number' ? v.toLocaleString(locale) : v]))))
  const value = (n: number | null, unit: Unit = '') => {
    if (n === null) return '—'
    if (unit === 'R$') return n.toLocaleString(locale, { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    if (unit === '%') return `${n}%`
    return `${n.toLocaleString(locale)}${unit === 'L' ? ' L' : ''}`
  }
  return { t, text, value }
}

function TileCard({ tile, index }: { tile: Tile; index: number }) {
  const { t, text, value } = useFormat()
  const accent = tile.tone ? TONE_ACCENT[tile.tone] : tile.accent ?? ACCENTS[index % ACCENTS.length]
  const shown = tile.suffix ? <>{value(tile.value, tile.unit)} <span className="text-xl font-semibold">{t(tile.suffix)}</span></> : value(tile.value, tile.unit)
  return <StatTile accent={accent} label={t(tile.label)} value={shown} detail={tile.detail ? text(tile.detail) : undefined} badge={tile.tone === 'bad' ? t('Atenção') : undefined} />
}

function ChartCard({ chart }: { chart: Chart }) {
  const { t, text } = useFormat()
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-4 ${chart.full ? 'lg:col-span-full' : chart.wide ? 'lg:col-span-2' : ''}`}>
      <h2 className={`font-semibold text-gray-800 ${chart.subtitle ? '' : 'mb-3'}`}>{t(chart.title)}{chart.kind === 'columns' && chart.unit === 'R$' ? ' (R$)' : ''}</h2>
      {chart.subtitle && <p className="mb-3 text-sm text-gray-500">{text(chart.subtitle)}</p>}
      <ChartBody chart={chart} />
    </section>
  )
}

function ChartBody({ chart }: { chart: Chart }) {
  const { t, text, value } = useFormat()
  const lang = useLang()
  const empty = <p className="py-10 text-center text-sm text-gray-500">{t('Sem dados no período')}</p>
  // Dias: rótulo a cada 6 dias, contando de hoje para trás (o gráfico só mostra rótulos alternados)
  const xLabel = (x: string, i: number, n: number) => (x.length === 7 ? monthShort(x, lang) : (n - 1 - i) % 6 === 0 ? `${x.slice(8, 10)}/${x.slice(5, 7)}` : '')
  const xName = (x: string) => (x.length === 7 ? monthName(x, lang) : `${x.slice(8, 10)}/${x.slice(5, 7)}`)
  const axisUnit = (unit?: Unit) => (unit === '%' ? '%' : '')

  if (chart.kind === 'columns' || chart.kind === 'line') {
    if (!chart.points.some((p) => p.value)) return empty
    // Gráfico largo: mais largo por dentro também, para as letras ficarem do mesmo tamanho dos outros
    const width = chart.wide ? 760 : undefined
    const points: MonthPoint[] = chart.points.map((p, i) => ({ label: xLabel(p.x, i, chart.points.length), value: p.value, title: `${xName(p.x)}: ${value(p.value, chart.unit)}` }))
    return chart.kind === 'line'
      ? <LineChart points={points} name={t(chart.title)} unit={axisUnit(chart.unit)} max={chart.max} width={width} />
      : <ColumnChart points={points} name={t(chart.title)} unit={axisUnit(chart.unit)} width={width} />
  }

  if (chart.kind === 'stacked') {
    const series: Series[] = chart.series.slice(0, PALETTE.length).map((s, i) => ({ key: s.name + i, name: s.name, color: PALETTE[i], counts: s.values }))
    const rest = chart.series.slice(PALETTE.length)
    if (rest.length) series.push({ key: 'outras', name: t('Outras ({n})', { n: rest.length }), color: OTHER, counts: chart.xs.map((_, i) => rest.reduce((sum, s) => sum + s.values[i], 0)) })
    const totals = chart.xs.map((_, i) => series.reduce((sum, s) => sum + s.counts[i], 0))
    if (!totals.some(Boolean)) return empty
    const shown = series.filter((s) => s.counts.some(Boolean))
    return (
      <>
        {shown.length > 1 && (
          <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
            {shown.map((s) => <li key={s.key} className="flex items-center gap-1.5"><span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />{s.name}</li>)}
          </ul>
        )}
        <StackedColumns months={chart.xs} series={series} totals={totals} label={(x) => xLabel(x, 0, 1)} title={(x, s, n) => `${s ? `${s} — ` : ''}${xName(x)}: ${value(n, chart.unit)}`} name={t(chart.title)} />
      </>
    )
  }

  if (chart.kind === 'bars') {
    if (!chart.rows.length) return empty
    const max = chart.max ?? Math.max(1, ...chart.rows.map((r) => r.value ?? 0))
    const ref = chart.reference
    const refAt = ref ? `${Math.min(100, (ref.value / max) * 100)}%` : ''
    return (
      <div>
        {/* Rótulo da linha de referência, alinhado com ela por cima das barras */}
        {ref && (
          <div className="grid grid-cols-[minmax(0,10rem)_1fr_auto] gap-3" aria-hidden="true">
            <span />
            <span className="relative h-5"><span className="absolute -translate-x-1/2 whitespace-nowrap text-xs text-gray-600" style={{ left: refAt }}>{text(ref.label)}</span></span>
            <span className="min-w-[3rem]" />
          </div>
        )}
        <ul className="space-y-2">
          {chart.rows.map((r) => {
            const label = r.translate ? t(r.label) : r.label
            return (
              <li key={r.label} title={`${label}: ${value(r.value, chart.unit)}`} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
                <span className="truncate text-sm text-gray-800">{label}</span>
                <span className="relative h-3 rounded-full bg-gray-100" aria-hidden="true">
                  {r.value !== null && r.value > 0 && <span className={`block h-3 rounded-full ${BAR[chart.color ?? 'green']}`} style={{ width: `${Math.max(1, (r.value / max) * 100)}%` }} />}
                  {ref && <span className="absolute -top-1.5 -bottom-1.5 border-l-2 border-dashed border-gray-500" style={{ left: refAt }} />}
                </span>
                <span className="min-w-[3rem] text-right text-sm font-semibold tabular-nums text-gray-800">{value(r.value, chart.unit)}</span>
              </li>
            )
          })}
        </ul>
        {ref && <p className="sr-only">{text(ref.label)}</p>}
      </div>
    )
  }

  if (chart.kind === 'table') {
    if (!chart.rows.length) return empty
    const cell = (c: Cell) => {
      const shown = 'text' in c ? text(c.text) : 'date' in c ? (c.date ? `${c.date.slice(8, 10)}/${c.date.slice(5, 7)}/${c.date.slice(0, 4)}` : '—') : value(c.value, c.unit)
      if (!c.badge || !c.tone) return shown
      return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-sm font-semibold ${TONE_BADGE[c.tone]}`}>{shown} ({text(c.badge)})</span>
    }
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-gray-600">
              {chart.columns.map((col) => <th key={col.label} scope="col" className={`whitespace-nowrap px-3 py-2 font-semibold ${col.numeric ? 'text-right' : ''}`}>{t(col.label)}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {chart.rows.map((row, i) => (
              <tr key={i}>
                {row.map((c, j) => j === 0
                  ? <th key={j} scope="row" className="whitespace-nowrap px-3 py-2.5 font-medium text-gray-900">{cell(c)}</th>
                  : <td key={j} className={`whitespace-nowrap px-3 py-2.5 text-gray-800 ${chart.columns[j]?.numeric ? 'text-right tabular-nums' : ''}`}>{cell(c)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (chart.kind !== 'list') return null
  if (!chart.rows.length) return <p className="py-6 text-center text-sm text-gray-500">{t(chart.empty)}</p>
  return (
    <ul className="divide-y divide-gray-100">
      {chart.rows.map((r, i) => (
        <li key={i} className="flex items-start gap-3 py-2">
          <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${r.tone ? TONE_DOT[r.tone] : 'bg-gray-300'}`} />
          <span className="min-w-0">
            <span className="block font-medium text-gray-800">{text(r.title)}</span>
            {r.detail && <span className="block text-sm text-gray-500">{text(r.detail)}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
