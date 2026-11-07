import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { all } from '@/db'
import { brNumber, isoDay, parseNumber, todayISO } from '@/lib/format'
import { animalOptions } from '@/repos/animals'
import { getMilkPrice, removeMilk, saveMilk, type Milk } from '@/repos/milk'
import { Button, Chips, DateField, Field, Notice, Screen, SelectField } from '@/ui'
import { space } from '@/theme'

// Anotar leite (id = "novo") ou editar um lançamento. "Total do dia" é o uso comum; "Por vaca" separa o leite de uma vaca.
export default function LeiteForm() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const editing = id && id !== 'novo' ? all<Milk>('SELECT * FROM milk WHERE id = ?', [id])[0] ?? null : null

  const [mode, setMode] = useState<'dia' | 'vaca'>(editing?.animalId ? 'vaca' : 'dia')
  const [date, setDate] = useState(editing ? isoDay(editing.date) : todayISO())
  const [quantity, setQuantity] = useState(editing ? brNumber(editing.quantity).replace(/\./g, '') : '')
  const [cows, setCows] = useState(editing?.cowsMilked ? String(editing.cowsMilked) : '')
  const [animalId, setAnimalId] = useState<string | null>(editing?.animalId ?? null)
  const [price, setPrice] = useState(() => { const p = editing ? editing.pricePerLiter : getMilkPrice(farmId); return p === null || p === undefined ? '' : brNumber(p, 2) })
  const [observations, setObservations] = useState(editing?.observations ?? '')
  const [error, setError] = useState('')
  const animals = animalOptions(farmId).filter(a => /vaca/i.test(a.detail ?? ''))

  function save() {
    const q = parseNumber(quantity)
    if (q === null || !Number.isFinite(q) || q <= 0) { setError('Informe a quantidade de litros'); return }
    const c = mode === 'dia' ? parseNumber(cows) : null
    if (c !== null && (!Number.isInteger(c) || c <= 0)) { setError('Vacas ordenhadas: número inteiro'); return }
    if (mode === 'vaca' && !animalId) { setError('Escolha a vaca'); return }
    const p = parseNumber(price)
    if (p !== null && (!Number.isFinite(p) || p < 0)) { setError('Preço por litro inválido'); return }
    saveMilk(farmId, { date, quantity: q, cowsMilked: c, animalId: mode === 'vaca' ? animalId : null, pricePerLiter: p, observations }, editing?.id)
    router.back()
  }

  function remove() {
    if (!editing) return
    Alert.alert('Apagar lançamento', 'Apagar este lançamento de leite?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => { removeMilk(farmId, editing.id); router.back() } },
    ])
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? 'Editar leite' : 'Anotar leite' }} />
      {!canEdit ? <Notice tone="red" text="Sua conta só pode consultar." /> : null}
      <Chips options={[{ value: 'dia', label: 'Total do dia' }, { value: 'vaca', label: 'Por vaca' }]} value={mode} onChange={setMode} />
      <View style={{ height: space.sm }} />
      <DateField label="Data" value={date} onChange={setDate} />
      <Field label="Litros" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="Ex.: 180" autoFocus={!editing} />
      {mode === 'dia'
        ? <Field label="Vacas ordenhadas (opcional)" value={cows} onChangeText={setCows} keyboardType="number-pad" placeholder="Ex.: 12" />
        : <SelectField label="Vaca" value={animalId} options={animals} onChange={setAnimalId} searchable placeholder="Escolher a vaca" />}
      <Field label="Preço por litro (R$)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Ex.: 2,60" hint="Fica guardado no lançamento para calcular o valor" />
      <Field label="Observações" value={observations} onChangeText={setObservations} multiline />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label={editing ? 'Salvar alterações' : 'Salvar'} onPress={save} disabled={!canEdit} />
      {editing && canEdit ? <Button label="Apagar" variant="ghost" onPress={remove} style={{ marginTop: space.sm }} /> : null}
    </Screen>
  )
}
