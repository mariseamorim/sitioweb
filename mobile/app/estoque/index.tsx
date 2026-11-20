import { useRouter } from 'expo-router'
import { FlatList, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brNumber } from '@/lib/format'
import { isLow, listSupplies, supplyStatus } from '@/repos/supplies'
import { Badge, Empty, Fab, IconCircle, Notice, Row } from '@/ui'
import { colors, space } from '@/theme'
import { useT, useLocale } from '@/lib/i18n'

// Ícone por categoria do produto (a cor vem da situação: OK, Baixo, Crítico)
function categoryIcon(category: string) {
  if (category === 'Medicamento') return 'medkit-outline' as const
  if (category === 'Vacina') return 'eyedrop-outline' as const
  if (category === 'Sementes' || category === 'Adubo') return 'leaf-outline' as const
  return 'cube-outline' as const
}

export default function Estoque() {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const t = useT()
  const items = useLive(() => listSupplies(farmId), [farmId])
  const low = items.filter(isLow).length
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={s => s.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 96 }}
        ListHeaderComponent={low ? <Notice tone="red" text={low === 1 ? t('1 produto abaixo do estoque mínimo') : t('{n} produtos abaixo do estoque mínimo', { n: low })} /> : undefined}
        renderItem={({ item }) => {
          const st = supplyStatus(item)
          return (
            <Row left={<IconCircle icon={categoryIcon(item.category)} tone={st.tone} />}
              title={item.name} detail={`${t(item.category)} · ${t('mínimo')} ${brNumber(item.minimumQuantity, 0)} ${t(item.unit)}`}
              badge={<Badge label={st.label} tone={st.tone} />}
              right={<Text style={{ fontWeight: '700', fontSize: 18, color: st.tone === 'green' ? colors.text : st.tone === 'red' ? colors.red : colors.amber }}>{brNumber(item.currentQuantity, 0)} {t(item.unit)}</Text>}
              onPress={() => router.push(`/estoque/${item.id}`)} />
          )
        }}
        ListEmptyComponent={<Empty title="Nenhum produto no estoque" text={canEdit ? 'Toque em “Cadastrar” para começar.' : undefined} />}
      />
      {canEdit ? <Fab label="+ Cadastrar" onPress={() => router.push('/estoque/novo')} /> : null}
    </View>
  )
}
