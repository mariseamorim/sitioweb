import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { isoDay, todayISO } from '@/lib/format'
import { animalOptions } from '@/repos/animals'
import { getTreatment, removeTreatment, saveTreatment } from '@/repos/treatments'
import { Button, DateField, Field, Notice, Screen, SelectField } from '@/ui'
import { space } from '@/theme'

export default function TratamentoForm() {
  const { id, animalId: presetAnimal } = useLocalSearchParams<{ id: string; animalId?: string }>()
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const editing = id && id !== 'novo' ? getTreatment(id) : null

  const [animalId, setAnimalId] = useState<string | null>(editing?.animalId ?? presetAnimal ?? null)
  const [medicine, setMedicine] = useState(editing?.medicine ?? '')
  const [startDate, setStartDate] = useState(editing ? isoDay(editing.startDate) : todayISO())
  const [endDate, setEndDate] = useState(editing?.endDate ? isoDay(editing.endDate) : '')
  const [milkDays, setMilkDays] = useState(editing?.milkWithdrawalDays === null || editing?.milkWithdrawalDays === undefined ? '' : String(editing.milkWithdrawalDays))
  const [meatDays, setMeatDays] = useState(editing?.meatWithdrawalDays === null || editing?.meatWithdrawalDays === undefined ? '' : String(editing.meatWithdrawalDays))
  const [batch, setBatch] = useState(editing?.batch ?? '')
  const [manufacturer, setManufacturer] = useState(editing?.manufacturer ?? '')
  const [description, setDescription] = useState(editing?.description ?? '')
  const [observations, setObservations] = useState(editing?.observations ?? '')
  const [error, setError] = useState('')

  function save() {
    if (!animalId) { setError('Escolha o animal'); return }
    if (!medicine.trim()) { setError('Informe o medicamento'); return }
    for (const d of [milkDays, meatDays]) {
      if (d.trim() && (!/^\d+$/.test(d.trim()) || Number(d) > 365)) { setError('A carência deve ser em dias, de 0 a 365'); return }
    }
    if (endDate && endDate < startDate) { setError('O fim não pode ser antes do início'); return }
    saveTreatment(farmId, { animalId, medicine, startDate, endDate, milkWithdrawalDays: milkDays, meatWithdrawalDays: meatDays, batch, manufacturer, description, observations }, editing?.id)
    router.back()
  }

  function remove() {
    if (!editing) return
    Alert.alert('Apagar tratamento', 'Apagar este tratamento?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => { removeTreatment(farmId, editing.id); router.back() } },
    ])
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? 'Tratamento' : 'Registrar tratamento' }} />
      <SelectField label="Animal" value={animalId} options={animalOptions(farmId)} onChange={setAnimalId} searchable placeholder="Escolher o animal" />
      <Field label="Medicamento" value={medicine} onChangeText={setMedicine} autoFocus={!editing} />
      <DateField label="Início" value={startDate} onChange={setStartDate} />
      <DateField label="Fim (opcional)" value={endDate} onChange={setEndDate} allowEmpty />
      <Field label="Carência do leite (dias)" value={milkDays} onChangeText={setMilkDays} keyboardType="number-pad" hint="Dias após o fim do tratamento em que o leite não vai para o tanque" />
      <Field label="Carência da carne (dias)" value={meatDays} onChangeText={setMeatDays} keyboardType="number-pad" />
      <Field label="Lote (opcional)" value={batch} onChangeText={setBatch} autoCapitalize="characters" />
      <Field label="Fabricante (opcional)" value={manufacturer} onChangeText={setManufacturer} />
      <Field label="Descrição" value={description} onChangeText={setDescription} multiline />
      <Field label="Observações" value={observations} onChangeText={setObservations} multiline />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Salvar" onPress={save} disabled={!canEdit} />
      {editing && canEdit ? <Button label="Apagar" variant="ghost" onPress={remove} style={{ marginTop: space.sm }} /> : null}
    </Screen>
  )
}
