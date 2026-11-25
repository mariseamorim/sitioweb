import { Stack } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { NetworkError } from '@/api/client'
import { useSession } from '@/auth/session'
import { brDate, brNumber, parseNumber, todayISO } from '@/lib/format'
import { CATTLE_BREEDS } from '@/lib/animalRules'
import { VET_SUPPLY_KINDS } from '@/lib/vetSupplyKinds'
import { Badge, Button, Card, Chips, DateField, Empty, Field, Muted, Notice, Screen, SelectField } from '@/ui'
import { moveVetSupply, removeVetSupply, saveVetSupply, useVetStock, type VetSupply } from '@/vet/stock'
import { colors, font, space } from '@/theme'
import { useT } from '@/lib/i18n'

// Meu estoque (veterinário): medicamentos, sêmen e material dele, separados do estoque das fazendas
// (como Consultoria › Meu estoque do site). O sêmen guarda touro, raça e partida e aparece na cobertura.

type Mode = { kind: 'list' } | { kind: 'item'; item?: VetSupply } | { kind: 'move'; item: VetSupply; type: 'entrada' | 'saida' }

export default function MeuEstoque() {
  const t = useT()
  const { user } = useSession()
  const { items, offline, reload } = useVetStock(true)
  const [mode, setMode] = useState<Mode>({ kind: 'list' })
  const [error, setError] = useState('')
  const fail = (e: unknown) => setError(e instanceof NetworkError ? t('Sem internet: o estoque do veterinário precisa de conexão para mudar.') : e instanceof Error ? t(e.message) : t('Não foi possível salvar.'))

  if (mode.kind === 'item') { const it = mode.item; return <ItemForm item={it} onRemove={it ? () => remove(it) : undefined} onDone={() => { setMode({ kind: 'list' }); void reload() }} /> }
  if (mode.kind === 'move') return <MoveForm item={mode.item} type={mode.type} farms={user?.farms?.map(f => f.name) ?? []} onDone={() => { setMode({ kind: 'list' }); void reload() }} />

  function remove(s: VetSupply) {
    Alert.alert(t('Apagar item'), t('Apagar {name} e o histórico dele?', { name: s.name }), [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Apagar'), style: 'destructive', onPress: () => { removeVetSupply(s.id).then(() => { setMode({ kind: 'list' }); return reload() }).catch(e => { setMode({ kind: 'list' }); fail(e) }) } },
    ])
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('Meu estoque') }} />
      <Muted style={{ marginBottom: space.md }}>{t('Medicamentos, sêmen e material do veterinário')}</Muted>
      {offline ? <Notice text={t('Sem internet: mostrando o estoque da última vez que carregou.')} /> : null}
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Novo item" icon="add" onPress={() => { setError(''); setMode({ kind: 'item' }) }} style={{ marginBottom: space.md }} />
      {!items.length ? <Empty title="Nenhum item ainda" text="Cadastre o sêmen e os medicamentos que você leva para as fazendas." /> : items.map(s => {
        const low = s.minimum !== null && s.quantity <= s.minimum
        return (
          <Card key={s.id}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: font.md, fontWeight: '700', color: colors.text }}>{s.name}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: 4 }}>
                  <Badge label={VET_SUPPLY_KINDS.find(k => k.key === s.kind)?.label ?? 'Outro'} tone="amber" />
                  {low ? <Badge label="Repor" tone="red" /> : null}
                </View>
                {s.kind === 'semen' && (s.bullName || s.bullBreed || s.semenBatch) ? <Muted>{[s.bullName, s.bullBreed, s.semenBatch ? `${t('partida')} ${s.semenBatch}` : null].filter(Boolean).join(' · ')}</Muted> : null}
                {s.expiry ? <Muted>{t('validade {date}', { date: brDate(s.expiry) })}</Muted> : null}
              </View>
              <Text style={{ fontSize: 24, fontWeight: '800', color: s.quantity <= 0 ? colors.red : colors.text }}>{brNumber(s.quantity, 0)} <Text style={{ fontSize: font.sm, color: colors.muted, fontWeight: '400' }}>{s.unit}</Text></Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md }}>
              <Button label="Saída (usei)" onPress={() => { setError(''); setMode({ kind: 'move', item: s, type: 'saida' }) }} style={{ flexGrow: 1 }} />
              <Button label="Entrada" variant="secondary" onPress={() => { setError(''); setMode({ kind: 'move', item: s, type: 'entrada' }) }} style={{ flexGrow: 1 }} />
              <Button label="Editar" variant="ghost" onPress={() => { setError(''); setMode({ kind: 'item', item: s }) }} />
            </View>
          </Card>
        )
      })}
    </Screen>
  )
}

function ItemForm({ item, onDone, onRemove }: { item?: VetSupply; onDone: () => void; onRemove?: () => void }) {
  const t = useT()
  const [kind, setKind] = useState(item?.kind ?? 'semen')
  const [name, setName] = useState(item?.name ?? '')
  const [bullName, setBullName] = useState(item?.bullName ?? '')
  const [bullBreed, setBullBreed] = useState<string | null>(item?.bullBreed ?? null)
  const [semenBatch, setSemenBatch] = useState(item?.semenBatch ?? '')
  const [unit, setUnit] = useState(item?.unit ?? 'doses')
  const [quantity, setQuantity] = useState('')
  const [minimum, setMinimum] = useState(item?.minimum !== null && item?.minimum !== undefined ? String(item.minimum) : '')
  const [expiry, setExpiry] = useState(item?.expiry?.slice(0, 10) ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    if (!name.trim()) { setError(t('Informe o nome do item')); return }
    setBusy(true)
    try {
      await saveVetSupply({ name, kind, bullName, bullBreed, semenBatch, unit, quantity: parseNumber(quantity) ?? 0, minimum: parseNumber(minimum), expiry: expiry || null }, item?.id)
      onDone()
    } catch (e) {
      setError(e instanceof NetworkError ? t('Sem internet: o estoque do veterinário precisa de conexão para mudar.') : e instanceof Error ? t(e.message) : t('Não foi possível salvar.'))
    } finally { setBusy(false) }
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: t(item ? 'Editar item' : 'Novo item') }} />
      <Chips options={VET_SUPPLY_KINDS.map(k => ({ value: k.key, label: k.label }))} value={kind} onChange={k => { setKind(k); if (!item) setUnit(VET_SUPPLY_KINDS.find(x => x.key === k)?.unit ?? 'un') }} />
      <Field label="Nome" value={name} onChangeText={setName} placeholder={t(kind === 'semen' ? 'Ex.: Sêmen Netuno FIV' : 'Ex.: Ocitocina 50 ml')} />
      {kind === 'semen' ? (
        <>
          <Field label="Touro" value={bullName} onChangeText={setBullName} placeholder="Ex.: Netuno FIV" />
          <SelectField label="Raça do touro" value={bullBreed} options={CATTLE_BREEDS.map(b => ({ value: b, label: b }))} onChange={setBullBreed} allowEmpty />
          <Field label="Partida" value={semenBatch} onChangeText={setSemenBatch} placeholder="Ex.: 2412-A" />
          <Muted style={{ marginBottom: space.md }}>{t('Na cobertura, escolha este sêmen: o touro, a raça e a partida já entram e o estoque desconta 1 dose.')}</Muted>
        </>
      ) : null}
      <Field label="Unidade" value={unit} onChangeText={setUnit} placeholder={t('un, ml, dose, frasco')} />
      {!item ? <Field label="Quantidade que tenho" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" placeholder="Ex.: 10" /> : null}
      <Field label="Avisar abaixo de" value={minimum} onChangeText={setMinimum} keyboardType="decimal-pad" placeholder="Ex.: 3" />
      <DateField label="Validade" value={expiry} onChange={setExpiry} allowEmpty />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Salvar" onPress={() => void save()} loading={busy} />
      <Button label="Cancelar" variant="ghost" onPress={onDone} style={{ marginTop: space.sm }} />
      {onRemove ? <Button label="Apagar item" variant="destructive" icon="trash-outline" onPress={onRemove} style={{ marginTop: space.xl }} /> : null}
    </Screen>
  )
}

function MoveForm({ item, type, farms, onDone }: { item: VetSupply; type: 'entrada' | 'saida'; farms: string[]; onDone: () => void }) {
  const t = useT()
  const [quantity, setQuantity] = useState('')
  const [date, setDate] = useState(todayISO())
  const [farmName, setFarmName] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function save() {
    const q = parseNumber(quantity)
    if (!q || q <= 0) { setError(t('Informe a quantidade')); return }
    setBusy(true)
    try {
      await moveVetSupply(item.id, { type, quantity: q, date, farmName: farmName ?? undefined, note: note.trim() || undefined })
      onDone()
    } catch (e) {
      setError(e instanceof NetworkError ? t('Sem internet: o estoque do veterinário precisa de conexão para mudar.') : e instanceof Error ? t(e.message) : t('Não foi possível salvar.'))
    } finally { setBusy(false) }
  }
  return (
    <Screen>
      <Stack.Screen options={{ title: t(type === 'saida' ? 'Saída do estoque' : 'Entrada no estoque') }} />
      <Card style={{ backgroundColor: colors.amberSoft, borderColor: colors.amber }}>
        <Text style={{ fontWeight: '700', color: colors.text }}>{item.name}</Text>
        <Muted>{t('Saldo: {n} {unit}', { n: brNumber(item.quantity, 0), unit: item.unit })}</Muted>
      </Card>
      <Field label={`${t('Quantidade')} (${item.unit})`} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" autoFocus />
      <DateField label="Data" value={date} onChange={setDate} />
      {type === 'saida' && farms.length ? <SelectField label="Propriedade onde usei" value={farmName} options={farms.map(f => ({ value: f, label: f }))} onChange={setFarmName} allowEmpty /> : null}
      <Field label="Observação" value={note} onChangeText={setNote} placeholder={t('Ex.: vaca Mimosa')} />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Salvar" onPress={() => void save()} loading={busy} />
      <Button label="Cancelar" variant="ghost" onPress={onDone} style={{ marginTop: space.sm }} />
    </Screen>
  )
}
