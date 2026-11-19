'use client'

// Dashboard: os números e gráficos do perfil numa tela só, para deixar numa TV ou monitor.
// Atualiza sozinho a cada 5 minutos. Em "Tela cheia" some o menu, as letras crescem com a largura da tela
// e a tela não apaga (quando o navegador permite). Sem internet, continua mostrando a última atualização.
import { useCallback, useEffect, useRef, useState } from 'react'
import { ColumnChart, LineChart, OTHER, PALETTE, StackedColumns, type MonthPoint, type Series } from '@/components/MonthCharts'
import { monthName, monthShort } from '@/lib/reproInsights'
import { useLang, useLocale, useT } from '@/lib/i18n'
import type { Board, Chart, Tile, Txt, Unit } from '@/lib/dashboardTypes'

const REFRESH_MS = 5 * 60 * 1000
const TONE_TEXT = { good: 'text-green-700', warn: 'text-amber-700', bad: 'text-red-700' } as const
const TONE_DOT = { warn: 'bg-amber-500', bad: 'bg-red-600' } as const

type WakeLock = { release: () => Promise<void> }

export default function DashboardPage() {
  const t = useT()
  const locale = useLocale()
  const [board, setBoard] = useState<Board | null>(null)
  const [error, setError] = useState('')
  const [offline, setOffline] = useState(false)
  const [now, setNow] = useState(() => new Date())
  const [full, setFull] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data.error ?? 'Não foi possível carregar o Dashboard.'); return }
      setBoard(data as Board)
      setError('')
      setOffline(false)
    } catch {
      setOffline(true)
    }
  }, [])

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
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Atualizar')}</button>
          <button type="button" onClick={toggleFull} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600">{full ? t('Sair da tela cheia') : t('Tela cheia')}</button>
        </div>
      </header>

      {offline && <p role="status" className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">{t('Sem internet: mostrando a última atualização. Tenta de novo a cada 5 minutos.')}</p>}
      {error && !board && <p role="alert" className="py-12 text-center text-gray-600">{t(error)}</p>}
      {!board && !error && <p className="py-12 text-center text-gray-500">{offline ? t('Sem internet.') : t('Carregando…')}</p>}

      {board && (
        <>
          {board.tiles.length > 0 && (
            <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(10.5rem,1fr))] gap-3">
              {board.tiles.map((tile) => <TileCard key={tile.label} tile={tile} />)}
            </div>
          )}
          <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {board.charts.map((chart) => <ChartCard key={chart.title} chart={chart} />)}
          </div>
          {!board.tiles.length && !board.charts.length && <p className="py-12 text-center text-gray-500">{t('Ainda não há dados para mostrar.')}</p>}
        </>
      )}
    </div>
  )
}

function useFormat() {
  const t = useT()
  const locale = useLocale()
  const text = (txt: Txt) => (typeof txt === 'string' ? t(txt) : t(txt.text, txt.vars))
  const value = (n: number | null, unit: Unit = '') => {
    if (n === null) return '—'
    if (unit === 'R$') return n.toLocaleString(locale, { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })
    if (unit === '%') return `${n}%`
    return `${n.toLocaleString(locale)}${unit === 'L' ? ' L' : ''}`
  }
  return { t, text, value }
}

function TileCard({ tile }: { tile: Tile }) {
  const { t, text, value } = useFormat()
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-sm text-gray-500">{t(tile.label)}</p>
      <p className={`mt-1 text-3xl font-bold tabular-nums ${tile.tone ? TONE_TEXT[tile.tone] : 'text-gray-800'}`}>{value(tile.value, tile.unit)}</p>
      {tile.detail && <p className="mt-1 text-sm text-gray-500">{text(tile.detail)}</p>}
    </div>
  )
}

function ChartCard({ chart }: { chart: Chart }) {
  const { t } = useFormat()
  return (
    <section className={`rounded-xl border border-gray-200 bg-white p-4 ${chart.wide ? 'lg:col-span-2' : ''}`}>
      <h2 className={`font-semibold text-gray-800 ${chart.subtitle ? '' : 'mb-3'}`}>{t(chart.title)}{chart.kind === 'columns' && chart.unit === 'R$' ? ' (R$)' : ''}</h2>
      {chart.subtitle && <p className="mb-3 text-sm text-gray-500">{t(chart.subtitle)}</p>}
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
    return (
      <ul className="space-y-2">
        {chart.rows.map((r) => {
          const label = r.translate ? t(r.label) : r.label
          return (
            <li key={r.label} title={`${label}: ${value(r.value, chart.unit)}`} className="grid grid-cols-[minmax(0,10rem)_1fr_auto] items-center gap-3">
              <span className="truncate text-sm text-gray-800">{label}</span>
              <span className="h-3 rounded-r bg-gray-100" aria-hidden="true">
                {r.value !== null && r.value > 0 && <span className="block h-3 rounded-r bg-green-700" style={{ width: `${Math.max(1, (r.value / max) * 100)}%` }} />}
              </span>
              <span className="min-w-[3rem] text-right text-sm font-semibold tabular-nums text-gray-800">{value(r.value, chart.unit)}</span>
            </li>
          )
        })}
      </ul>
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
