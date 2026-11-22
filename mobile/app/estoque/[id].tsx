import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate, brMoney, brNumber, parseNumber, todayISO } from '@/lib/format'
import { EXPIRY_WARNING_DAYS, SUPPLY_CATEGORIES, UNITS, addMovement, daysToExpiry, getSupply, isLow, listMovements, removeSupply, saveSupply, supplyStatus, type Supply } from '@/repos/supplies'
import { Badge, Button, Card, Chips, DateField, Field, IconCircle, Muted, Notice, Row, Screen, SelectField } from '@/ui'
import { colors, font, space } from '@/theme'
import { useT } from '@/lib/i18n'

export default function EstoqueItem() {
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>()
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const isNew = !id || id === 'novo'
  const supply = useLive(() => (isNew ? null : getSupply(id)), [id])
  const movements = useLive(() => (isNew ? [] : listMovements(id)), [id])
  const [editing, setEditing] = useState(isNew)
  const [moving, setMoving] = useState(false)
  const t = useT()

  if (!isNew && !supply) return <Screen><Stack.Screen options={{ title: t('Produto') }} /><Notice text="Produto não encontrado." /></Screen>
  if (editing) return <SupplyForm farmId={farmId} supply={supply} canEdit={canEdit} onDone={(newId) => { if (isNew) router.replace({ pathname: '/estoque/[id]', params: { id: newId, saved: '1' } }); else setEditing(false) }} />
  const s = supply!
  if (moving) return <MovementForm farmId={farmId} supply={s} onDone={() => setMoving(false)} />
  const st = supplyStatus(s)

  return (
    <Screen>
      <Stack.Screen options={{ title: s.name }} />
      {saved === '1' ? <Notice tone="green" text={t('Produto cadastrado com sucesso!')} /> : null}
      <Card>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{s.name}</Text>
        <Muted>{t(s.category)}{s.unitPrice ? ` · ${brMoney(s.unitPrice)} ${t('por')} ${t(s.unit)}` : ''}{s.packageKg ? ` · ${brNumber(s.packageKg, 0)} kg ${t('por')} ${t(s.unit)}` : ''}</Muted>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm, marginTop: space.sm }}>
          <Text style={{ fontSize: 28, fontWeight: '700', color: st.tone === 'green' ? colors.green : st.tone === 'red' ? colors.red : colors.amber }}>{brNumber(s.currentQuantity, 0)} {t(s.unit)}</Text>
          <Badge label={st.label === 'Crítico' ? 'Crítico' : isLow(s) ? 'Abaixo do mínimo' : 'OK'} tone={st.tone} />
        </View>
        <Muted>{t('Mínimo:')} {brNumber(s.minimumQuantity, 0)} {t(s.unit)}</Muted>
        <ExpiryLine supply={s} />
        {canEdit ? (
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <Button label="Entrada / saída" onPress={() => setMoving(true)} style={{ flex: 1 }} />
            <Button label="Editar" variant="secondary" onPress={() => setEditing(true)} />
          </View>
        ) : null}
      </Card>
      <Card>
        <Text style={{ fontWeight: '700', color: colors.text }}>{t('Movimentações')}</Text>
        {movements.length === 0 ? <Muted>{t('Nenhuma movimentação anotada.')}</Muted> : movements.map(m => (
          <Row key={m.id} title={`${m.type === 'Entrada' ? '+' : '-'}${brNumber(m.quantity, 0)} ${t(s.unit)}`} detail={`${brDate(m.date)}${m.description ? ' · ' + m.description : ''}`}
            left={<IconCircle icon={m.type === 'Entrada' ? 'arrow-down-outline' : 'arrow-up-outline'} tone={m.type === 'Entrada' ? 'green' : 'amber'} size={36} />}
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
  const [expiry, setExpiry] = useState(supply?.expiryDate ? supply.expiryDate.slice(0, 10) : '')
  const [error, setError] = useState('')
  const t = useT()

  function save() {
    if (!name.trim() || !category || !unit) { setError('Informe nome, categoria e unidade'); return }
    const cur = parseNumber(current) ?? 0, min = parseNumber(minimum) ?? 0, pk = parseNumber(packageKg), up = parseNumber(unitPrice)
    if ([cur, min, pk, up].some(v => v !== null && !Number.isFinite(v))) { setError('Quantidades inválidas'); return }
    onDone(saveSupply(farmId, { name, category, unit, currentQuantity: cur, minimumQuantity: min, packageKg: pk, unitPrice: up, expiryDate: expiry || null }, supply?.id))
  }

  function remove() {
    if (!supply) return
    Alert.alert(t('Apagar produto'), t('Apagar {name} do estoque?', { name: supply.name }), [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Apagar'), style: 'destructive', onPress: () => { removeSupply(farmId, supply.id); router.back() } },
    ])
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t(supply ? 'Editar produto' : 'Cadastrar produto') }} />
      <Field label="Nome" value={name} onChangeText={setName} autoFocus={!supply} placeholder="Ex.: Ração 22% proteína" />
      <SelectField label="Categoria" value={category} options={SUPPLY_CATEGORIES.map(c => ({ value: c, label: c }))} onChange={setCategory} />
      <SelectField label="Unidade" value={unit} options={UNITS.map(u => ({ value: u, label: u }))} onChange={setUnit} />
      {!supply ? <Field label="Quantidade atual" value={current} onChangeText={setCurrent} keyboardType="decimal-pad" /> : null}
      <Field label="Quantidade mínima (avisa quando está acabando)" value={minimum} onChangeText={setMinimum} keyboardType="decimal-pad" />
      <Field label="Kg por unidade (opcional, para sacos)" value={packageKg} onChangeText={setPackageKg} keyboardType="decimal-pad" />
      <Field label="Preço por unidade (R$, opcional)" value={unitPrice} onChangeText={setUnitPrice} keyboardType="decimal-pad" />
      <DateField label="Validade (opcional)" value={expiry} onChange={setExpiry} allowEmpty />
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
  const t = useT()
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
      <Field label={`${t('Quantidade')} (${t(supply.unit)})`} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" autoFocus />
      <DateField label="Data" value={date} onChange={setDate} />
      <Field label="Descrição (opcional)" value={description} onChangeText={setDescription} placeholder="Ex.: trato das vacas em lactação" />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Salvar" onPress={save} />
      <Button label="Cancelar" variant="ghost" onPress={onDone} style={{ marginTop: space.sm }} />
    </Screen>
  )
}

/** Validade: vencido em vermelho, vencendo em até 30 dias em laranja */
function ExpiryLine({ supply }: { supply: Supply }) {
  const t = useT()
  if (!supply.expiryDate) return null
  const days = daysToExpiry(supply, todayISO()) ?? 0
  const color = days < 0 ? colors.red : days <= EXPIRY_WARNING_DAYS ? colors.amber : colors.muted
  return <Text style={{ color, fontSize: font.sm, fontWeight: days <= EXPIRY_WARNING_DAYS ? '700' : '400' }}>{t(days < 0 ? 'Venceu em {date}' : 'Validade: {date}', { date: brDate(supply.expiryDate) })}</Text>
}
