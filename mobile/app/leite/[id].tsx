import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Alert, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { all } from '@/db'
import { brNumber, isoDay, parseNumber, todayISO } from '@/lib/format'
import { animalOptions } from '@/repos/animals'
import { getMilkPrice, removeMilk, saveMilk, type Milk, type MilkInput } from '@/repos/milk'
import { useSyncState } from '@/sync'
import { Button, Chips, DateField, Field, Muted, Notice, Screen, SelectField } from '@/ui'
import { VoiceButton } from '@/ui/voice'
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

  // Monta o lançamento a partir dos campos; devolve o texto do erro quando falta algo
  function validate(): MilkInput | string {
    const q = parseNumber(quantity)
    if (q === null || !Number.isFinite(q) || q <= 0) return 'Informe a quantidade de litros'
    const c = mode === 'dia' ? parseNumber(cows) : null
    if (c !== null && (!Number.isInteger(c) || c <= 0)) return 'Vacas ordenhadas: número inteiro'
    if (mode === 'vaca' && !animalId) return 'Escolha a vaca'
    const p = parseNumber(price)
    if (p !== null && (!Number.isFinite(p) || p < 0)) return 'Preço por litro inválido'
    return { date, quantity: q, cowsMilked: c, animalId: mode === 'vaca' ? animalId : null, pricePerLiter: p, observations }
  }

  // Salva sozinho 1,5 s depois da última alteração, como no site: o número falado também grava.
  // O primeiro salvamento cria o lançamento; os seguintes alteram o mesmo registro.
  const sync = useSyncState()
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const savedIdRef = useRef<string | null>(editing?.id ?? null)
  const key = [mode, date, quantity, cows, animalId ?? '', price, observations].join('|')
  const keyRef = useRef(key)
  keyRef.current = key
  const savedKeyRef = useRef(key)
  function persist(): boolean {
    const v = validate()
    if (typeof v === 'string') return false
    savedIdRef.current = saveMilk(farmId, v, savedIdRef.current ?? undefined)
    savedKeyRef.current = key
    setSavedAt(Date.now())
    setError('')
    return true
  }
  const persistRef = useRef(persist)
  persistRef.current = persist
  useEffect(() => {
    if (!canEdit || key === savedKeyRef.current) return
    const timer = setTimeout(() => persistRef.current(), 1500)
    return () => clearTimeout(timer)
  }, [key, canEdit])
  // Sair da tela no meio da digitação não perde nada
  useEffect(() => () => { if (keyRef.current !== savedKeyRef.current) persistRef.current() }, [])

  function save() {
    if (key !== savedKeyRef.current && !persist()) { setError(validate() as string); return }
    router.back()
  }

  const status = savedAt === null ? ''
    : !sync.online ? 'Salvo no celular. Será enviado quando houver internet.'
      : sync.pending > 0 || sync.syncing ? 'Salvo no celular. Enviando…' : 'Salvo e enviado.'

  function remove() {
    if (!editing) return
    Alert.alert('Apagar lançamento', 'Apagar este lançamento de leite?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => { savedKeyRef.current = keyRef.current; removeMilk(farmId, savedIdRef.current ?? editing.id); router.back() } },
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
      {canEdit ? <VoiceButton onNumber={v => setQuantity(brNumber(v, 2).replace(/\./g, '').replace(/,?0+$/, ''))} /> : null}
      {mode === 'dia'
        ? <Field label="Vacas ordenhadas (opcional)" value={cows} onChangeText={setCows} keyboardType="number-pad" placeholder="Ex.: 12" />
        : <SelectField label="Vaca" value={animalId} options={animals} onChange={setAnimalId} searchable placeholder="Escolher a vaca" />}
      <Field label="Preço por litro (R$)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="Ex.: 2,60" hint="Fica guardado no lançamento para calcular o valor" />
      <Field label="Observações" value={observations} onChangeText={setObservations} multiline />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label={savedAt ? 'Concluir' : editing ? 'Salvar alterações' : 'Salvar'} onPress={save} disabled={!canEdit} />
      {status ? <Muted style={{ textAlign: 'center', marginTop: space.sm }}>{status}</Muted> : null}
      {editing && canEdit ? <Button label="Apagar" variant="ghost" onPress={remove} style={{ marginTop: space.sm }} /> : null}
    </Screen>
  )
}
