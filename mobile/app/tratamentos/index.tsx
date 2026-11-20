import { useRouter } from 'expo-router'
import { FlatList, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate } from '@/lib/format'
import { listTreatments, milkBlockedToday, withdrawalUntil } from '@/repos/treatments'
import { Badge, Empty, Fab, IconCircle, Row } from '@/ui'
import { colors, space } from '@/theme'
import { useT } from '@/lib/i18n'

export default function Tratamentos() {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const t = useT()
  const items = useLive(() => listTreatments(farmId), [farmId])
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={items}
        keyExtractor={x => x.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 96 }}
        renderItem={({ item }) => {
          const until = withdrawalUntil(item, item.milkWithdrawalDays)
          return (
            <Row left={<IconCircle icon="medkit-outline" tone={milkBlockedToday(item) ? 'red' : 'blue'} />}
              title={`${item.medicine} · ${item.animalName ?? t('animal')}`}
              detail={`${brDate(item.startDate)}${item.endDate ? ` ${t('a')} ${brDate(item.endDate)}` : ''}${until ? ` · ${t('leite liberado após {date}', { date: brDate(until) })}` : ''}`}
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
