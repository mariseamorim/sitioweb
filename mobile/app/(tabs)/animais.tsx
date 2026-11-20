import { useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { ageText } from '@/lib/format'
import { listAnimals } from '@/repos/animals'
import { Badge, Empty, Fab, Row, Search } from '@/ui'
import { AnimalThumb } from '@/ui/photo'
import { colors, space } from '@/theme'
import { useT } from '@/lib/i18n'

export default function Animais() {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const [q, setQ] = useState('')
  const t = useT()
  const animals = useLive(() => listAnimals(farmId, q), [farmId, q])

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: space.lg, paddingBottom: 0 }}>
        <Search value={q} onChange={setQ} placeholder={t('Nome, código ou brinco')} />
      </View>
      <FlatList
        data={animals}
        keyExtractor={a => a.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Row title={item.name} detail={`${item.customCode || item.code} · ${t(item.species)} · ${ageText(item.birthDate)}`}
            left={<AnimalThumb id={item.id} name={item.name} hasPhoto={!!item.hasPhoto} />}
            badge={item.status !== 'Vivo' ? <Badge label={t(item.status)} tone={item.status === 'Doente' ? 'amber' : 'muted'} /> : undefined}
            onPress={() => router.push(`/animais/${item.id}`)} />
        )}
        ListEmptyComponent={<Empty title={t(q ? 'Nenhum animal encontrado' : 'Nenhum animal cadastrado')} text={q ? undefined : t('Toque em “Cadastrar” para começar.')} />}
      />
      {canEdit ? <Fab label={t('+ Cadastrar')} onPress={() => router.push('/animais/novo')} /> : null}
    </View>
  )
}
