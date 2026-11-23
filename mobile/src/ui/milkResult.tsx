import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { all } from '@/db'
import { useLive } from '@/db/events'
import { brMoney, brNumber } from '@/lib/format'
import { lastMonths, milkResultByMonth, spendingAlerts, type MilkMonth, type ResultMilk, type ResultTransaction } from '@/lib/milkResult'
import { Card, Muted, Tile, TileGrid } from '@/ui'
import { colors, font, radius, space } from '@/theme'
import { useLocale, useT } from '@/lib/i18n'

// Financeiro do app (como src/components/MilkResult.tsx do site): resultado do leite e gastos acima do normal,
// montados com o que está no celular (funciona sem internet). Regra em src/lib/milkResult.ts.

export function useFinanceInsights(farmId: string, today: string, withMilk: boolean) {
  return useLive(() => {
    const months = lastMonths(today, 12)
    const from = `${months[0]}-01`
    const tx = all<ResultTransaction>('SELECT type, category, substr(date, 1, 10) AS date, amount, lotId FROM transactions WHERE farmId = ? AND substr(date, 1, 10) >= ?', [farmId, from])
    const milk = withMilk ? all<ResultMilk>('SELECT substr(date, 1, 10) AS date, quantity, pricePerLiter FROM milk WHERE farmId = ? AND substr(date, 1, 10) >= ?', [farmId, from]) : []
    return { months: milkResultByMonth(tx, milk, months), hasMilk: milk.length > 0, alerts: spendingAlerts(tx, today) }
  }, [farmId, today, withMilk])
}

export function SpendingAlertsCard({ alerts }: { alerts: ReturnType<typeof spendingAlerts> }) {
  const t = useT()
  if (!alerts.length) return null
  return (
    <View style={{ backgroundColor: '#fffbeb', borderColor: '#fde68a', borderWidth: 1, borderRadius: radius.md, padding: space.md, marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs }}>
        <Ionicons name="warning-outline" size={20} color={colors.amber} />
        <Text style={{ fontWeight: '700', color: '#78350f' }}>{t('Gastos acima do normal neste mês')}</Text>
      </View>
      {alerts.map(a => (
        <Text key={a.category} style={{ color: '#78350f', marginTop: 2 }}>
          <Text style={{ fontWeight: '700' }}>{t(a.category)}</Text>: {t('{value} até agora, {percent}% acima da média dos últimos 3 meses ({average}).', { value: brMoney(a.current), percent: a.percent, average: brMoney(a.average) })}
        </Text>
      ))}
    </View>
  )
}

export function MilkResultCard({ months, hasMilk }: { months: MilkMonth[]; hasMilk: boolean }) {
  const t = useT()
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  if (!hasMilk) return null
  const current = months[months.length - 1]
  const shown = current.liters > 0 ? current : months[months.length - 2] ?? current
  const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString(locale, { month: 'long', timeZone: 'UTC' })
  const perLiter = (v: number | null) => (v === null ? '—' : brMoney(v))
  const margin = shown.marginPerLiter
  return (
    <Card>
      <Text style={{ fontWeight: '700', fontSize: font.md, color: colors.text }}>{t('Resultado do leite')} · {monthName(shown.month)}{shown === current ? ` (${t('até hoje')})` : ''}</Text>
      <Muted style={{ marginBottom: space.sm }}>{t('Custos: as despesas do mês, menos as ligadas a um lote de recria ou engorda.')}{shown.revenueEstimated ? ` ${t('Sem venda de leite lançada: a receita foi estimada pelo preço do litro.')}` : ''}</Muted>
      <TileGrid>
        <Tile accent="blue" label={t('Leite produzido')} value={`${brNumber(shown.liters, 0)} L`} />
        <Tile accent="green" label={t('Receita do leite')} value={brMoney(shown.revenue)} detail={shown.revenueEstimated ? t('estimada') : undefined} />
        <Tile accent="amber" label={t('Custo por litro')} value={perLiter(shown.costPerLiter)} detail={t('{value} de custos', { value: brMoney(shown.costs) })} />
        <Tile accent={margin === null || margin >= 0 ? 'green' : 'red'} label={t(margin !== null && margin < 0 ? 'Prejuízo por litro' : 'Sobra por litro')} value={perLiter(margin === null ? null : Math.abs(margin))}
          detail={t(shown.result >= 0 ? '{value} de sobra no mês' : '{value} de prejuízo no mês', { value: brMoney(Math.abs(shown.result)) })} />
      </TileGrid>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" style={{ minHeight: 40, justifyContent: 'center' }}>
        <Text style={{ color: colors.green, fontWeight: '700' }}>{t(open ? 'Esconder mês a mês' : 'Ver mês a mês')}</Text>
      </Pressable>
      {open ? [...months].reverse().filter(m => m.liters || m.costs || m.revenue).map(m => (
        <View key={m.month} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ color: colors.text, textTransform: 'capitalize', flex: 1 }}>{monthName(m.month)}</Text>
          <Text style={{ color: colors.muted, width: 110, textAlign: 'right' }}>{t('custo')} {perLiter(m.costPerLiter)}</Text>
          <Text style={{ width: 110, textAlign: 'right', fontWeight: '700', color: m.marginPerLiter !== null && m.marginPerLiter < 0 ? colors.red : colors.green }}>{t('sobra')} {perLiter(m.marginPerLiter)}</Text>
        </View>
      )) : null}
    </Card>
  )
}
