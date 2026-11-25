'use client'

// Financeiro: resultado do leite (custo e sobra por litro, mês a mês) e os gastos acima do normal no mês.
// Os números vêm de GET /api/financeiro/resultado (regra em src/lib/milkResult.ts).
import { useEffect, useState } from 'react'
import type { MilkMonth, SpendingAlert } from '@/lib/milkResult'
import { LineChart, type MonthPoint } from '@/components/MonthCharts'
import { StatTile } from '@/components/StatTile'
import { AlertaIcon } from '@/components/ModuleIcons'
import { useLocale, useT } from '@/lib/i18n'

interface Data { today: string; months: MilkMonth[]; hasMilk: boolean; alerts: SpendingAlert[] }

const money = (v: number, locale: string, digits = 2) => v.toLocaleString(locale, { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits })

/** Gastos acima do normal (mês atual × média dos 3 anteriores) */
export function SpendingAlerts({ alerts }: { alerts: SpendingAlert[] }) {
  const t = useT()
  const locale = useLocale()
  if (!alerts.length) return null
  return (
    <section aria-label={t('Gastos acima do normal')} className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="mb-2 flex items-center gap-2 font-semibold text-amber-900"><AlertaIcon className="h-5 w-5" />{t('Gastos acima do normal neste mês')}</h2>
      <ul className="space-y-1.5 text-sm text-amber-900">
        {alerts.map((a) => (
          <li key={a.category}>
            <strong>{t(a.category)}</strong>: {t('{value} até agora, {percent}% acima da média dos últimos 3 meses ({average}).', { value: money(a.current, locale, 0), percent: a.percent, average: money(a.average, locale, 0) })}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function useMilkResult(enabled: boolean, refreshKey = 0) {
  const [data, setData] = useState<Data | null>(null)
  useEffect(() => {
    if (!enabled) return
    let alive = true
    fetch('/api/financeiro/resultado').then((r) => (r.ok ? r.json() : null)).then((d) => { if (alive && d) setData(d) }).catch(() => { /* sem internet: o painel some */ })
    return () => { alive = false }
  }, [enabled, refreshKey])
  return data
}

/** Resultado do leite: o mês atual em destaque, o custo por litro em 12 meses e a tabela */
export function MilkResultPanel({ data }: { data: Data }) {
  const t = useT()
  const locale = useLocale()
  if (!data.hasMilk) return null
  const months = data.months
  const current = months[months.length - 1]
  // O mês atual ainda está correndo: o destaque usa o último mês fechado quando o atual não tem leite anotado
  const shown = current.liters > 0 ? current : months[months.length - 2] ?? current
  const monthName = (m: string, long = false) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(locale, { month: long ? 'long' : 'short', timeZone: 'UTC' }).replace('.', '')
  const label = (m: string) => `${monthName(m)}${m.slice(0, 4) !== data.today.slice(0, 4) ? `/${m.slice(2, 4)}` : ''}`
  const perLiter = (v: number | null) => (v === null ? '—' : money(v, locale))
  const points: MonthPoint[] = months.map((m) => ({ label: label(m.month), value: m.costPerLiter, title: `${monthName(m.month, true)}: ${perLiter(m.costPerLiter)} ${t('por litro')}` }))
  const margin = shown.marginPerLiter

  return (
    <section aria-labelledby="resultado-leite" className="mb-6 rounded-xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
      <h2 id="resultado-leite" className="text-sm font-semibold text-gray-800">{t('Resultado do leite')} · <span className="capitalize">{monthName(shown.month, true)}</span>{shown === current ? ` (${t('até hoje')})` : ''}</h2>
      <p className="mb-3 text-xs text-gray-500">{t('Custos: as despesas do mês, menos as ligadas a um lote de recria ou engorda.')}{shown.feedPerLiter !== null ? ` ${t('Ração por litro: saídas de ração e sal do estoque no mês (sem o trato dos lotes) ÷ litros.')}` : ''}{shown.revenueEstimated ? ` ${t('Sem venda de leite lançada: a receita foi estimada pelo preço do litro.')}` : ''}</p>
      <div className={`grid grid-cols-2 gap-3 ${shown.feedPerLiter !== null ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <StatTile accent="blue" label={t('Leite produzido')} value={`${shown.liters.toLocaleString(locale, { maximumFractionDigits: 0 })} L`} />
        <StatTile accent="green" label={t('Receita do leite')} value={money(shown.revenue, locale, 0)} detail={shown.revenueEstimated ? t('estimada') : undefined} />
        <StatTile accent="amber" label={t('Custo por litro')} value={perLiter(shown.costPerLiter)} detail={t('{value} de custos', { value: money(shown.costs, locale, 0) })} />
        <StatTile accent={margin === null || margin >= 0 ? 'green' : 'red'} label={t(margin !== null && margin < 0 ? 'Prejuízo por litro' : 'Sobra por litro')} value={perLiter(margin === null ? null : Math.abs(margin))}
          detail={t(shown.result >= 0 ? '{value} de sobra no mês' : '{value} de prejuízo no mês', { value: money(Math.abs(shown.result), locale, 0) })} />
        {shown.feedPerLiter !== null && (
          <StatTile accent="teal" icon="estoque" label={t('Ração por litro')} value={`${shown.feedPerLiter.toLocaleString(locale, { maximumFractionDigits: 2 })} kg`}
            detail={t('{kg} kg de ração no mês', { kg: (shown.feedKg ?? 0).toLocaleString(locale) })} />
        )}
      </div>

      {/* Gráfico fechado: abre na largura de um gráfico comum (letra do tamanho das outras telas) */}
      {months.some((m) => m.costPerLiter !== null) && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-green-800">{t('Ver gráfico do custo por litro')}</summary>
          <div className="mt-2 max-w-3xl">
            <p className="mb-1 text-xs font-semibold text-gray-600">{t('Custo por litro nos últimos 12 meses')}</p>
            <LineChart points={points} name={t('Custo por litro')} unit="" width={760} />
          </div>
        </details>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-green-800">{t('Ver mês a mês')}</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="whitespace-nowrap bg-gray-50 text-xs uppercase text-gray-500">
              <tr>{['Mês', 'Litros', 'Receita', 'Custos', 'Custo/L', 'Sobra/L', 'Ração/L'].map((h, i) => <th key={h} className={`px-3 py-2 ${i ? 'text-right' : 'text-left'}`}>{t(h)}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[...months].reverse().map((m) => (
                <tr key={m.month}>
                  <td className="whitespace-nowrap px-3 py-2 capitalize text-gray-800">{label(m.month)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.liters ? m.liters.toLocaleString(locale, { maximumFractionDigits: 0 }) : '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{m.revenue ? money(m.revenue, locale, 0) : '—'}{m.revenueEstimated ? '*' : ''}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{m.costs ? money(m.costs, locale, 0) : '—'}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{perLiter(m.costPerLiter)}</td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums ${m.marginPerLiter !== null && m.marginPerLiter < 0 ? 'text-red-700' : 'text-green-800'}`}>{perLiter(m.marginPerLiter)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{m.feedPerLiter === null ? '—' : `${m.feedPerLiter.toLocaleString(locale, { maximumFractionDigits: 2 })} kg`}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {months.some((m) => m.revenueEstimated) && <p className="mt-1 text-xs text-gray-500">* {t('receita estimada pelo preço do litro')}</p>}
        </div>
      </details>
    </section>
  )
}
