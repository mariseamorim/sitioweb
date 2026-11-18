'use client'

// Indicadores de reprodução da propriedade aberta: destaques em texto, partos previstos por mês, taxa de prenhez
// por mês da cobertura e leite por mês. Para o produtor e para o veterinário que atende a propriedade.
import { useEffect, useState } from 'react'
import { BackLink } from '@/components/BackLink'
import { ChartTable, ColumnChart, LineChart } from '@/components/MonthCharts'
import { useUser } from '@/contexts/UserContext'
import { cachedGet, HttpError } from '@/lib/offlineData'
import { monthName, monthShort, type Indicators } from '@/lib/reproInsights'
import { CYCLE_DAYS, WAITING_DAYS, type HerdIndices } from '@/lib/herdIndices'

const card = 'bg-white rounded-xl border border-gray-200 p-4'
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`

export default function IndicadoresPage() {
  const { user } = useUser()
  const [data, setData] = useState<(Indicators & { indices?: HerdIndices }) | null>(null)
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const farmId = user?.farmId

  // Com cópia no aparelho: sem internet (ou com sinal fraco) mostra os indicadores da última vez que carregaram
  useEffect(() => {
    if (!farmId) return
    cachedGet<Indicators & { indices?: HerdIndices }>(`cache_repro_indicadores_${farmId}`, '/api/reproducao/indicadores')
      .then((r) => { setData(r.data); setFromCache(r.fromCache) })
      .catch((err) => setError(err instanceof HttpError ? err.message : 'Sem internet, e este aparelho ainda não guardou os indicadores desta propriedade. Abra esta tela uma vez com conexão.'))
  }, [farmId])

  const births = data?.births.reduce((sum, m) => sum + m.count, 0) ?? 0
  const diagnosed = data?.pregnancy.some((m) => m.diagnosed > 0)

  return (
    <div className="max-w-4xl">
      <BackLink href="/reproducao" className="mb-2 -ml-2" />
      <h1 className="text-2xl font-bold text-gray-800">Indicadores de reprodução</h1>
      <p className="text-gray-500 mb-5">{user?.farmName}</p>
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {fromCache && <p role="status" className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">Sem internet ou sinal fraco: mostrando os indicadores da última vez que carregaram neste aparelho.</p>}
      {!data && !error && <p className="py-12 text-center text-gray-500">Carregando…</p>}

      {data && (
        <>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className={card}><p className="text-2xl font-bold text-gray-800">{data.rate12 === null ? '—' : `${data.rate12}%`}</p><p className="text-sm text-gray-500">concepção em 12 meses</p></div>
            <div className={card}><p className="text-2xl font-bold text-gray-800">{births}</p><p className="text-sm text-gray-500">partos em 6 meses</p></div>
            <div className={card}><p className="text-2xl font-bold text-gray-800">{data.awaiting}</p><p className="text-sm text-gray-500">a diagnosticar</p></div>
          </div>

          <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 mb-4" aria-label="Destaques">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-900">Destaques</h2>
            <ul className="mt-2 flex flex-col gap-1.5 text-gray-900">
              {data.insights.map((text) => <li key={text} className="flex gap-2"><span aria-hidden className="text-amber-700">•</span><span>{text}</span></li>)}
            </ul>
          </section>

          {data.indices && <Indices i={data.indices} />}

          <div className="grid gap-4 md:grid-cols-2">
            <section className={card}>
              <h2 className="font-semibold text-gray-900">Previsão de partos</h2>
              <p className="text-sm text-gray-500">Partos previstos por mês, pelas coberturas em aberto</p>
              {births === 0 ? <p className="py-10 text-center text-gray-500">Nenhum parto previsto nos próximos 6 meses.</p> : (
                <>
                  <ColumnChart name="Partos previstos por mês nos próximos 6 meses" points={data.births.map((m) => ({ label: monthShort(m.month), value: m.count, title: `${monthName(m.month)}: ${plural(m.count, 'parto previsto', 'partos previstos')}` }))} />
                  <ChartTable caption="Partos previstos por mês" columns={['Mês', 'Partos previstos']} rows={data.births.map((m) => [monthName(m.month), m.count])} />
                </>
              )}
            </section>

            <section className={card}>
              <h2 className="font-semibold text-gray-900">Taxa de concepção</h2>
              <p className="text-sm text-gray-500">Por mês da cobertura: das diagnosticadas, quantas ficaram prenhas</p>
              {!diagnosed ? <p className="py-10 text-center text-gray-500">Ainda não há diagnósticos de gestação nos últimos 12 meses.</p> : (
                <>
                  <LineChart name="Taxa de concepção por mês da cobertura nos últimos 12 meses" unit="%" max={100}
                    points={data.pregnancy.map((m) => ({ label: monthShort(m.month), value: m.rate, title: m.rate === null ? `${monthName(m.month)}: sem diagnóstico` : `${monthName(m.month)}: ${m.rate}% (${m.pregnant} de ${m.diagnosed})` }))} />
                  <ChartTable caption="Taxa de concepção por mês da cobertura" columns={['Mês', 'Diagnosticadas', 'Prenhas', 'Taxa']} rows={data.pregnancy.map((m) => [monthName(m.month), m.diagnosed, m.pregnant, m.rate === null ? '—' : `${m.rate}%`])} />
                </>
              )}
            </section>

            {data.milk && (
              <section className={`${card} md:col-span-2`}>
                <h2 className="font-semibold text-gray-900">Produção de leite</h2>
                <p className="text-sm text-gray-500">Litros anotados por mês (o mês atual ainda está em andamento)</p>
                <div className="mx-auto max-w-xl">
                  <ColumnChart name="Litros de leite por mês nos últimos 12 meses" points={data.milk.map((m) => ({ label: monthShort(m.month), value: m.liters, title: `${monthName(m.month)}: ${plural(m.liters, 'litro', 'litros')}` }))} />
                </div>
                <ChartTable caption="Litros de leite por mês" columns={['Mês', 'Litros']} rows={data.milk.map((m) => [monthName(m.month), m.liters.toLocaleString('pt-BR')])} />
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
  const months = (n: number) => `${n.toLocaleString('pt-BR')} ${n === 1 ? 'mês' : 'meses'}`
  const items: { label: string; value: string; detail: string }[] = [
    { label: 'Taxa de serviço', value: i.serviceRate === null ? '—' : `${i.serviceRate}%`, detail: i.eligible ? `${i.served} de ${i.eligible} vacas aptas cobertas em ${CYCLE_DAYS} dias` : 'Nenhuma vaca apta a cobrir agora' },
    { label: 'Taxa de concepção', value: i.conceptionRate === null ? '—' : `${i.conceptionRate}%`, detail: 'Das coberturas diagnosticadas em 12 meses' },
    { label: 'Taxa de prenhez', value: i.pregnancyRate === null ? '—' : `${i.pregnancyRate}%`, detail: `Serviço × concepção, a cada ${CYCLE_DAYS} dias` },
    { label: 'Intervalo entre partos (IEP)', value: i.iep === null ? '—' : months(i.iep), detail: i.iepCount ? `Média de ${i.iepCount} ${i.iepCount === 1 ? 'intervalo' : 'intervalos'}` : 'Precisa de vaca com dois partos anotados' },
    { label: 'Idade ao primeiro parto (IPP)', value: i.ipp === null ? '—' : months(i.ipp), detail: i.ippCount ? `Média de ${i.ippCount} ${i.ippCount === 1 ? 'vaca' : 'vacas'}` : 'Precisa de cria ligada à mãe no cadastro' },
    { label: 'Dias pós-parto (DPP)', value: i.dpp === null ? '—' : `${i.dpp} dias`, detail: i.dppCount ? `Média de ${i.dppCount} ${i.dppCount === 1 ? 'vaca parida' : 'vacas paridas'} ainda sem prenhez confirmada` : 'Nenhuma vaca parida em aberto' },
  ]
  return (
    <section className={`${card} mb-4`} aria-label="Índices zootécnicos">
      <h2 className="font-semibold text-gray-900">Índices zootécnicos</h2>
      <p className="text-sm text-gray-500">{i.females} {i.females === 1 ? 'fêmea' : 'fêmeas'} em idade de cobertura · {i.pregnant} com prenhez confirmada · espera de {WAITING_DAYS} dias depois do parto</p>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-4 md:grid-cols-3">
        {items.map((it) => (
          <div key={it.label}>
            <dt className="text-sm text-gray-600">{it.label}</dt>
            <dd className="text-2xl font-bold text-gray-900">{it.value}</dd>
            <dd className="text-xs text-gray-500">{it.detail}</dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
