import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { addDays, brDate, brMoney, brNumber, todayISO, weekday } from '@/lib/format'
import { getMilkPrice, groupByDay, listMilk } from '@/repos/milk'
import { Ionicons } from '@expo/vector-icons'
import { Card, Chips, Empty, Fab, Row, Screen, Tile, TileGrid } from '@/ui'
import { chartColors, colors, font, space } from '@/theme'
import { useT } from '@/lib/i18n'

type Period = '7' | '30' | 'mes'

/** Número curto para o selo da coluna: 4.946.000 → "4,9 mi", 46.000 → "46 mil" */
const compactLiters = (v: number) => (v >= 1e6 ? `${brNumber(v / 1e6, 1)} mi` : v >= 10000 ? `${Math.round(v / 1000)} mil` : brNumber(v, 0))

export default function Leite() {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const [period, setPeriod] = useState<Period>('7')
  const t = useT()
  const today = todayISO()
  const from = period === 'mes' ? today.slice(0, 8) + '01' : addDays(today, -(Number(period) - 1))

  const { days, total, value, price } = useLive(() => {
    const items = listMilk(farmId, from, today)
    const days = groupByDay(items)
    const total = days.reduce((s, d) => s + d.total, 0)
    const value = days.reduce((s, d) => s + d.value, 0)
    return { days, total, value, price: getMilkPrice(farmId) }
  }, [farmId, from, today])

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Chips options={[{ value: '7', label: t('Últimos 7 dias') }, { value: '30', label: t('Últimos 30 dias') }, { value: 'mes', label: t('Este mês') }]} value={period} onChange={setPeriod} />
        <View style={{ height: space.md }} />
        <TileGrid>
          <Tile accent="blue" label={t('Total no período')} value={`${brNumber(total)} L`} detail={t('Média de {n} L por dia', { n: brNumber(days.length ? total / days.length : 0) })} />
          <Tile accent="green" label={t('Valor estimado')} value={brMoney(value)} detail={price ? t('{price} por litro', { price: brMoney(price) }) : t('Defina o preço do litro no site')} />
        </TileGrid>
        {days.length ? (
          <Card>
            <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md, marginBottom: space.sm }}>{t('Produção diária (L)')}</Text>
            <DayBars from={from} to={today} days={days} />
          </Card>
        ) : null}
        {days.length === 0 ? <Empty title={t('Nenhum leite anotado no período')} text={canEdit ? t('Toque em “Anotar leite” para começar.') : undefined} /> : (
          <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.lg, marginBottom: space.sm }}>{t('Coletas diárias')}</Text>
        )}
        {days.map(d => (
          <Card key={d.day} style={{ paddingVertical: space.sm }}>
            <Row
              left={<View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blueSoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="water" size={20} color={colors.blue} /></View>}
              title={`${brDate(d.day)}  ${t(weekday(d.day))}`}
              detail={d.cows ? t('{n} vacas ordenhadas', { n: d.cows }) : d.items.length > 1 ? t('{n} lançamentos', { n: d.items.length }) : undefined}
              right={<Text style={{ fontWeight: '700', fontSize: 18, color: colors.green }}>{brNumber(d.total)} L</Text>}
            />
            {d.items.map(m => (
              <Row key={m.id} title={m.animalName ? `${t('Vaca')} ${m.animalName}` : t('Total do dia')} detail={m.observations ?? undefined}
                right={<Text style={{ color: colors.text }}>{brNumber(m.quantity)} L</Text>} onPress={canEdit ? () => router.push(`/leite/${m.id}`) : undefined} />
            ))}
          </Card>
        ))}
      </Screen>
      {canEdit ? <Fab label={t('+ Anotar leite')} onPress={() => router.push('/leite/novo')} /> : null}
    </View>
  )
}

const BAR_AREA = 120

/** Colunas do leite de cada dia do período (dia sem anotação fica vazio). Valor do maior dia escrito em cima. */
function DayBars({ from, to, days }: { from: string; to: string; days: { day: string; total: number }[] }) {
  const all: string[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) all.push(d)
  const byDay = new Map(days.map(d => [d.day, d.total]))
  const max = Math.max(1, ...days.map(d => d.total))
  // Rótulo a cada n dias para não encostar (7 dias: todos; 30 dias: de 5 em 5), contando de hoje para trás
  const every = all.length > 10 ? 5 : 1
  const best = days.reduce((a, b) => (b.total > a.total ? b : a), days[0])
  return (
    <View accessible accessibilityLabel={days.map(d => `${brDate(d.day)}: ${brNumber(d.total)} L`).join(', ')}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_AREA + 18, gap: all.length > 10 ? 2 : 6 }}>
        {all.map((d, i) => {
          const v = byDay.get(d) ?? 0
          // Uma cor por coluna (como no site); com 30 dias, uma cor só
          const color = all.length > 14 ? '#0d9488' : chartColors[i % chartColors.length]
          return (
            <View key={d} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
              {best && d === best.day ? (
                <View style={{ backgroundColor: color, borderRadius: 5, paddingHorizontal: 4, marginBottom: 3, maxWidth: 90 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#ffffff' }} numberOfLines={1}>{compactLiters(v)}</Text>
                </View>
              ) : null}
              <View style={{ width: '100%', height: Math.max(v ? 3 : 0, (v / max) * BAR_AREA), backgroundColor: color, borderTopLeftRadius: 5, borderTopRightRadius: 5 }} />
            </View>
          )
        })}
      </View>
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 4, gap: all.length > 10 ? 2 : 6 }}>
        {all.map((d, i) => (
          <Text key={d} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: colors.muted }} numberOfLines={1}>
            {(all.length - 1 - i) % every === 0 ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : ''}
          </Text>
        ))}
      </View>
    </View>
  )
}
