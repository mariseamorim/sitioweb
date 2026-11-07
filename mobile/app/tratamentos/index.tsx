import { useRouter } from 'expo-router'
import { FlatList, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate } from '@/lib/format'
import { listTreatments, milkBlockedToday, withdrawalUntil } from '@/repos/treatments'
import { Badge, Empty, Fab, Row } from '@/ui'
import { colors, space } from '@/theme'

export default function Tratamentos() {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const items = useLive(() => listTreatments(farmId), [farmId])
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={t => t.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 96 }}
        renderItem={({ item }) => {
          const until = withdrawalUntil(item, item.milkWithdrawalDays)
          return (
            <Row title={`${item.medicine} · ${item.animalName ?? 'animal'}`}
              detail={`${brDate(item.startDate)}${item.endDate ? ' a ' + brDate(item.endDate) : ''}${until ? ` · leite liberado após ${brDate(until)}` : ''}`}
              badge={milkBlockedToday(item) ? <Badge label="Leite em carência" tone="red" /> : undefined}
              onPress={() => router.push(`/tratamentos/${item.id}`)} />
          )
        }}
        ListEmptyComponent={<Empty title="Nenhum tratamento anotado" text={canEdit ? 'Toque em “Registrar” para anotar um remédio ou tratamento.' : undefined} />}
      />
      {canEdit ? <Fab label="+ Registrar" onPress={() => router.push('/tratamentos/novo')} /> : null}
    </View>
  )
}
