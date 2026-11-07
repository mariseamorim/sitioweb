import { useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate } from '@/lib/format'
import { listVaccinations, vaccStatus, type VaccStatus } from '@/repos/vaccinations'
import { Badge, Chips, Empty, Fab, Row, Search } from '@/ui'
import { colors, space } from '@/theme'

type Filter = 'Todas' | VaccStatus

export default function Vacinas() {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('Todas')
  const [q, setQ] = useState('')
  const items = useLive(() => listVaccinations(farmId).map(v => ({ ...v, status: vaccStatus(v) })), [farmId])
  const term = q.trim().toLowerCase()
  const shown = items.filter(v => (filter === 'Todas' || v.status === filter) && (!term || `${v.animalName ?? ''} ${v.animalCode ?? ''} ${v.vaccineName}`.toLowerCase().includes(term)))
  const tone = (s: VaccStatus) => (s === 'Aplicada' ? 'green' : s === 'Vencida' ? 'red' : 'amber')

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}>
        <Chips options={(['Todas', 'Pendente', 'Aplicada', 'Vencida'] as Filter[]).map(f => ({ value: f, label: f }))} value={filter} onChange={setFilter} />
        <Search value={q} onChange={setQ} placeholder="Animal ou vacina" />
      </View>
      <FlatList
        data={shown}
        keyExtractor={v => v.id}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Row title={`${item.vaccineName} · ${item.animalName ?? 'animal'}`}
            detail={item.status === 'Aplicada' ? `Aplicada em ${brDate(item.appliedDate)}` : `Agendada para ${brDate(item.scheduledDate)}`}
            badge={<Badge label={item.status} tone={tone(item.status)} />}
            onPress={() => router.push(`/vacinas/${item.id}`)} />
        )}
        ListEmptyComponent={<Empty title="Nenhuma vacina" text={canEdit ? 'Toque em “Registrar” para agendar ou anotar uma vacina.' : undefined} />}
      />
      {canEdit ? <Fab label="+ Registrar" onPress={() => router.push('/vacinas/nova')} /> : null}
    </View>
  )
}
