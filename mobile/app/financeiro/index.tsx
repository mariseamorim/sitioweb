import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { addDays, brDate, brMoney, todayISO } from '@/lib/format'
import { listTransactions, removeTransaction, totals } from '@/repos/transactions'
import { Badge, Card, Chips, Empty, Fab, IconCircle, Screen, Tile, TileGrid } from '@/ui'
import { colors, font, space } from '@/theme'
import { useT } from '@/lib/i18n'

type Period = 'mes' | '30' | '90'
type Kind = 'Todas' | 'Receita' | 'Despesa'
type Tone = 'green' | 'amber' | 'red' | 'blue' | 'purple'

// Cor fixa por categoria: a mesma categoria aparece sempre com a mesma cor
const CATEGORY_TONE: Record<string, Tone> = {
  'Venda de Leite': 'blue', 'Venda de Animal': 'green', 'Venda de Produção': 'green', 'Serviços': 'purple', 'Outros': 'purple',
  'Ração': 'amber', 'Sal mineral': 'amber', 'Medicamentos': 'red', 'Vacinas': 'red', 'Mão de Obra': 'blue', 'Energia': 'amber',
  'Combustível': 'amber', 'Manutenção': 'purple', 'Compra de Animal': 'green', 'Veterinário': 'red', 'Impostos': 'purple',
}
const TONES: Tone[] = ['green', 'amber', 'red', 'blue', 'purple']
function categoryTone(category: string): Tone {
  if (CATEGORY_TONE[category]) return CATEGORY_TONE[category]
  // Categoria fora da lista: cor tirada do nome (sempre igual para o mesmo nome)
  let h = 0
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) | 0
  return TONES[Math.abs(h) % TONES.length]
}

export default function Financeiro() {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const t = useT()
  const [period, setPeriod] = useState<Period>('mes')
  const [kind, setKind] = useState<Kind>('Todas')
  const today = todayISO()
  const from = period === 'mes' ? today.slice(0, 8) + '01' : addDays(today, -Number(period))
  const items = useLive(() => listTransactions(farmId, from, today), [farmId, from, today])
  const sum = totals(items)
  const shown = kind === 'Todas' ? items : items.filter(tx => tx.type === kind)

  function remove(id: string, label: string) {
    Alert.alert(t('Apagar lançamento'), t('Apagar "{label}"?', { label }), [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Apagar'), style: 'destructive', onPress: () => removeTransaction(farmId, id) },
    ])
  }

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Chips options={[{ value: 'mes', label: 'Este mês' }, { value: '30', label: 'Últimos 30 dias' }, { value: '90', label: 'Últimos 90 dias' }]} value={period} onChange={setPeriod} />
        <View style={{ height: space.sm }} />
        <TileGrid>
          <Tile accent="green" label={t('Receitas')} value={brMoney(sum.income)} />
          <Tile accent="red" label={t('Despesas')} value={brMoney(sum.expense)} />
          <Tile accent={sum.balance < 0 ? 'red' : 'green'} label={t('Saldo')} value={brMoney(sum.balance)} />
        </TileGrid>
        <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.lg, marginBottom: space.xs }}>{t('Movimentações')}</Text>
        <Chips options={(['Todas', 'Receita', 'Despesa'] as Kind[]).map(k => ({ value: k, label: k === 'Receita' ? 'Entradas' : k === 'Despesa' ? 'Saídas' : k }))} value={kind} onChange={setKind} />
        {shown.length === 0 ? <Empty title="Nenhum lançamento no período" /> : shown.map(tx => {
          const income = tx.type === 'Receita'
          const tone = income ? colors.green : colors.red
          return (
            <Card key={tx.id} style={{ padding: space.md }} onPress={canEdit ? () => remove(tx.id, `${t(tx.category)} ${brMoney(tx.amount)}`) : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                {/* Ícone redondo de dinheiro, na cor de entrada ou saída */}
                <IconCircle icon="cash-outline" tone={income ? 'green' : 'red'} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  {/* Data e categoria quebram de linha com letra grande */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
                    <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{brDate(tx.date)}</Text>
                    <Badge label={tx.category} tone={categoryTone(tx.category)} />
                  </View>
                  {tx.description || tx.animalName ? (
                    <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: 2 }} numberOfLines={2}>
                      {[tx.animalName, tx.description].filter(Boolean).join(' · ')}
                    </Text>
                  ) : null}
                </View>
                <Text style={{ fontWeight: '700', color: tone, fontSize: font.md }}>{income ? '+' : '-'}{brMoney(tx.amount)}</Text>
              </View>
            </Card>
          )
        })}
      </Screen>
      {canEdit ? <Fab label="+ Anotar" onPress={() => router.push('/financeiro/novo')} /> : null}
    </View>
  )
}
