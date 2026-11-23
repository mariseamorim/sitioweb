'use client'

// Indicadores de reprodução da propriedade aberta: destaques em texto, partos previstos por mês, taxa de prenhez
// por mês da cobertura e leite por mês. Para o produtor e para o veterinário que atende a propriedade.
import { useEffect, useState } from 'react'
import { BackLink } from '@/components/BackLink'
import { ChartTable, ColumnChart, LineChart } from '@/components/MonthCharts'
import { useUser } from '@/contexts/UserContext'
import { cachedGet, HttpError } from '@/lib/offlineData'
import { fillInsight, monthName, monthShort, type Indicators } from '@/lib/reproInsights'
import { useLang, useLocale, useT } from '@/lib/i18n'
import { CYCLE_DAYS, WAITING_DAYS, type HerdIndices } from '@/lib/herdIndices'
import { StatTile, type Accent } from '@/components/StatTile'
import type { ConceptionBy, GroupRate } from '@/lib/conceptionBy'

const card = 'bg-white rounded-xl border border-gray-200 p-4'
const INDEX_ACCENTS: Accent[] = ['blue', 'green', 'teal', 'teal', 'blue', 'green']

export default function IndicadoresPage() {
  const { user } = useUser()
  const t = useT()
  const lang = useLang()
  const locale = useLocale()
  const month = (m: string) => monthName(m, lang)
  const short = (m: string) => monthShort(m, lang)
  // n já formatado no idioma; o modelo escolhe singular ou plural
  const count = (n: number, one: string, many: string) => t(n === 1 ? one : many, { n: n.toLocaleString(locale) })
  const [data, setData] = useState<(Indicators & { indices?: HerdIndices; conceptionBy?: ConceptionBy }) | null>(null)
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const farmId = user?.farmId

  // Com cópia no aparelho: sem internet (ou com sinal fraco) mostra os indicadores da última vez que carregaram
  useEffect(() => {
    if (!farmId) return
    cachedGet<Indicators & { indices?: HerdIndices; conceptionBy?: ConceptionBy }>(`cache_repro_indicadores_${farmId}`, '/api/reproducao/indicadores')
      .then((r) => { setData(r.data); setFromCache(r.fromCache) })
      .catch((err) => setError(err instanceof HttpError ? err.message : 'Sem internet, e este aparelho ainda não guardou os indicadores desta propriedade. Abra esta tela uma vez com conexão.'))
  }, [farmId])
  // Destaques: com o modelo e as variáveis (respostas novas) dá para traduzir; cópia antiga do aparelho só tem o texto pronto
  const insights = data ? (data.insightItems ? data.insightItems.map((i) => fillInsight(i, month, t(i.text))) : data.insights) : []

  const births = data?.births.reduce((sum, m) => sum + m.count, 0) ?? 0
  const diagnosed = data?.pregnancy.some((m) => m.diagnosed > 0)

  return (
    <div className="max-w-4xl">
      <BackLink href="/reproducao" className="mb-2 -ml-2" />
      <h1 className="text-2xl font-bold text-gray-800">{t('Indicadores de reprodução')}</h1>
      <p className="text-gray-500 mb-5">{user?.farmName}</p>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{t(error)}</p>}
      {fromCache && <p role="status" className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">{t('Sem internet ou sinal fraco: mostrando os indicadores da última vez que carregaram neste aparelho.')}</p>}
      {!data && !error && <p className="py-12 text-center text-gray-500">{t('Carregando…')}</p>}

      {data && (
        <>
          {/* Números principais em cartões coloridos */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <StatTile accent="green" label={t('concepção em 12 meses')} value={data.rate12 === null ? '—' : `${data.rate12}%`} />
            <StatTile accent="blue" label={t('partos em 6 meses')} value={births} />
            <StatTile accent={data.awaiting > 0 ? 'amber' : 'teal'} label={t('a diagnosticar')} value={data.awaiting} />
          </div>

          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4" aria-label={t('Destaques')}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">{t('Destaques')}</h2>
            <ul className="mt-2 flex flex-col gap-1.5 text-gray-900">
              {insights.map((text) => <li key={text} className="flex gap-2"><span aria-hidden className="text-amber-700">•</span><span>{text}</span></li>)}
            </ul>
          </section>

          {data.indices && <Indices i={data.indices} />}

          {data.conceptionBy && <ConceptionByCard by={data.conceptionBy} average={data.rate12} />}

          <div className="grid gap-4 md:grid-cols-2">
            <section className={card}>
              <h2 className="font-semibold text-gray-900">{t('Previsão de partos')}</h2>
              <p className="text-sm text-gray-500">{t('Partos previstos por mês, pelas coberturas em aberto')}</p>
              {births === 0 ? <p className="py-10 text-center text-gray-500">{t('Nenhum parto previsto nos próximos 6 meses.')}</p> : (
                <>
                  <ColumnChart name={t('Partos previstos por mês nos próximos 6 meses')} points={data.births.map((m) => ({ label: short(m.month), value: m.count, title: `${month(m.month)}: ${count(m.count, '{n} parto previsto', '{n} partos previstos')}` }))} />
                  <ChartTable caption={t('Partos previstos por mês')} columns={[t('Mês'), t('Partos previstos')]} rows={data.births.map((m) => [month(m.month), m.count])} />
                </>
              )}
            </section>

            <section className={card}>
              <h2 className="font-semibold text-gray-900">{t('Taxa de concepção')}</h2>
              <p className="text-sm text-gray-500">{t('Por mês da cobertura: das diagnosticadas, quantas ficaram prenhas')}</p>
              {!diagnosed ? <p className="py-10 text-center text-gray-500">{t('Ainda não há diagnósticos de gestação nos últimos 12 meses.')}</p> : (
                <>
                  <LineChart name={t('Taxa de concepção por mês da cobertura nos últimos 12 meses')} unit="%" max={100}
                    points={data.pregnancy.map((m) => ({ label: short(m.month), value: m.rate, title: m.rate === null ? `${month(m.month)}: ${t('sem diagnóstico')}` : `${month(m.month)}: ${t('{rate}% ({pregnant} de {diagnosed})', { rate: m.rate, pregnant: m.pregnant, diagnosed: m.diagnosed })}` }))} />
                  <ChartTable caption={t('Taxa de concepção por mês da cobertura')} columns={[t('Mês'), t('Diagnosticadas'), t('Prenhas'), t('Taxa')]} rows={data.pregnancy.map((m) => [month(m.month), m.diagnosed, m.pregnant, m.rate === null ? '—' : `${m.rate}%`])} />
                </>
              )}
            </section>

            {data.milk && (
              <section className={`${card} md:col-span-2`}>
                <h2 className="font-semibold text-gray-900">{t('Produção de leite')}</h2>
                <p className="text-sm text-gray-500">{t('Litros anotados por mês (o mês atual ainda está em andamento)')}</p>
                <div className="mx-auto max-w-xl">
                  <ColumnChart name={t('Litros de leite por mês nos últimos 12 meses')} points={data.milk.map((m) => ({ label: short(m.month), value: m.liters, title: `${month(m.month)}: ${count(m.liters, '{n} litro', '{n} litros')}` }))} />
                </div>
                <ChartTable caption={t('Litros de leite por mês')} columns={[t('Mês'), t('Litros')]} rows={data.milk.map((m) => [month(m.month), m.liters.toLocaleString(locale)])} />
              </section>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/** Índices zootécnicos do rebanho. Sem dado suficiente o índice fica com traço e a linha de baixo diz o que falta. */
function Indices({ i }: { i: HerdIndices }) {
  const t = useT()
  const locale = useLocale()
  const months = (n: number) => t(n === 1 ? '{n} mês' : '{n} meses', { n: n.toLocaleString(locale) })
  const items: { label: string; value: string; detail: string }[] = [
    { label: t('Taxa de serviço'), value: i.serviceRate === null ? '—' : `${i.serviceRate}%`, detail: i.eligible ? t('{served} de {eligible} vacas aptas cobertas em {days} dias', { served: i.served, eligible: i.eligible, days: CYCLE_DAYS }) : t('Nenhuma vaca apta a cobrir agora') },
    { label: t('Taxa de concepção'), value: i.conceptionRate === null ? '—' : `${i.conceptionRate}%`, detail: t('Das coberturas diagnosticadas em 12 meses') },
    { label: t('Taxa de prenhez'), value: i.pregnancyRate === null ? '—' : `${i.pregnancyRate}%`, detail: t('Serviço × concepção, a cada {days} dias', { days: CYCLE_DAYS }) },
    { label: t('Intervalo entre partos (IEP)'), value: i.iep === null ? '—' : months(i.iep), detail: i.iepCount ? t(i.iepCount === 1 ? 'Média de {n} intervalo' : 'Média de {n} intervalos', { n: i.iepCount }) : t('Precisa de vaca com dois partos anotados') },
    { label: t('Idade ao primeiro parto (IPP)'), value: i.ipp === null ? '—' : months(i.ipp), detail: i.ippCount ? t(i.ippCount === 1 ? 'Média de {n} vaca' : 'Média de {n} vacas', { n: i.ippCount }) : t('Precisa de cria ligada à mãe no cadastro') },
    { label: t('Dias pós-parto (DPP)'), value: i.dpp === null ? '—' : t('{n} dias', { n: i.dpp }), detail: i.dppCount ? t(i.dppCount === 1 ? 'Média de {n} vaca parida ainda sem prenhez confirmada' : 'Média de {n} vacas paridas ainda sem prenhez confirmada', { n: i.dppCount }) : t('Nenhuma vaca parida em aberto') },
  ]
  return (
    <section className={`${card} mb-4`} aria-label={t('Índices zootécnicos')}>
      <h2 className="font-semibold text-gray-900">{t('Índices zootécnicos')}</h2>
      <p className="text-sm text-gray-500">{t(i.females === 1 ? '{n} fêmea em idade de cobertura' : '{n} fêmeas em idade de cobertura', { n: i.females })} · {t('{n} com prenhez confirmada', { n: i.pregnant })} · {t('espera de {days} dias depois do parto', { days: WAITING_DAYS })}</p>
      {/* Um cartão colorido por índice; as cores só alternam para separar os cartões */}
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        {items.map((it, n) => (
          <StatTile key={it.label} accent={INDEX_ACCENTS[n % INDEX_ACCENTS.length]} label={it.label} value={it.value} detail={it.detail} />
        ))}
      </div>
    </section>
  )
}

/** Concepção por touro e por inseminador, com a média da propriedade como referência */
function ConceptionByCard({ by, average }: { by: ConceptionBy; average: number | null }) {
  const t = useT()
  if (!by.bulls.length && !by.inseminators.length) {
    return (
      <section className={`${card} mb-4`} aria-label={t('Concepção por touro e inseminador')}>
        <h2 className="font-semibold text-gray-900">{t('Concepção por touro e inseminador')}</h2>
        <p className="mt-1 text-sm text-gray-500">{t('Anote o touro e o inseminador nas coberturas para comparar quais dão mais prenhez.')}</p>
      </section>
    )
  }
  return (
    <section className={`${card} mb-4`} aria-label={t('Concepção por touro e inseminador')}>
      <h2 className="font-semibold text-gray-900">{t('Concepção por touro e inseminador')}</h2>
      <p className="text-sm text-gray-500">
        {t('Coberturas dos últimos 12 meses com diagnóstico: quantas ficaram prenhas.')}
        {average !== null && ` ${t('Média da propriedade: {rate}%.', { rate: average })}`}
      </p>
      <div className="mt-3 grid gap-5 md:grid-cols-2">
        <GroupList title={t('Por touro')} rows={by.bulls} average={average} empty={t('Nenhum touro anotado nas coberturas.')} />
        <GroupList title={t('Por inseminador')} rows={by.inseminators} average={average} empty={t('Nenhum inseminador anotado nas inseminações.')} />
      </div>
      {by.withoutBull > 0 && <p className="mt-3 text-xs text-gray-500">{t(by.withoutBull === 1 ? '1 cobertura diagnosticada sem touro anotado ficou de fora.' : '{n} coberturas diagnosticadas sem touro anotado ficaram de fora.', { n: by.withoutBull })}</p>}
    </section>
  )
}

function GroupList({ title, rows, average, empty }: { title: string; rows: GroupRate[]; average: number | null; empty: string }) {
  const t = useT()
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-600">{title}</h3>
      {!rows.length ? <p className="text-sm text-gray-500">{empty}</p> : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const above = r.rate !== null && average !== null && r.rate >= average
            return (
              <li key={r.label}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0 truncate font-medium text-gray-900">{r.label}{r.breed ? <span className="font-normal text-gray-500"> · {r.breed}</span> : null}</span>
                  <span className={`shrink-0 text-lg font-bold tabular-nums ${r.rate === null ? 'text-gray-400' : r.fewData ? 'text-gray-600' : above ? 'text-green-700' : 'text-amber-700'}`}>{r.rate === null ? '—' : `${r.rate}%`}</span>
                </div>
                {/* Barra da taxa; o traço marca a média da propriedade */}
                <div className="relative mt-1 h-2.5 rounded-full bg-gray-100" aria-hidden="true">
                  <div className={`h-2.5 rounded-full ${r.fewData ? 'bg-gray-400' : above ? 'bg-green-600' : 'bg-amber-500'}`} style={{ width: `${r.rate ?? 0}%` }} />
                  {average !== null && <div className="absolute -top-1 w-0.5 bg-gray-700" style={{ left: `${average}%`, height: '18px' }} />}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {t('{pregnant} prenhas de {diagnosed} diagnosticadas', { pregnant: r.pregnant, diagnosed: r.diagnosed })}
                  {r.awaiting ? ` · ${t(r.awaiting === 1 ? '1 a diagnosticar' : '{n} a diagnosticar', { n: r.awaiting })}` : ''}
                  {r.fewData ? ` · ${t('poucos dados')}` : ''}
                </p>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
