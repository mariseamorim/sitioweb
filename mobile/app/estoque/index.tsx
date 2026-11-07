import { useRouter } from 'expo-router'
import { FlatList, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brNumber } from '@/lib/format'
import { isLow, listSupplies } from '@/repos/supplies'
import { Badge, Empty, Fab, Notice, Row } from '@/ui'
import { colors, space } from '@/theme'

export default function Estoque() {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const items = useLive(() => listSupplies(farmId), [farmId])
  const low = items.filter(isLow).length
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={s => s.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 96 }}
        ListHeaderComponent={low ? <Notice tone="red" text={`${low} ${low === 1 ? 'produto abaixo' : 'produtos abaixo'} do estoque mínimo`} /> : undefined}
        renderItem={({ item }) => (
          <Row title={item.name} detail={`${item.category} · mínimo ${brNumber(item.minimumQuantity, 0)} ${item.unit}`}
            badge={<Badge label={isLow(item) ? 'Baixo' : 'OK'} tone={isLow(item) ? 'red' : 'green'} />}
            right={<Text style={{ fontWeight: '700', fontSize: 18, color: isLow(item) ? colors.red : colors.text }}>{brNumber(item.currentQuantity, 0)} {item.unit}</Text>}
            onPress={() => router.push(`/estoque/${item.id}`)} />
        )}
        ListEmptyComponent={<Empty title="Nenhum produto no estoque" text={canEdit ? 'Toque em “Cadastrar” para começar.' : undefined} />}
      />
      {canEdit ? <Fab label="+ Cadastrar" onPress={() => router.push('/estoque/novo')} /> : null}
    </View>
  )
}
