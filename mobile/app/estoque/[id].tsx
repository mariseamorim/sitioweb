import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate, brMoney, brNumber, parseNumber, todayISO } from '@/lib/format'
import { SUPPLY_CATEGORIES, UNITS, addMovement, getSupply, isLow, listMovements, removeSupply, saveSupply, type Supply } from '@/repos/supplies'
import { Badge, Button, Card, Chips, DateField, Field, Muted, Notice, Row, Screen, SelectField } from '@/ui'
import { colors, space } from '@/theme'

export default function EstoqueItem() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const isNew = !id || id === 'novo'
  const supply = useLive(() => (isNew ? null : getSupply(id)), [id])
  const movements = useLive(() => (isNew ? [] : listMovements(id)), [id])
  const [editing, setEditing] = useState(isNew)
  const [moving, setMoving] = useState(false)

  if (!isNew && !supply) return <Screen><Stack.Screen options={{ title: 'Produto' }} /><Notice text="Produto não encontrado." /></Screen>
  if (editing) return <SupplyForm farmId={farmId} supply={supply} canEdit={canEdit} onDone={(newId) => { if (isNew) router.replace(`/estoque/${newId}`); else setEditing(false) }} />
  const s = supply!
  if (moving) return <MovementForm farmId={farmId} supply={s} onDone={() => setMoving(false)} />

  return (
    <Screen>
      <Stack.Screen options={{ title: s.name }} />
      <Card>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{s.name}</Text>
        <Muted>{s.category}{s.unitPrice ? ` · ${brMoney(s.unitPrice)} por ${s.unit}` : ''}{s.packageKg ? ` · ${brNumber(s.packageKg, 0)} kg por ${s.unit}` : ''}</Muted>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.sm }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: isLow(s) ? colors.red : colors.green }}>{brNumber(s.currentQuantity, 0)} {s.unit}</Text>
          <Badge label={isLow(s) ? 'Abaixo do mínimo' : 'OK'} tone={isLow(s) ? 'red' : 'green'} />
        </View>
        <Muted>Mínimo: {brNumber(s.minimumQuantity, 0)} {s.unit}</Muted>
        {canEdit ? (
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <Button label="Entrada / saída" onPress={() => setMoving(true)} style={{ flex: 1 }} />
            <Button label="Editar" variant="secondary" onPress={() => setEditing(true)} />
          </View>
        ) : null}
      </Card>
      <Card>
        <Text style={{ fontWeight: '700', color: colors.text }}>Movimentações</Text>
        {movements.length === 0 ? <Muted>Nenhuma movimentação anotada.</Muted> : movements.map(m => (
          <Row key={m.id} title={`${m.type === 'Entrada' ? '+' : '-'}${brNumber(m.quantity, 0)} ${s.unit}`} detail={`${brDate(m.date)}${m.description ? ' · ' + m.description : ''}`}
            badge={<Badge label={m.type} tone={m.type === 'Entrada' ? 'green' : 'amber'} />} />
        ))}
      </Card>
    </Screen>
  )
}

function SupplyForm({ farmId, supply, canEdit, onDone }: { farmId: string; supply: Supply | null; canEdit: boolean; onDone: (id: string) => void }) {
  const router = useRouter()
  const [name, setName] = useState(supply?.name ?? '')
  const [category, setCategory] = useState<string | null>(supply?.category ?? 'Ração')
  const [unit, setUnit] = useState<string | null>(supply?.unit ?? 'kg')
  const [current, setCurrent] = useState(supply ? brNumber(supply.currentQuantity, 0) : '')
  const [minimum, setMinimum] = useState(supply ? brNumber(supply.minimumQuantity, 0) : '')
  const [packageKg, setPackageKg] = useState(supply?.packageKg ? brNumber(supply.packageKg, 0) : '')
  const [unitPrice, setUnitPrice] = useState(supply?.unitPrice ? brNumber(supply.unitPrice, 2) : '')
  const [error, setError] = useState('')

  function save() {
    if (!name.trim() || !category || !unit) { setError('Informe nome, categoria e unidade'); return }
    const cur = parseNumber(current) ?? 0, min = parseNumber(minimum) ?? 0, pk = parseNumber(packageKg), up = parseNumber(unitPrice)
    if ([cur, min, pk, up].some(v => v !== null && !Number.isFinite(v))) { setError('Quantidades inválidas'); return }
    onDone(saveSupply(farmId, { name, category, unit, currentQuantity: cur, minimumQuantity: min, packageKg: pk, unitPrice: up }, supply?.id))
  }

  function remove() {
    if (!supply) return
    Alert.alert('Apagar produto', `Apagar ${supply.name} do estoque?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => { removeSupply(farmId, supply.id); router.back() } },
    ])
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: supply ? 'Editar produto' : 'Cadastrar produto' }} />
      <Field label="Nome" value={name} onChangeText={setName} autoFocus={!supply} placeholder="Ex.: Ração 22% proteína" />
      <SelectField label="Categoria" value={category} options={SUPPLY_CATEGORIES.map(c => ({ value: c, label: c }))} onChange={setCategory} />
      <SelectField label="Unidade" value={unit} options={UNITS.map(u => ({ value: u, label: u }))} onChange={setUnit} />
      {!supply ? <Field label="Quantidade atual" value={current} onChangeText={setCurrent} keyboardType="decimal-pad" /> : null}
      <Field label="Quantidade mínima (avisa quando está acabando)" value={minimum} onChangeText={setMinimum} keyboardType="decimal-pad" />
      <Field label="Kg por unidade (opcional, para sacos)" value={packageKg} onChangeText={setPackageKg} keyboardType="decimal-pad" />
      <Field label="Preço por unidade (R$, opcional)" value={unitPrice} onChangeText={setUnitPrice} keyboardType="decimal-pad" />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Salvar" onPress={save} disabled={!canEdit} />
      {supply && canEdit ? <Button label="Apagar produto" variant="ghost" onPress={remove} style={{ marginTop: space.sm }} /> : null}
    </Screen>
  )
}

function MovementForm({ farmId, supply, onDone }: { farmId: string; supply: Supply; onDone: () => void }) {
  const [type, setType] = useState<'Entrada' | 'Saída'>('Saída')
  const [quantity, setQuantity] = useState('')
  const [date, setDate] = useState(todayISO())
  const [description, setDescription] = useState('')
  const [error, setError] = useState('')
  function save() {
    const q = parseNumber(quantity)
    if (q === null || !Number.isFinite(q) || q <= 0) { setError('Informe a quantidade'); return }
    addMovement(farmId, supply, { type, quantity: q, date, description })
    onDone()
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: supply.name }} />
      <Chips options={[{ value: 'Saída', label: 'Saída (usou)' }, { value: 'Entrada', label: 'Entrada (comprou)' }]} value={type} onChange={setType} />
      <View style={{ height: space.sm }} />
      <Field label={`Quantidade (${supply.unit})`} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" autoFocus />
      <DateField label="Data" value={date} onChange={setDate} />
      <Field label="Descrição (opcional)" value={description} onChangeText={setDescription} placeholder="Ex.: trato das vacas em lactação" />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Salvar" onPress={save} />
      <Button label="Cancelar" variant="ghost" onPress={onDone} style={{ marginTop: space.sm }} />
    </Screen>
  )
}
