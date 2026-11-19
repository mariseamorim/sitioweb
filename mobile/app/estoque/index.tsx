import { useRouter } from 'expo-router'
import { FlatList, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brNumber } from '@/lib/format'
import { isLow, listSupplies } from '@/repos/supplies'
import { Badge, Empty, Fab, Notice, Row } from '@/ui'
import { colors, space } from '@/theme'
import { useT, useLocale } from '@/lib/i18n'

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
        renderItem={({ item }) => (
          <Row title={item.name} detail={`${t(item.category)} · ${t('mínimo')} ${brNumber(item.minimumQuantity, 0)} ${t(item.unit)}`}
            badge={<Badge label={isLow(item) ? 'Baixo' : 'OK'} tone={isLow(item) ? 'red' : 'green'} />}
            right={<Text style={{ fontWeight: '700', fontSize: 18, color: isLow(item) ? colors.red : colors.text }}>{brNumber(item.currentQuantity, 0)} {t(item.unit)}</Text>}
            onPress={() => router.push(`/estoque/${item.id}`)} />
        )}
        ListEmptyComponent={<Empty title="Nenhum produto no estoque" text={canEdit ? 'Toque em “Cadastrar” para começar.' : undefined} />}
      />
      {canEdit ? <Fab label="+ Cadastrar" onPress={() => router.push('/estoque/novo')} /> : null}
    </View>
  )
}
