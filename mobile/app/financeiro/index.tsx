import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { addDays, brDate, brMoney, todayISO } from '@/lib/format'
import { listTransactions, removeTransaction, totals } from '@/repos/transactions'
import { Badge, Chips, Empty, Fab, Row, Screen, Stat } from '@/ui'
import { colors, space } from '@/theme'

type Period = 'mes' | '30' | '90'
type Kind = 'Todas' | 'Receita' | 'Despesa'

export default function Financeiro() {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const [period, setPeriod] = useState<Period>('mes')
  const [kind, setKind] = useState<Kind>('Todas')
  const today = todayISO()
  const from = period === 'mes' ? today.slice(0, 8) + '01' : addDays(today, -Number(period))
  const items = useLive(() => listTransactions(farmId, from, today), [farmId, from, today])
  const sum = totals(items)
  const shown = kind === 'Todas' ? items : items.filter(t => t.type === kind)

  function remove(id: string, label: string) {
    Alert.alert('Apagar lançamento', `Apagar "${label}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => removeTransaction(farmId, id) },
    ])
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Chips options={[{ value: 'mes', label: 'Este mês' }, { value: '30', label: 'Últimos 30 dias' }, { value: '90', label: 'Últimos 90 dias' }]} value={period} onChange={setPeriod} />
        <View style={{ flexDirection: 'row', gap: space.md, marginVertical: space.md }}>
          <Stat label="entradas" value={brMoney(sum.income)} tone="green" />
          <Stat label="saídas" value={brMoney(sum.expense)} tone="red" />
        </View>
        <Stat label="saldo do período" value={brMoney(sum.balance)} tone={sum.balance >= 0 ? 'green' : 'red'} />
        <View style={{ height: space.sm }} />
        <Chips options={(['Todas', 'Receita', 'Despesa'] as Kind[]).map(k => ({ value: k, label: k === 'Receita' ? 'Entradas' : k === 'Despesa' ? 'Saídas' : k }))} value={kind} onChange={setKind} />
        {shown.length === 0 ? <Empty title="Nenhum lançamento no período" /> : shown.map(t => (
          <Row key={t.id} title={t.category + (t.animalName ? ` · ${t.animalName}` : '')} detail={`${brDate(t.date)}${t.description ? ' · ' + t.description : ''}`}
            badge={<Badge label={t.type === 'Receita' ? 'Entrada' : 'Saída'} tone={t.type === 'Receita' ? 'green' : 'red'} />}
            right={<Text style={{ fontWeight: '700', color: t.type === 'Receita' ? colors.green : colors.red }}>{t.type === 'Receita' ? '+' : '-'}{brMoney(t.amount)}</Text>}
            onPress={canEdit ? () => remove(t.id, `${t.category} ${brMoney(t.amount)}`) : undefined} />
        ))}
      </Screen>
      {canEdit ? <Fab label="+ Anotar" onPress={() => router.push('/financeiro/novo')} /> : null}
    </View>
  )
}
