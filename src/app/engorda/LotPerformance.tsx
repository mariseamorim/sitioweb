'use client'

// Desempenho do lote: resumo com o plano, ganho por animal e do lote, GMD, evolução do peso e despesas.
// Só mostra números que vêm dos registros; sem dado, aparece "—".

import { LIVE_KG_PER_ARROBA, arrobasProduced, daysBetween, feedingSummary, lotSummary, projectTarget } from '@/lib/lots'
import { expectedWeight, planDays } from '@/lib/lotPlans'
import { fmtDate, fmtNumber } from '@/lib/reports'
import { useLocale, useT } from '@/lib/i18n'
import { StatTile } from '@/components/StatTile'
import { LineChart } from '@/components/MonthCharts'
import { Lot, kg } from './shared'

const ddmm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const plusDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
const arroba = (kgValue: number) => kgValue / LIVE_KG_PER_ARROBA

export function LotPerformance({ lot, today }: { lot: Lot; today: string }) {
  const t = useT()
  const locale = useLocale()
  const money = (v: number) => v.toLocaleString(locale, { style: 'currency', currency: 'BRL' })
  const s = lotSummary(lot.weighings, today, lot.endDate)
  const heads = lot.animals.length || s.last?.headCount || 0
  const plan = lot.plan ?? null
  const duration = plan ? planDays(plan) : 0
  const target = plan?.targetWeight ?? lot.targetWeight
  // Previsão de término: início + duração do plano; sem plano (ou plano sem dias), pelo ritmo de ganho até a meta
  const endForecast = duration > 0 ? plusDays(lot.startDate, duration) : (lot.endDate ? null : projectTarget(s, target)?.date ?? null)

  // Média por animal e total do lote (peso médio × cabeças da pesagem)
  const totalEntry = s.entry ? s.entry.avgWeight * s.entry.headCount : null
  const totalLast = s.last ? s.last.avgWeight * s.last.headCount : null
  const totalGain = s.gainKg !== null && s.last ? s.gainKg * s.last.headCount : null
  const arrobas = arrobasProduced(s)

  // Comparação com o plano: esperado hoje e na data da última pesagem (para a diferença ser justa)
  const end = lot.endDate ?? today
  const expectedToday = plan && s.entry ? expectedWeight(plan, s.entry.avgWeight, daysBetween(s.entry.date, end)) : null
  const expectedAtLast = plan && s.entry && s.last && s.last !== s.entry ? expectedWeight(plan, s.entry.avgWeight, daysBetween(s.entry.date, s.last.date)) : null
  const diff = expectedAtLast !== null && s.last ? Math.round((s.last.avgWeight - expectedAtLast) * 10) / 10 : null

  // Despesas: trato (custo das baixas no cocho) + despesas do Financeiro ligadas ao lote
  const feed = feedingSummary(lot.feedings, heads)
  const transactions = lot.transactions ?? []
  const txTotal = transactions.reduce((sum, x) => sum + x.amount, 0)
  const hasOperational = feed.cost !== null || transactions.length > 0
  const operational = hasOperational ? (feed.cost ?? 0) + txTotal : null
  const purchase = lot.purchaseValue ?? null
  const per = (value: number | null, divisor: number | null) => (value !== null && divisor && divisor > 0 ? money(value / divisor) : '—')
  const byCategory = new Map<string, number>()
  if (feed.cost) byCategory.set('Trato', feed.cost)
  for (const x of transactions) byCategory.set(x.category, (byCategory.get(x.category) ?? 0) + x.amount)
  const categories = [...byCategory.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])
  const maxCategory = categories[0]?.[1] ?? 1

  const points = [...lot.weighings].sort((a, b) => a.date.localeCompare(b.date)).map((w) => ({
    label: ddmm(w.date), value: w.avgWeight, title: `${fmtDate(w.date)}: ${kg(w.avgWeight)}`,
  }))

  const summary: [string, string][] = [
    [t('Animais'), String(heads)],
    [t('Data de início'), fmtDate(lot.startDate)],
    [t('Plano'), plan?.name ?? '—'],
    [t('Duração do plano'), duration > 0 ? t('{n} dias', { n: duration }) : '—'],
    [t('Meta de peso'), target ? kg(target) : '—'],
    [t('Previsão de término'), endForecast ? fmtDate(endForecast) : '—'],
  ]

  return (
    <section className="mt-5">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('Desempenho')}</h3>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {summary.map(([title, value]) => (
          <div key={title} className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
            <dt className="text-xs text-gray-500">{title}</dt>
            <dd className="truncate font-semibold tabular-nums text-gray-900" title={value}>{value}</dd>
          </div>
        ))}
      </dl>

      <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Média por animal')}</h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile accent="blue" label={t('Peso inicial')} value={s.entry ? kg(s.entry.avgWeight) : '—'} />
        <StatTile accent="green" label={t('Peso atual')} value={s.last ? kg(s.last.avgWeight) : '—'} />
        <StatTile accent="teal" label={t('Ganho médio')} value={s.gainKg !== null ? kg(s.gainKg) : '—'} />
        <StatTile accent="amber" label={t('Ganho em @')} value={s.gainKg !== null ? `${fmtNumber(arroba(s.gainKg), 2)} @` : '—'} />
      </div>

      <h4 className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Total do lote')}</h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile accent="blue" label={t('Peso inicial total')} value={totalEntry !== null ? kg(totalEntry) : '—'} />
        <StatTile accent="green" label={t('Peso atual total')} value={totalLast !== null ? kg(totalLast) : '—'} />
        <StatTile accent="teal" label={t('Ganho total')} value={totalGain !== null ? kg(totalGain) : '—'} />
        <StatTile accent="amber" label={t('Ganho total em @')} value={totalGain !== null ? `${fmtNumber(arroba(totalGain), 1)} @` : '—'} />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,14rem)_1fr]">
        <StatTile accent="green" label={t('GMD do lote')}
          value={s.gmd !== null ? <>{fmtNumber(s.gmd, 3)} <span className="text-lg font-semibold">{t('kg/dia')}</span></> : '—'}
          detail={s.gmd === null ? t('Faça mais uma pesagem para o app calcular o ganho por dia.') : undefined} />
        <figure className="rounded-xl border border-gray-100 bg-white p-3">
          <figcaption className="mb-1 text-sm font-medium text-gray-700">{t('Evolução do peso médio')}</figcaption>
          {points.length > 0
            ? <LineChart points={points} name={t('Peso médio do lote em cada pesagem')} unit=" kg" />
            : <p className="py-6 text-center text-sm text-gray-500">{t('Nenhuma pesagem ainda.')}</p>}
        </figure>
      </div>
      {expectedToday !== null && (
        <p className="mt-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          {t('Esperado pelo plano hoje: {weight}', { weight: kg(expectedToday) })}
          {diff !== null && s.last && (
            <> · {t(diff >= 0 ? 'Na última pesagem ({date}), o lote estava {kg} acima do plano.' : 'Na última pesagem ({date}), o lote estava {kg} abaixo do plano.', { date: fmtDate(s.last.date), kg: kg(Math.abs(diff)) })}</>
          )}
        </p>
      )}

      <h4 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Despesas')}</h4>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile accent="amber" label={t('Valor de compra do lote')} value={purchase !== null ? money(purchase) : '—'} />
        <StatTile accent="amber" label={t('Valor médio de compra por animal')} value={per(purchase, heads)} />
        <StatTile accent="red" label={t('Despesas operacionais')} value={operational !== null ? money(operational) : '—'}
          detail={hasOperational ? t('Trato {feed} + Financeiro {other}', { feed: money(feed.cost ?? 0), other: money(txTotal) }) : undefined} />
        <StatTile accent="red" label={t('Despesas por animal')} value={per(operational, heads)} />
        <StatTile accent="red" label={t('Despesas por kg ganho')} value={per(operational, totalGain)} />
        <StatTile accent="red" label={t('Despesas por @ produzida')} value={per(operational, arrobas)} />
      </div>
      {!hasOperational && <p className="mt-2 text-xs text-gray-500">{t('Para ver as despesas, lance o trato com o preço do produto ou anote a despesa no Financeiro escolhendo este lote.')}</p>}

      {categories.length > 0 && (
        <div className="mt-3 rounded-xl border border-gray-100 bg-white p-3">
          <p className="mb-2 text-sm font-medium text-gray-700">{t('Despesas por categoria')}</p>
          <ul className="space-y-2">
            {categories.map(([category, value]) => (
              <li key={category} title={`${t(category)}: ${money(value)}`} className="grid grid-cols-[minmax(0,8rem)_1fr_auto] items-center gap-3">
                <span className="truncate text-sm text-gray-800">{t(category)}</span>
                <span className="h-3 rounded-r bg-gray-100" aria-hidden="true">
                  <span className="block h-3 rounded-r bg-red-500" style={{ width: `${Math.max(1, (value / maxCategory) * 100)}%` }} />
                </span>
                <span className="min-w-[3rem] text-right text-sm font-semibold tabular-nums text-gray-800">{money(value)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
