'use client'
// Gráficos do painel do veterinário, com todas as propriedades juntas:
// - partos previstos por mês, em colunas empilhadas (uma cor por propriedade, sempre na mesma ordem do painel);
// - concepção por propriedade, em barras deitadas, da maior para a menor; tocar abre os indicadores da propriedade.
// O valor de cada parte aparece ao passar o mouse ou focar, e "Ver em tabela" traz todos os números.
import { ChartTable, OTHER, PALETTE, StackedColumns, type Series } from '@/components/MonthCharts'
import { monthName, monthShort } from '@/lib/reproInsights'
import { useLang, useT } from '@/lib/i18n'

export interface ChartClient {
  id: string
  farmId: string
  name: string
  pregnancyRate: number | null
  birthsByMonth?: { month: string; count: number }[]
}

export function VetCharts<C extends ChartClient>({ clients, busy, onOpen }: { clients: C[]; busy: string; onOpen: (client: C) => void }) {
  const t = useT()
  if (!clients.length) return null
  return (
    <div className="mb-6 grid gap-4 lg:grid-cols-2">
      <BirthsChart clients={clients} />
      <section className="bg-white rounded-xl border border-gray-200 p-4" aria-labelledby="vet-rate">
        <h2 id="vet-rate" className="font-semibold text-gray-800">{t('Concepção por propriedade')}</h2>
        <p className="mb-3 text-sm text-gray-500">{t('Das diagnosticadas nos últimos 12 meses, quantas ficaram prenhas. Toque para ver os indicadores.')}</p>
        <RateBars clients={clients} busy={busy} onOpen={onOpen} />
      </section>
    </div>
  )
}

function BirthsChart({ clients }: { clients: ChartClient[] }) {
  const t = useT()
  const lang = useLang()
  const months = clients.find((c) => c.birthsByMonth?.length)?.birthsByMonth?.map((m) => m.month) ?? []
  const countsOf = (c: ChartClient) => months.map((month) => c.birthsByMonth?.find((m) => m.month === month)?.count ?? 0)
  const series: Series[] = clients.slice(0, PALETTE.length).map((c, i) => ({ key: c.id, name: c.name, color: PALETTE[i], counts: countsOf(c) }))
  const rest = clients.slice(PALETTE.length)
  if (rest.length) series.push({ key: 'outras', name: t('Outras ({n})', { n: rest.length }), color: OTHER, counts: months.map((_, i) => rest.reduce((sum, c) => sum + countsOf(c)[i], 0)) })
  const totals = months.map((_, i) => series.reduce((sum, s) => sum + s.counts[i], 0))
  const total = totals.reduce((a, b) => a + b, 0)
  const births = (n: number) => t(n === 1 ? '{n} parto previsto' : '{n} partos previstos', { n })
  // Só aparecem na legenda as propriedades com algum parto no período
  const shown = series.filter((s) => s.counts.some(Boolean))

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4" aria-labelledby="vet-births">
      <h2 id="vet-births" className="font-semibold text-gray-800">{t('Partos previstos por mês')}</h2>
      <p className="mb-3 text-sm text-gray-500">{t('Todas as propriedades, pelas coberturas em aberto')}</p>
      {!months.length || total === 0 ? (
        <p className="py-10 text-center text-sm text-gray-500">{t('Nenhum parto previsto nos próximos 6 meses.')}</p>
      ) : (
        <>
          {shown.length > 1 && (
            <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
              {shown.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: s.color }} />
                  {s.name}
                </li>
              ))}
            </ul>
          )}
          <StackedColumns months={months} series={series} totals={totals} label={(m) => monthShort(m, lang)} title={(m, s, n) => `${s ? `${s} — ` : ''}${monthName(m, lang)}: ${births(n)}`} name={t('Partos previstos por mês nos próximos 6 meses, por propriedade')} />
          <ChartTable
            caption={t('Partos previstos por mês, por propriedade')}
            columns={[t('Mês'), ...shown.map((s) => s.name), t('Total')]}
            rows={months.map((m, i) => [monthName(m, lang), ...shown.map((s) => s.counts[i]), totals[i]])}
          />
        </>
      )}
    </section>
  )
}


function RateBars<C extends ChartClient>({ clients, busy, onOpen }: { clients: C[]; busy: string; onOpen: (client: C) => void }) {
  const t = useT()
  // Maior para a menor; as sem diagnóstico no fim
  const sorted = [...clients].sort((a, b) => (b.pregnancyRate ?? -1) - (a.pregnancyRate ?? -1))
  return (
    <>
      <ul className="space-y-1">
        {sorted.map((c) => (
          <li key={c.id}>
            <button type="button" disabled={busy === c.id} onClick={() => onOpen(c)} title={c.pregnancyRate === null ? `${c.name}: ${t('sem diagnóstico')}` : `${c.name}: ${c.pregnancyRate}%`}
              className="grid w-full grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-gray-50 disabled:opacity-60">
              <span className="truncate text-sm text-gray-800">{c.name}</span>
              <span className="h-3 rounded-r bg-gray-100" aria-hidden="true">
                {c.pregnancyRate !== null && <span className="block h-3 rounded-r bg-green-700" style={{ width: `${Math.max(1, c.pregnancyRate)}%` }} />}
              </span>
              <span className="text-right text-sm font-semibold text-gray-800">{c.pregnancyRate === null ? '—' : `${c.pregnancyRate}%`}</span>
            </button>
          </li>
        ))}
      </ul>
      {sorted.some((c) => c.pregnancyRate === null) && <p className="mt-2 px-2 text-xs text-gray-500">{t('— ainda sem diagnóstico de gestação nos últimos 12 meses')}</p>}
    </>
  )
}
