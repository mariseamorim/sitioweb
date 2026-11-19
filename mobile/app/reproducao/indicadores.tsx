import { Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { all } from '@/db'
import { useLive } from '@/db/events'
import { todayISO } from '@/lib/format'
import { addMonths, buildIndicators, monthName, monthShort, type MonthLiters } from '@/lib/reproInsights'
import { buildHerdIndices, CYCLE_DAYS, type HerdIndices } from '@/lib/herdIndices'
import { listAnimals } from '@/repos/animals'
import { listReproductions } from '@/repos/reproductions'
import { Card, Muted, Screen, Stat } from '@/ui'
import { colors, font, radius, space } from '@/theme'

interface Bar { label: string; value: number | null; title: string }

const PLOT_HEIGHT = 120
const plural = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`
const compact = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)} mil` : n.toLocaleString('pt-BR'))

// Indicadores de reprodução (como src/app/reproducao/indicadores/page.tsx do site), calculados com os dados do
// aparelho: funcionam sem internet. Gráficos de colunas feitos com Views, sem biblioteca nativa.
export default function Indicadores() {
  const farmId = useFarmId()
  const { user, canAccess } = useSession()
  const showMilk = canAccess('leite')
  const data = useLive(() => {
    const today = todayISO()
    const from = `${addMonths(today.slice(0, 7), -11)}-01`
    const milk = showMilk
      ? all<MonthLiters>('SELECT substr(date, 1, 7) AS month, SUM(quantity) AS liters FROM milk WHERE farmId = ? AND substr(date, 1, 10) >= ? GROUP BY 1', [farmId, from])
      : null
    const coverages = listReproductions(farmId)
    const indicators = buildIndicators(coverages, milk, today)
    return { ...indicators, indices: buildHerdIndices(listAnimals(farmId), coverages, indicators.rate12, today) }
  }, [farmId, showMilk])

  const births = data.births.reduce((sum, m) => sum + m.count, 0)
  const diagnosed = data.pregnancy.some(m => m.diagnosed > 0)

  return (
    <Screen>
      <Muted style={{ marginBottom: space.md }}>{user?.farmName}</Muted>
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
        <Stat label="concepção em 12 meses" value={data.rate12 === null ? '—' : `${data.rate12}%`} />
        <Stat label="partos em 6 meses" value={String(births)} />
        <Stat label="a diagnosticar" value={String(data.awaiting)} />
      </View>

      <Card style={{ backgroundColor: colors.amberSoft, borderColor: colors.amber }}>
        <Text style={{ fontSize: font.sm, fontWeight: '700', color: colors.amber, marginBottom: space.xs }}>DESTAQUES</Text>
        {data.insights.map(text => <Text key={text} style={{ color: colors.text, fontSize: font.md, marginTop: space.xs }}>• {text}</Text>)}
      </Card>

      <Indices i={data.indices} />

      <Card>
        <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>Previsão de partos</Text>
        <Muted>Partos previstos por mês, pelas coberturas em aberto</Muted>
        {births === 0 ? <Muted style={{ textAlign: 'center', paddingVertical: space.xl }}>Nenhum parto previsto nos próximos 6 meses.</Muted>
          : <Columns bars={data.births.map(m => ({ label: monthShort(m.month), value: m.count, title: `${monthName(m.month)}: ${plural(m.count, 'parto previsto', 'partos previstos')}` }))} />}
      </Card>

      <Card>
        <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>Taxa de concepção</Text>
        <Muted>Por mês da cobertura: das diagnosticadas, quantas ficaram prenhas</Muted>
        {!diagnosed ? <Muted style={{ textAlign: 'center', paddingVertical: space.xl }}>Ainda não há diagnósticos de gestação nos últimos 12 meses.</Muted>
          : <Columns max={100} unit="%" bars={data.pregnancy.map(m => ({ label: monthShort(m.month), value: m.rate, title: m.rate === null ? `${monthName(m.month)}: sem diagnóstico` : `${monthName(m.month)}: ${m.rate}% (${m.pregnant} de ${m.diagnosed})` }))} />}
      </Card>

      {data.milk ? (
        <Card>
          <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>Produção de leite</Text>
          <Muted>Litros anotados por mês (o mês atual ainda está em andamento)</Muted>
          <Columns bars={data.milk.map(m => ({ label: monthShort(m.month), value: m.liters, title: `${monthName(m.month)}: ${plural(m.liters, 'litro', 'litros')}` }))} />
        </Card>
      ) : null}
    </Screen>
  )
}

/** Índices zootécnicos do rebanho, em duas colunas. Sem dado suficiente o índice fica com traço. */
function Indices({ i }: { i: HerdIndices }) {
  const months = (n: number) => `${n.toLocaleString('pt-BR')} ${n === 1 ? 'mês' : 'meses'}`
  const items = [
    { label: 'Taxa de serviço', value: i.serviceRate === null ? '—' : `${i.serviceRate}%`, detail: i.eligible ? `${i.served} de ${i.eligible} aptas em ${CYCLE_DAYS} dias` : 'nenhuma vaca apta agora' },
    { label: 'Taxa de concepção', value: i.conceptionRate === null ? '—' : `${i.conceptionRate}%`, detail: 'diagnosticadas em 12 meses' },
    { label: 'Taxa de prenhez', value: i.pregnancyRate === null ? '—' : `${i.pregnancyRate}%`, detail: 'serviço × concepção' },
    { label: 'Intervalo entre partos', value: i.iep === null ? '—' : months(i.iep), detail: i.iepCount ? `média de ${i.iepCount}` : 'falta vaca com dois partos' },
    { label: 'Idade ao 1º parto', value: i.ipp === null ? '—' : months(i.ipp), detail: i.ippCount ? `média de ${i.ippCount}` : 'falta cria ligada à mãe' },
    { label: 'Dias pós-parto', value: i.dpp === null ? '—' : `${i.dpp} dias`, detail: i.dppCount ? `${i.dppCount} paridas em aberto` : 'nenhuma parida em aberto' },
  ]
  return (
    <Card>
      <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>Índices zootécnicos</Text>
      <Muted>{i.females} {i.females === 1 ? 'fêmea' : 'fêmeas'} em idade de cobertura · {i.pregnant} com prenhez confirmada</Muted>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: space.sm }}>
        {items.map(it => (
          <View key={it.label} style={{ width: '50%', paddingVertical: space.sm, paddingRight: space.sm }}>
            <Text style={{ fontSize: font.sm, color: colors.muted }}>{it.label}</Text>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{it.value}</Text>
            <Text style={{ fontSize: 12, color: colors.muted }}>{it.detail}</Text>
          </View>
        ))}
      </View>
    </Card>
  )
}

/** Colunas de uma série só. Rótulo de valor só no maior e no último; mês sem dado fica vazio. */
function Columns({ bars, max: fixedMax, unit = '' }: { bars: Bar[]; max?: number; unit?: string }) {
  const max = fixedMax ?? Math.max(1, ...bars.map(b => b.value ?? 0))
  let best = -1
  let last = -1
  bars.forEach((b, i) => {
    if (b.value === null || b.value <= 0) return
    if (best < 0 || b.value > (bars[best].value ?? 0)) best = i
    last = i
  })
  // Com 12 meses, rótulo em meses alternados para não encostar
  const every = bars.length > 8 ? 2 : 1
  return (
    <View style={{ marginTop: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: PLOT_HEIGHT + 18, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {bars.map((b, i) => {
          const height = b.value ? Math.max(2, Math.round((b.value / max) * PLOT_HEIGHT)) : 0
          return (
            <View key={i} accessible accessibilityLabel={b.title} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              {i === best || i === last ? <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, marginBottom: 2 }} numberOfLines={1}>{compact(b.value ?? 0)}{unit}</Text> : null}
              <View style={{ width: '62%', maxWidth: 24, height, backgroundColor: colors.green, borderTopLeftRadius: Math.min(4, height), borderTopRightRadius: Math.min(4, height) }} />
            </View>
          )
        })}
      </View>
      <View style={{ flexDirection: 'row', marginTop: 4 }}>
        {bars.map((b, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: colors.muted }} numberOfLines={1}>{(bars.length - 1 - i) % every === 0 ? b.label : ''}</Text>)}
      </View>
      <View style={{ marginTop: space.sm, backgroundColor: colors.bg, borderRadius: radius.sm, padding: space.sm }}>
        <Text style={{ fontSize: font.sm, color: colors.muted }}>{best >= 0 ? `Maior: ${bars[best].title}` : 'Sem dados no período'}</Text>
      </View>
    </View>
  )
}
