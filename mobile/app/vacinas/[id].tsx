import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { isoDay, todayISO } from '@/lib/format'
import { animalOptions } from '@/repos/animals'
import { getVaccination, removeVaccination, saveVaccination } from '@/repos/vaccinations'
import { Button, DateField, Field, Notice, Screen, SelectField } from '@/ui'
import { space } from '@/theme'

const COMMON = ['Febre Aftosa', 'Brucelose (B19)', 'Raiva', 'Clostridiose', 'Carbúnculo', 'IBR/BVD', 'Leptospirose', 'Botulismo']

export default function VacinaForm() {
  const { id, animalId: presetAnimal } = useLocalSearchParams<{ id: string; animalId?: string }>()
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const editing = id && id !== 'nova' ? getVaccination(id) : null

  const [animalId, setAnimalId] = useState<string | null>(editing?.animalId ?? presetAnimal ?? null)
  const [vaccineName, setVaccineName] = useState(editing?.vaccineName ?? '')
  const [scheduledDate, setScheduledDate] = useState(editing ? isoDay(editing.scheduledDate) : todayISO())
  const [appliedDate, setAppliedDate] = useState(editing?.appliedDate ? isoDay(editing.appliedDate) : '')
  const [batch, setBatch] = useState(editing?.batch ?? '')
  const [manufacturer, setManufacturer] = useState(editing?.manufacturer ?? '')
  const [observations, setObservations] = useState(editing?.observations ?? '')
  const [error, setError] = useState('')

  function save() {
    if (!animalId) { setError('Escolha o animal'); return }
    if (!vaccineName.trim()) { setError('Informe a vacina'); return }
    saveVaccination(farmId, { animalId, vaccineName, scheduledDate, appliedDate, batch, manufacturer, observations }, editing?.id)
    router.back()
  }

  function remove() {
    if (!editing) return
    Alert.alert('Apagar vacina', 'Apagar este registro de vacina?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => { removeVaccination(farmId, editing.id); router.back() } },
    ])
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? 'Vacina' : 'Registrar vacina' }} />
      <SelectField label="Animal" value={animalId} options={animalOptions(farmId)} onChange={setAnimalId} searchable placeholder="Escolher o animal" />
      <SelectField label="Vacina" value={COMMON.includes(vaccineName) ? vaccineName : vaccineName ? '__outra' : null} options={[...COMMON.map(v => ({ value: v, label: v })), { value: '__outra', label: 'Outra (digitar)' }]} onChange={v => setVaccineName(v === '__outra' ? ' ' : v ?? '')} />
      {vaccineName && !COMMON.includes(vaccineName) ? <Field label="Nome da vacina" value={vaccineName.trim()} onChangeText={setVaccineName} autoFocus /> : null}
      <DateField label="Data agendada" value={scheduledDate} onChange={setScheduledDate} />
      <DateField label="Data da aplicação (vazio = ainda não aplicada)" value={appliedDate} onChange={setAppliedDate} allowEmpty />
      {!appliedDate ? <Button label="Marcar como aplicada hoje" variant="secondary" onPress={() => setAppliedDate(todayISO())} style={{ marginBottom: space.md }} /> : null}
      <Field label="Lote (opcional)" value={batch} onChangeText={setBatch} autoCapitalize="characters" />
      <Field label="Fabricante (opcional)" value={manufacturer} onChangeText={setManufacturer} />
      <Field label="Observações" value={observations} onChangeText={setObservations} multiline />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Salvar" onPress={save} disabled={!canEdit} />
      {editing && canEdit ? <Button label="Apagar" variant="ghost" onPress={remove} style={{ marginTop: space.sm }} /> : null}
    </Screen>
  )
}
