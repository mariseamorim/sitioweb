'use client'

import { useState } from 'react'
import type { PeriodSummary as Summary, PeriodTotals } from '@/lib/periodSummary'
import { fmtMoney, fmtNumber } from '@/lib/reports'
import { useT } from '@/lib/i18n'

// Painel: resumo do mês ou do ano (mês a mês), com leite, dinheiro e nascimentos conforme o acesso da pessoa

export function PeriodSummary({ summary, show }: { summary: Summary; show: { milk: boolean; money: boolean; births: boolean } }) {
  const t = useT()
  const [view, setView] = useState<'mes' | 'ano'>('mes')
  const totals = view === 'mes' ? summary.month : summary.year
  const cards = cardsFor(totals, show, t)

  return (
    <section aria-labelledby="periodo" className="mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="periodo" className="text-lg font-bold text-gray-900">{t('Resumo do período')}</h2>
          <p className="mt-1 text-sm text-gray-600">{view === 'mes' ? t('Mês atual: {label}.', { label: summary.month.label }) : t('Ano de {label}, mês a mês.', { label: summary.year.label })}</p>
        </div>
        <div role="group" aria-label={t('Período do resumo')} className="flex rounded-lg border border-gray-200 bg-white p-0.5">
          {([['mes', 'Visão mensal'], ['ano', 'Visão anual']] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key}
              className={`rounded-md px-3 py-1.5 text-sm font-semibold ${view === key ? 'bg-green-700 text-white' : 'text-gray-700 hover:bg-gray-50'}`}>
              {t(label)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
            <p className="text-sm font-medium leading-tight text-gray-500">{c.label}</p>
            <p className={`mt-3 text-xl font-bold ${c.tone}`}>{c.value}</p>
            {c.detail && <p className="mt-1 text-xs text-gray-500">{c.detail}</p>}
          </div>
        ))}
      </div>

      {view === 'ano' && (
        <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">{t('Mês')}</th>
                {show.milk && <th className="px-3 py-2 text-right">{t('Leite (L)')}</th>}
                {show.money && <th className="px-3 py-2 text-right">{t('Receitas')}</th>}
                {show.money && <th className="px-3 py-2 text-right">{t('Despesas')}</th>}
                {show.money && <th className="px-3 py-2 text-right">{t('Saldo')}</th>}
                {show.births && <th className="px-3 py-2 text-right">{t('Nascimentos')}</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {summary.year.months.map((m) => (
                <tr key={m.month}>
                  <td className="px-3 py-2 font-medium text-gray-900">{m.label}</td>
                  {show.milk && <td className="px-3 py-2 text-right text-gray-700">{m.liters ? fmtNumber(m.liters, 1) : '—'}</td>}
                  {show.money && <td className="px-3 py-2 text-right text-green-700 whitespace-nowrap">{m.income ? fmtMoney(m.income) : '—'}</td>}
                  {show.money && <td className="px-3 py-2 text-right text-red-600 whitespace-nowrap">{m.expense ? fmtMoney(m.expense) : '—'}</td>}
                  {show.money && <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${m.balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{m.income || m.expense ? fmtMoney(m.balance) : '—'}</td>}
                  {show.births && <td className="px-3 py-2 text-right text-gray-700">{m.births || '—'}</td>}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold text-gray-900">
              <tr>
                <td className="px-3 py-2">{t('Total')}</td>
                {show.milk && <td className="px-3 py-2 text-right">{fmtNumber(summary.year.liters, 1)}</td>}
                {show.money && <td className="px-3 py-2 text-right text-green-700 whitespace-nowrap">{fmtMoney(summary.year.income)}</td>}
                {show.money && <td className="px-3 py-2 text-right text-red-600 whitespace-nowrap">{fmtMoney(summary.year.expense)}</td>}
                {show.money && <td className={`px-3 py-2 text-right whitespace-nowrap ${summary.year.balance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtMoney(summary.year.balance)}</td>}
                {show.births && <td className="px-3 py-2 text-right">{summary.year.births}</td>}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}

function cardsFor(t: PeriodTotals, show: { milk: boolean; money: boolean; births: boolean }, tr: (text: string, vars?: Record<string, string | number>) => string) {
  const cards: { label: string; value: string; detail?: string; tone: string }[] = []
  if (show.milk) cards.push({ label: tr('Leite produzido'), value: `${fmtNumber(t.liters, 1)} L`, detail: t.milkValue !== null ? tr('≈ {value} pelo preço do litro', { value: fmtMoney(t.milkValue) }) : undefined, tone: 'text-gray-900' })
  if (show.money) {
    cards.push({ label: tr('Receitas'), value: fmtMoney(t.income), tone: 'text-green-700' })
    cards.push({ label: tr('Despesas'), value: fmtMoney(t.expense), tone: 'text-red-600' })
    cards.push({ label: tr('Saldo'), value: fmtMoney(t.balance), tone: t.balance >= 0 ? 'text-green-700' : 'text-red-600' })
  }
  if (show.births) cards.push({ label: tr('Nascimentos'), value: String(t.births), tone: 'text-gray-900' })
  return cards
}
