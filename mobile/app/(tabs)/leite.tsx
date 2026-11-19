import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { addDays, brDate, brMoney, brNumber, todayISO, weekday } from '@/lib/format'
import { getMilkPrice, groupByDay, listMilk } from '@/repos/milk'
import { Card, Chips, Empty, Fab, Muted, Row, Screen, Stat } from '@/ui'
import { colors, space } from '@/theme'
import { useT } from '@/lib/i18n'

type Period = '7' | '30' | 'mes'

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
        <View style={{ flexDirection: 'row', gap: space.md, marginVertical: space.md }}>
          <Stat label={t('litros no período')} value={brNumber(total)} tone="green" />
          <Stat label={t('média por dia')} value={brNumber(days.length ? total / days.length : 0)} />
        </View>
        <Card>
          <Muted>{t('Valor estimado no período')}</Muted>
          <Text style={{ fontSize: 22, fontWeight: '700', color: colors.green }}>{brMoney(value)}</Text>
          <Muted>{price ? t('Preço padrão: {price} por litro', { price: brMoney(price) }) : t('Defina o preço do litro no site para estimar o valor')}</Muted>
        </Card>
        {days.length === 0 ? <Empty title={t('Nenhum leite anotado no período')} text={canEdit ? t('Toque em “Anotar leite” para começar.') : undefined} /> : null}
        {days.map(d => (
          <Card key={d.day} style={{ paddingVertical: space.sm }}>
            <Row
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
