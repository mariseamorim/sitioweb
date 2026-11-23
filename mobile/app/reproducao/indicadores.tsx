import { Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { all } from '@/db'
import { useLive } from '@/db/events'
import { todayISO } from '@/lib/format'
import { addMonths, buildIndicators, monthName, monthShort, type MonthLiters } from '@/lib/reproInsights'
import { buildHerdIndices, CYCLE_DAYS, type HerdIndices } from '@/lib/herdIndices'
import { conceptionBy, type ConceptionBy, type GroupRate } from '@/lib/conceptionBy'
import { listAnimals } from '@/repos/animals'
import { listReproductions } from '@/repos/reproductions'
import { Card, Muted, Screen, Tile, TileGrid, type Accent } from '@/ui'
import { colors, font, radius, space } from '@/theme'
import { getLang, tr, useLocale, useT } from '@/lib/i18n'

interface Bar { label: string; value: number | null; title: string }

const PLOT_HEIGHT = 120
const locale = () => (getLang() === 'es' ? 'es-PY' : 'pt-BR')
const plural = (n: number, one: string, many: string) => `${n.toLocaleString(locale())} ${tr(n === 1 ? one : many)}`
const compact = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)} ${tr('mil')}` : n.toLocaleString(locale()))

// Indicadores de reprodução (como src/app/reproducao/indicadores/page.tsx do site), calculados com os dados do
// aparelho: funcionam sem internet. Gráficos de colunas feitos com Views, sem biblioteca nativa.
export default function Indicadores() {
  const farmId = useFarmId()
  const { user, canAccess } = useSession()
  const showMilk = canAccess('leite')
  const t = useT()
  const data = useLive(() => {
    const today = todayISO()
    const from = `${addMonths(today.slice(0, 7), -11)}-01`
    const milk = showMilk
      ? all<MonthLiters>('SELECT substr(date, 1, 7) AS month, SUM(quantity) AS liters FROM milk WHERE farmId = ? AND substr(date, 1, 10) >= ? GROUP BY 1', [farmId, from])
      : null
    const coverages = listReproductions(farmId)
    const indicators = buildIndicators(coverages, milk, today)
    return { ...indicators, indices: buildHerdIndices(listAnimals(farmId), coverages, indicators.rate12, today), by: conceptionBy(coverages, from) }
  }, [farmId, showMilk])

  const births = data.births.reduce((sum, m) => sum + m.count, 0)
  const diagnosed = data.pregnancy.some(m => m.diagnosed > 0)

  return (
    <Screen>
      <Muted style={{ marginBottom: space.md }}>{user?.farmName}</Muted>
      <TileGrid>
        <Tile accent="green" label={t('concepção em 12 meses')} value={data.rate12 === null ? '—' : `${data.rate12}%`} />
        <Tile accent="blue" label={t('partos em 6 meses')} value={String(births)} />
        <Tile accent={data.awaiting > 0 ? 'amber' : 'teal'} label={t('a diagnosticar')} value={String(data.awaiting)} />
      </TileGrid>

      <Card style={{ backgroundColor: colors.amberSoft, borderColor: colors.amber }}>
        <Text style={{ fontSize: font.sm, fontWeight: '700', color: colors.amber, marginBottom: space.xs }}>{t('DESTAQUES')}</Text>
        {data.insights.map(text => <Text key={text} style={{ color: colors.text, fontSize: font.md, marginTop: space.xs }}>• {text}</Text>)}
      </Card>

      <Indices i={data.indices} />

      <ConceptionByCard by={data.by} average={data.rate12} />

      <Card>
        <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{t('Previsão de partos')}</Text>
        <Muted>{t('Partos previstos por mês, pelas coberturas em aberto')}</Muted>
        {births === 0 ? <Muted style={{ textAlign: 'center', paddingVertical: space.xl }}>{t('Nenhum parto previsto nos próximos 6 meses.')}</Muted>
          : <Columns bars={data.births.map(m => ({ label: monthShort(m.month), value: m.count, title: `${monthName(m.month)}: ${plural(m.count, 'parto previsto', 'partos previstos')}` }))} />}
      </Card>

      <Card>
        <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{t('Taxa de concepção')}</Text>
        <Muted>{t('Por mês da cobertura: das diagnosticadas, quantas ficaram prenhas')}</Muted>
        {!diagnosed ? <Muted style={{ textAlign: 'center', paddingVertical: space.xl }}>{t('Ainda não há diagnósticos de gestação nos últimos 12 meses.')}</Muted>
          : <Columns max={100} unit="%" bars={data.pregnancy.map(m => ({ label: monthShort(m.month), value: m.rate, title: m.rate === null ? `${monthName(m.month)}: ${t('sem diagnóstico')}` : `${monthName(m.month)}: ${m.rate}% (${t('{a} de {b}', { a: m.pregnant, b: m.diagnosed })})` }))} />}
      </Card>

      {data.milk ? (
        <Card>
          <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{t('Produção de leite')}</Text>
          <Muted>{t('Litros anotados por mês (o mês atual ainda está em andamento)')}</Muted>
          <Columns bars={data.milk.map(m => ({ label: monthShort(m.month), value: m.liters, title: `${monthName(m.month)}: ${plural(m.liters, 'litro', 'litros')}` }))} />
        </Card>
      ) : null}
    </Screen>
  )
}

/** Índices zootécnicos do rebanho, em duas colunas. Sem dado suficiente o índice fica com traço. */
function Indices({ i }: { i: HerdIndices }) {
  const t = useT()
  const loc = useLocale()
  const months = (n: number) => `${n.toLocaleString(loc)} ${t(n === 1 ? 'mês' : 'meses')}`
  const items = [
    { accent: 'green' as Accent, label: t('Taxa de serviço'), value: i.serviceRate === null ? '—' : `${i.serviceRate}%`, detail: i.eligible ? t('{a} de {b} aptas em {d} dias', { a: i.served, b: i.eligible, d: CYCLE_DAYS }) : t('nenhuma vaca apta agora') },
    { accent: 'teal' as Accent, label: t('Taxa de concepção'), value: i.conceptionRate === null ? '—' : `${i.conceptionRate}%`, detail: t('diagnosticadas em 12 meses') },
    { accent: 'blue' as Accent, label: t('Taxa de prenhez'), value: i.pregnancyRate === null ? '—' : `${i.pregnancyRate}%`, detail: t('serviço × concepção') },
    { accent: 'amber' as Accent, label: t('Intervalo entre partos'), value: i.iep === null ? '—' : months(i.iep), detail: i.iepCount ? t('média de {n}', { n: i.iepCount }) : t('falta vaca com dois partos') },
    { accent: 'green' as Accent, label: t('Idade ao 1º parto'), value: i.ipp === null ? '—' : months(i.ipp), detail: i.ippCount ? t('média de {n}', { n: i.ippCount }) : t('falta cria ligada à mãe') },
    { accent: 'blue' as Accent, label: t('Dias pós-parto'), value: i.dpp === null ? '—' : t('{n} dias', { n: i.dpp }), detail: i.dppCount ? t('{n} paridas em aberto', { n: i.dppCount }) : t('nenhuma parida em aberto') },
  ]
  return (
    <Card>
      <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{t('Índices zootécnicos')}</Text>
      <Muted>{i.females} {t(i.females === 1 ? 'fêmea' : 'fêmeas')} {t('em idade de cobertura')} · {i.pregnant} {t('com prenhez confirmada')}</Muted>
      {/* Um cartão colorido por índice, dois por linha */}
      <View style={{ height: space.sm }} />
      <TileGrid>
        {items.map(it => <Tile key={it.label} accent={it.accent} label={it.label} value={it.value} detail={it.detail} />)}
      </TileGrid>
    </Card>
  )
}

/** Colunas de uma série só. Rótulo de valor só no maior e no último; mês sem dado fica vazio. */
function Columns({ bars, max: fixedMax, unit = '' }: { bars: Bar[]; max?: number; unit?: string }) {
  const t = useT()
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
        <Text style={{ fontSize: font.sm, color: colors.muted }}>{best >= 0 ? `${t('Maior:')} ${bars[best].title}` : t('Sem dados no período')}</Text>
      </View>
    </View>
  )
}

/** Concepção por touro e por inseminador (como no site), com a média da propriedade como referência */
function ConceptionByCard({ by, average }: { by: ConceptionBy; average: number | null }) {
  const t = useT()
  return (
    <Card>
      <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{t('Concepção por touro e inseminador')}</Text>
      {!by.bulls.length && !by.inseminators.length ? <Muted>{t('Anote o touro e o inseminador nas coberturas para comparar quais dão mais prenhez.')}</Muted> : (
        <>
          <Muted>{t('Coberturas dos últimos 12 meses com diagnóstico: quantas ficaram prenhas.')}{average !== null ? ` ${t('Média da propriedade: {rate}%.', { rate: average })}` : ''}</Muted>
          <GroupList title={t('Por touro')} rows={by.bulls} average={average} empty={t('Nenhum touro anotado nas coberturas.')} />
          <GroupList title={t('Por inseminador')} rows={by.inseminators} average={average} empty={t('Nenhum inseminador anotado nas inseminações.')} />
          {by.withoutBull > 0 ? <Muted style={{ marginTop: space.sm }}>{t(by.withoutBull === 1 ? '1 cobertura diagnosticada sem touro anotado ficou de fora.' : '{n} coberturas diagnosticadas sem touro anotado ficaram de fora.', { n: by.withoutBull })}</Muted> : null}
        </>
      )}
    </Card>
  )
}

function GroupList({ title, rows, average, empty }: { title: string; rows: GroupRate[]; average: number | null; empty: string }) {
  const t = useT()
  return (
    <View style={{ marginTop: space.md }}>
      <Text style={{ fontSize: font.sm, fontWeight: '800', color: colors.muted, textTransform: 'uppercase', marginBottom: space.xs }}>{title}</Text>
      {!rows.length ? <Muted>{empty}</Muted> : rows.map(r => {
        const above = r.rate !== null && average !== null && r.rate >= average
        const color = r.rate === null || r.fewData ? colors.muted : above ? colors.green : colors.amber
        return (
          <View key={r.label} style={{ marginTop: space.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: space.sm }}>
              <Text style={{ flex: 1, color: colors.text, fontWeight: '600' }} numberOfLines={1}>{r.label}{r.breed ? <Text style={{ color: colors.muted, fontWeight: '400' }}> · {r.breed}</Text> : null}</Text>
              <Text style={{ fontSize: font.lg, fontWeight: '800', color }}>{r.rate === null ? '—' : `${r.rate}%`}</Text>
            </View>
            <View style={{ height: 10, borderRadius: radius.md, backgroundColor: colors.border, marginTop: 4 }}>
              <View style={{ height: 10, borderRadius: radius.md, width: `${r.rate ?? 0}%`, backgroundColor: color }} />
              {average !== null ? <View style={{ position: 'absolute', top: -4, left: `${average}%`, width: 2, height: 18, backgroundColor: colors.text }} /> : null}
            </View>
            <Muted>
              {t('{pregnant} prenhas de {diagnosed} diagnosticadas', { pregnant: r.pregnant, diagnosed: r.diagnosed })}
              {r.awaiting ? ` · ${t(r.awaiting === 1 ? '1 a diagnosticar' : '{n} a diagnosticar', { n: r.awaiting })}` : ''}
              {r.fewData ? ` · ${t('poucos dados')}` : ''}
            </Muted>
          </View>
        )
      })}
    </View>
  )
}
