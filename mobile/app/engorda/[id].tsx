import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate, brMoney, brNumber, todayISO } from '@/lib/format'
import {
  LIVE_KG_PER_ARROBA, STOCK_WARNING_DAYS, animalGain, arrobasProduced, dailySupplyKg, daysBetween, decimal, feedingSummary, kgInStockUnit, lotSummary,
  parseKg, pricePerKg, projectTarget, toField,
} from '@/lib/lots'
import {
  addFeeding, addWeighing, editFeeding, editWeighing, getLot, isPending, listHerd, listLots, openLotNames, patchLot, productLines, removeFeeding, removeLot,
  removeWeighing, supplyRef, type Lot, type LotAnimal, type SupplyRef,
} from '@/repos/lots'
import { listSupplies } from '@/repos/supplies'
import { Badge, Button, Card, DateField, Field, Muted, Notice, Screen, SelectField } from '@/ui'
import {
  AnimalPicker, OptionCards, ProductsEditor, Section, StatGrid, TextButton, WeightList, averageOf, coverageLine, kg, numericWeights, parseProducts, phaseLabel, plural,
  productsFromLot, tag, type ProductForm,
} from '@/ui/lots'
import { colors, font, radius, space } from '@/theme'

interface SectionProps { lot: Lot; farmId: string; canEdit: boolean; today: string; fail: (message: string) => void }

/** Detalhe do lote (porte de src/app/engorda/LotDetail.tsx do site; sem o gráfico) */
export default function LoteScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>()
  const farmId = useFarmId()
  const { canEdit, canAccess } = useSession()
  const router = useRouter()
  const today = todayISO()
  const lot = useLive(() => getLot(id), [id])
  const [editingLot, setEditingLot] = useState(false)
  const [error, setError] = useState('')

  if (!lot) return <Screen><Stack.Screen options={{ title: 'Lote' }} /><Notice text="Lote não encontrado." /></Screen>

  const s = lotSummary(lot.weighings, today, lot.endDate)
  const isRecria = lot.phase === 'recria'
  const arrobas = isRecria ? null : arrobasProduced(s)
  const hasAnimals = lot.animals.length > 0
  const females = lot.animals.filter(a => a.gender === 'Fêmea')
  const props: SectionProps = { lot, farmId, canEdit, today, fail: setError }
  const open = !lot.endDate

  const closeLot = (endDate: string) => {
    Alert.alert(`Encerrar o lote ${lot.name}?`, 'Use quando o lote sair: vendido, abatido ou mudou de fase. Ele fica guardado em Encerrados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Encerrar', onPress: () => patchLot(farmId, lot, { endDate }) },
    ])
  }
  const remove = () => {
    Alert.alert(`Excluir o lote ${lot.name}?`, 'As pesagens também serão apagadas e os animais saem do lote. Para guardar o histórico, prefira encerrar o lote.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { removeLot(farmId, lot); router.back() } },
    ])
  }

  const weighingForm = canEdit && open ? <WeighingForm {...props} autoFocus={focus === 'pesar'} /> : null

  return (
    <Screen>
      <Stack.Screen options={{ title: lot.name }} />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{lot.name}</Text>
            <Muted>{phaseLabel(lot.phase)} · entrada em {brDate(lot.startDate)}{lot.endDate ? ` · saiu em ${brDate(lot.endDate)}` : ''}</Muted>
          </View>
          <Badge label={lot.endDate ? 'Encerrado' : phaseLabel(lot.phase)} tone={lot.endDate ? 'muted' : isRecria ? 'blue' : 'amber'} />
        </View>
        {lot.notes ? <Text style={{ marginTop: space.sm, color: colors.text }}>{lot.notes}</Text> : null}
        {canEdit ? (editingLot
          ? <LotEditForm lot={lot} farmId={farmId} onDone={() => setEditingLot(false)} />
          : <TextButton label="Editar lote (nome, fase, data de entrada)" onPress={() => setEditingLot(true)} />) : null}
      </Card>

      <StatGrid items={[
        { title: 'Entrada', value: s.entry ? kg(s.entry.avgWeight) : '—' },
        { title: 'Última pesagem', value: s.last ? kg(s.last.avgWeight) : '—' },
        { title: 'Ganho por cabeça', value: s.gainKg !== null ? kg(s.gainKg) : '—' },
        { title: 'Ganho por dia', value: s.gmd !== null ? `${brNumber(s.gmd, 3)} kg` : '—', tone: 'green' },
        ...(isRecria ? [] : [{ title: '@ produzidas', value: arrobas !== null ? brNumber(arrobas) : '—' }]),
      ]} />
      <Muted style={{ marginTop: space.sm }}>
        {hasAnimals ? lot.animals.length : s.last?.headCount ?? 0} cabeças · {plural(s.days, 'dia', 'dias')} no lote
        {arrobas !== null ? ` · arrobas estimadas pelo peso vivo (${LIVE_KG_PER_ARROBA} kg = 1 @, rendimento de 50%)` : ''}
      </Muted>

      {focus === 'pesar' ? weighingForm : null}

      <TargetSection {...props} />

      {isRecria && females.length > 0 ? <ReproductionSection females={females} today={today} canBreed={canEdit && open && canAccess('reproducao')} /> : null}

      {focus !== 'pesar' ? weighingForm : null}

      <AnimalsSection {...props} startAdding={focus === 'animais'} />
      <ProductsSection {...props} />
      {lot.supplies.length > 0 ? <FeedingSection {...props} /> : null}
      <WeighingHistory {...props} />

      {error ? <View style={{ marginTop: space.md }}><Notice tone="red" text={error} /></View> : null}

      {canEdit ? <LotFooter lot={lot} today={today} onClose={closeLot} onReopen={() => patchLot(farmId, lot, { endDate: null })} onRemove={remove} /> : null}
    </Screen>
  )
}

// ── Encerrar, reabrir e excluir ─────────────────────────────────────────

function LotFooter({ lot, today, onClose, onReopen, onRemove }: { lot: Lot; today: string; onClose: (endDate: string) => void; onReopen: () => void; onRemove: () => void }) {
  const [endDate, setEndDate] = useState(today)
  return (
    <View style={{ marginTop: space.xl, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.lg }}>
      {lot.endDate ? <Button label="Reabrir lote" variant="secondary" onPress={onReopen} /> : (
        <View>
          <DateField label="Data de saída" value={endDate} onChange={setEndDate} />
          <Button label="Encerrar lote" variant="secondary" onPress={() => {
            if (endDate > today) return Alert.alert('Data de saída', 'A saída não pode ser no futuro.')
            if (endDate < lot.startDate) return Alert.alert('Data de saída', 'A saída não pode ser antes da entrada.')
            onClose(endDate)
          }} />
        </View>
      )}
      <Button label="Excluir lote" variant="ghost" onPress={onRemove} style={{ marginTop: space.sm }} />
    </View>
  )
}

// ── Editar o lote ───────────────────────────────────────────────────────

function LotEditForm({ lot, farmId, onDone }: { lot: Lot; farmId: string; onDone: () => void }) {
  const today = todayISO()
  const [name, setName] = useState(lot.name)
  const [phase, setPhase] = useState<'recria' | 'engorda'>(lot.phase === 'recria' ? 'recria' : 'engorda')
  const [startDate, setStartDate] = useState(lot.startDate)
  const [notes, setNotes] = useState(lot.notes ?? '')
  const [error, setError] = useState('')
  function save() {
    if (!name.trim()) return setError('Dê um nome ao lote')
    if (startDate > today) return setError('A data de entrada não pode ser no futuro')
    patchLot(farmId, lot, { name, phase, startDate, notes })
    onDone()
  }
  return (
    <View style={{ marginTop: space.md }}>
      <Field label="Nome do lote" value={name} onChangeText={setName} />
      <OptionCards value={phase} onChange={setPhase} options={[{ value: 'recria', title: 'Recria' }, { value: 'engorda', title: 'Engorda' }]} />
      <DateField label="Data de entrada (a pesagem de entrada acompanha)" value={startDate} onChange={setStartDate} />
      <Field label="Observações" value={notes} onChangeText={setNotes} multiline />
      {error ? <Notice tone="red" text={error} /> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Cancelar" variant="secondary" onPress={onDone} style={{ flex: 1 }} />
        <Button label="Salvar" onPress={save} style={{ flex: 1 }} />
      </View>
    </View>
  )
}

// ── Peso-alvo e previsão ────────────────────────────────────────────────

function TargetSection({ lot, farmId, canEdit, today }: SectionProps) {
  const isRecria = lot.phase === 'recria'
  const s = lotSummary(lot.weighings, today, lot.endDate)
  const projection = lot.endDate ? null : projectTarget(s, lot.targetWeight)
  const [target, setTarget] = useState(toField(lot.targetWeight))
  const [error, setError] = useState('')
  const changed = target !== toField(lot.targetWeight)
  function save() {
    const n = target.trim() ? parseKg(target) : null
    if (target.trim() && (n === null || n > 2000)) return setError('Peso-alvo inválido')
    setError('')
    patchLot(farmId, lot, { targetWeight: n })
  }
  return (
    <Section title={isRecria ? 'Peso-alvo da recria' : 'Previsão de saída para o abate'}>
      <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
        <Field label={isRecria ? 'Peso desejado por cabeça (kg)' : 'Peso de saída desejado (kg)'} value={target} onChangeText={v => setTarget(decimal(v))} keyboardType="decimal-pad" placeholder={isRecria ? 'Ex.: 320' : 'Ex.: 540'} editable={canEdit} style={{ flex: 1, marginBottom: 0 }} />
        {canEdit && changed ? <Button label="Salvar" onPress={save} /> : null}
      </View>
      {error ? <View style={{ marginTop: space.sm }}><Notice tone="red" text={error} /></View> : null}
      {lot.targetWeight && s.last ? (
        s.last.avgWeight >= lot.targetWeight
          ? <View style={{ marginTop: space.sm }}><Notice tone="green" text={`O lote já chegou ao peso desejado (${kg(s.last.avgWeight)}).`} /></View>
          : projection
            ? <View style={{ marginTop: space.md }}><StatGrid items={[
                { title: 'Faltam', value: kg(projection.remainingKg), tone: 'amber' },
                { title: 'Dias restantes', value: String(projection.days), tone: 'amber' },
                { title: isRecria ? 'Chega em' : 'Previsão de saída', value: brDate(projection.date), tone: 'amber' },
              ]} /></View>
            : <Muted style={{ marginTop: space.sm }}>Faça mais uma pesagem para o app calcular o ganho por dia e prever quando chega.</Muted>
      ) : null}
    </Section>
  )
}

// ── Nova pesagem ────────────────────────────────────────────────────────

function WeighingForm({ lot, farmId, today, fail, autoFocus }: SectionProps & { autoFocus: boolean }) {
  const hasAnimals = lot.animals.length > 0
  const s = lotSummary(lot.weighings, today, lot.endDate)
  const [date, setDate] = useState(today)
  const [headCount, setHeadCount] = useState(String(s.last?.headCount ?? ''))
  const [avgWeight, setAvgWeight] = useState('')
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState(false)
  const previous = new Map(lot.animals.flatMap(a => { const w = a.weighings[a.weighings.length - 1]?.weight; return w === undefined ? [] : [[a.id, w] as const] }))
  const avg = averageOf(weights)

  function save() {
    if (date > today) return fail('A pesagem não pode ser no futuro')
    if (hasAnimals) {
      if (avg === null) return fail('Informe o peso de pelo menos um animal')
      addWeighing(farmId, lot, { date, weights: numericWeights(weights) })
      setWeights({})
    } else {
      const heads = Number(headCount)
      const w = parseKg(avgWeight)
      if (!Number.isInteger(heads) || heads < 1) return fail('Informe quantas cabeças tem o lote')
      if (w === null || w > 2000) return fail('Informe o peso médio por cabeça, em kg')
      addWeighing(farmId, lot, { date, headCount: heads, avgWeight: w })
      setAvgWeight('')
    }
    fail('')
    setSaved(true)
  }

  return (
    <Section title="Nova pesagem">
      <View style={{ backgroundColor: colors.greenSoft, borderRadius: radius.md, padding: space.md }}>
        <DateField label="Data" value={date} onChange={setDate} />
        {hasAnimals ? (
          <View>
            <WeightList animals={lot.animals} weights={weights} onChange={setWeights} previous={previous} />
            {avg !== null ? <Text style={{ marginTop: space.sm, color: colors.text }}>Peso médio desta pesagem: <Text style={{ fontWeight: '700' }}>{kg(avg)}</Text></Text> : null}
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Field label="Cabeças" value={headCount} onChangeText={v => setHeadCount(v.replace(/\D/g, ''))} keyboardType="number-pad" style={{ flex: 1 }} />
            <Field label="Peso médio (kg)" value={avgWeight} onChangeText={v => setAvgWeight(decimal(v))} keyboardType="decimal-pad" autoFocus={autoFocus} style={{ flex: 1 }} />
          </View>
        )}
        <Button label="Salvar pesagem" onPress={save} disabled={hasAnimals && avg === null} style={{ marginTop: space.sm }} />
        {saved ? <Muted style={{ textAlign: 'center', marginTop: space.sm }}>Pesagem salva no celular; aparece no histórico abaixo.</Muted> : null}
      </View>
    </Section>
  )
}

// ── Animais do lote ─────────────────────────────────────────────────────

function AnimalsSection({ lot, farmId, canEdit, startAdding }: SectionProps & { startAdding: boolean }) {
  const hasAnimals = lot.animals.length > 0
  const open = !lot.endDate
  const herd = useLive(() => listHerd(farmId), [farmId])
  const lotNames = useLive(() => openLotNames(listLots(farmId)), [farmId])
  const [adding, setAdding] = useState<string[] | null>(startAdding && canEdit && open ? [] : null)

  const removeAnimal = (a: LotAnimal) => {
    Alert.alert(`Tirar ${tag(a)} ${a.name} do lote?`, 'As pesagens dele continuam guardadas.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Tirar do lote', onPress: () => patchLot(farmId, lot, { removeAnimalIds: [a.id] }) },
    ])
  }

  if (!hasAnimals && !canEdit) return null
  return (
    <Section title="Animais do lote" right={canEdit && open && adding === null ? <TextButton label="+ Animais" onPress={() => setAdding([])} /> : undefined}>
      {adding !== null ? (
        <Card>
          <AnimalPicker herd={herd} lotNames={lotNames} exclude={lot.animals.map(a => a.id)} selected={adding} onChange={setAdding} />
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <Button label="Cancelar" variant="secondary" onPress={() => setAdding(null)} style={{ flex: 1 }} />
            <Button label="Pôr no lote" disabled={adding.length === 0} onPress={() => { patchLot(farmId, lot, { addAnimalIds: adding }); setAdding(null) }} style={{ flex: 1 }} />
          </View>
        </Card>
      ) : null}
      {hasAnimals ? (
        <Card style={{ paddingVertical: 4 }}>
          <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Muted style={{ flex: 1 }}>Animal</Muted>
            <Muted style={{ width: 64, textAlign: 'right' }}>Entrada</Muted>
            <Muted style={{ width: 64, textAlign: 'right' }}>Último</Muted>
            <Muted style={{ width: 64, textAlign: 'right' }}>Por dia</Muted>
          </View>
          {lot.animals.map(a => {
            // Ganho só desde a entrada neste lote (o animal pode ter vindo de outro)
            const g = animalGain(a.weighings.filter(w => w.date >= lot.startDate))
            return (
              <View key={a.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ flex: 1, color: colors.text }} numberOfLines={1}><Text style={{ fontWeight: '700' }}>{tag(a)}</Text> {a.name}</Text>
                  <Text style={{ width: 64, textAlign: 'right', color: colors.muted, fontSize: font.sm }}>{g.entry ? brNumber(g.entry.weight, 0) : '—'}</Text>
                  <Text style={{ width: 64, textAlign: 'right', color: colors.text, fontWeight: '600', fontSize: font.sm }}>{g.last ? brNumber(g.last.weight, 0) : '—'}</Text>
                  <Text style={{ width: 64, textAlign: 'right', color: colors.green, fontSize: font.sm }}>{g.gmd !== null ? brNumber(g.gmd, 3) : '—'}</Text>
                </View>
                {canEdit && open ? <View style={{ alignItems: 'flex-end' }}><TextButton label="Tirar" tone="muted" onPress={() => removeAnimal(a)} /></View> : null}
              </View>
            )
          })}
          <Muted style={{ marginTop: 6 }}>Pesos em kg; ganho por dia em kg por cabeça.</Muted>
        </Card>
      ) : adding === null ? <Muted>Este lote acompanha só a quantidade e o peso médio. Para pesar cada animal, ponha os animais cadastrados no lote.</Muted> : null}
    </Section>
  )
}

// ── Produtos do lote ────────────────────────────────────────────────────

function ProductsSection({ lot, farmId, canEdit, today, fail }: SectionProps) {
  const supplies = useLive(() => listSupplies(farmId).map(supplyRef), [farmId])
  const [editing, setEditing] = useState<ProductForm[] | null>(null)
  const lines = productLines(lot, today)
  function save() {
    const parsed = parseProducts(editing ?? [])
    if (typeof parsed === 'string') return fail(parsed)
    fail('')
    patchLot(farmId, lot, { supplies: parsed })
    setEditing(null)
  }
  return (
    <Section title="Produtos do lote">
      {editing ? (
        <View>
          <ProductsEditor supplies={supplies} value={editing} onChange={setEditing} />
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label="Cancelar" variant="secondary" onPress={() => setEditing(null)} style={{ flex: 1 }} />
            <Button label="Salvar produtos" onPress={save} style={{ flex: 1 }} />
          </View>
        </View>
      ) : (
        <Card>
          {lot.supplies.length === 0 ? <Muted>Nenhum produto ligado a este lote.</Muted> : lines.map(p => (
            <View key={p.id} style={{ marginBottom: space.sm }}>
              <Text style={{ color: colors.text }}><Text style={{ fontWeight: '700' }}>{p.supply.name}</Text>{p.percent ? ` a ${brNumber(p.percent, 2)}% do peso vivo` : ''}</Text>
              {p.perDay ? (
                <Text style={{ color: colors.muted, fontSize: font.sm }}>
                  {kg(p.perDay)} por dia para o lote{p.perHead !== null ? ` (${brNumber(p.perHead, 0)} g por cabeça)` : ''}.
                  {p.days !== null ? <Text style={p.days <= STOCK_WARNING_DAYS ? { fontWeight: '700', color: colors.amber } : undefined}> O estoque dá para {plural(p.days, 'dia', 'dias')}.</Text> : null}
                </Text>
              ) : <Muted>Informe o consumo em % do peso vivo para calcular quanto o lote come.</Muted>}
            </View>
          ))}
          {canEdit ? <TextButton label={lot.supplies.length ? 'Alterar produtos' : 'Ligar produtos'} onPress={() => setEditing(productsFromLot(lot))} /> : null}
        </Card>
      )}
    </Section>
  )
}

// ── Trato no cocho ──────────────────────────────────────────────────────

function FeedingSection({ lot, farmId, canEdit, today, fail }: SectionProps) {
  const s = lotSummary(lot.weighings, today, lot.endDate)
  const heads = lot.animals.length || s.last?.headCount || 0
  const summary = feedingSummary(lot.feedings, heads)
  const suggestionOf = (supplyId: string) => dailySupplyKg(s.last, lot.supplies.find(x => x.supply.id === supplyId)?.percent)
  const firstId = lot.supplies[0].supply.id
  const [date, setDate] = useState(today)
  const [supplyId, setSupplyId] = useState(firstId)
  const [kgText, setKgText] = useState(toField(suggestionOf(firstId)))
  const [editing, setEditing] = useState<{ id: string; date: string; kg: string } | null>(null)
  const supply: SupplyRef = lot.supplies.find(x => x.supply.id === supplyId)?.supply ?? lot.supplies[0].supply
  const suggestion = suggestionOf(supply.id)
  const kgValue = parseKg(kgText)
  const inStock = kgValue !== null ? kgInStockUnit(supply, kgValue) : null
  const perKg = pricePerKg(supply)
  const names = new Map(lot.supplies.map(x => [x.supply.id, x.supply.name]))
  const recent = [...lot.feedings].reverse().slice(0, 10)

  function save() {
    if (kgValue === null) return fail('Informe quantos kg foram dados')
    if (date > today) return fail('O trato não pode ser no futuro')
    const err = addFeeding(farmId, lot, { date, supplyId: supply.id, kg: kgValue }, today)
    fail(err ?? '')
  }
  function saveEdit() {
    if (!editing) return
    const n = parseKg(editing.kg)
    if (n === null) return fail('Informe quantos kg foram dados')
    editFeeding(farmId, lot, editing.id, { date: editing.date, kg: n })
    fail('')
    setEditing(null)
  }
  const remove = (id: string) => {
    Alert.alert('Apagar este trato?', 'A quantidade volta para o estoque.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => removeFeeding(farmId, lot, id) },
    ])
  }

  return (
    <Section title="Trato no cocho">
      {lot.feedings.length > 0 ? (
        <View style={{ marginBottom: space.sm }}>
          <StatGrid items={[
            { title: 'Dado no total', value: kg(summary.kg) },
            { title: 'Previsto x dado', value: summary.percent !== null ? `${brNumber(summary.percent, 0)}%` : '—' },
            { title: 'Custo total', value: summary.cost !== null ? brMoney(summary.cost) : '—' },
            { title: 'Custo por cabeça', value: summary.costPerHead !== null ? brMoney(summary.costPerHead) : '—' },
          ]} />
          <Muted style={{ marginTop: space.sm }}>
            {plural(summary.days, 'dia', 'dias')} de trato
            {summary.costPerHeadDay !== null ? ` · ${brMoney(summary.costPerHeadDay)} por cabeça por dia` : ''}
            {summary.cost === null ? ' · informe o preço dos produtos para ver o custo' : ''}
            {summary.partialCost ? ' · alguns tratos foram lançados antes do preço e ficaram sem custo' : ''}
          </Muted>
        </View>
      ) : null}
      {canEdit && !lot.endDate ? (
        <View style={{ backgroundColor: colors.amberSoft, borderRadius: radius.md, padding: space.md }}>
          {lot.supplies.length > 1 ? (
            <SelectField label="Produto" value={supplyId} options={lot.supplies.map(x => ({ value: x.supply.id, label: x.supply.name }))}
              onChange={id => { if (id) { setSupplyId(id); setKgText(toField(suggestionOf(id))) } }} />
          ) : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1 }}><DateField label="Data" value={date} onChange={setDate} /></View>
            <Field label="Quanto foi dado (kg)" value={kgText} onChangeText={v => setKgText(decimal(v))} keyboardType="decimal-pad" style={{ flex: 1 }} />
          </View>
          <Text style={{ fontSize: font.sm, color: colors.text, marginBottom: space.sm }}>
            {lot.supplies.length === 1 ? `${supply.name}. ` : ''}
            {suggestion ? `Sugestão pelo % do peso vivo: ${kg(suggestion)} por dia. ` : ''}
            {kgValue !== null && inStock !== null && supply.unit === 'sacos' ? `Sai do estoque: ${brNumber(inStock, 2)} ${inStock === 1 ? 'saco' : 'sacos'}. ` : ''}
            {kgValue !== null && perKg !== null ? `Custo: ${brMoney(kgValue * perKg)}.` : ''}
            {supply.unit === 'sacos' && !supply.packageKg ? ` Informe o peso do saco de ${supply.name} em Produtos do lote para dar baixa no estoque.` : ''}
          </Text>
          <Button label="Lançar trato e dar baixa no estoque" onPress={save} disabled={kgValue === null} />
        </View>
      ) : null}
      {recent.length > 0 ? (
        <Card style={{ marginTop: space.md, paddingVertical: 4 }}>
          {recent.map(f => editing?.id === f.id ? (
            <View key={f.id} style={{ backgroundColor: colors.amberSoft, borderRadius: radius.sm, padding: space.sm, marginVertical: 6 }}>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <View style={{ flex: 1 }}><DateField label="Data" value={editing.date} onChange={d => setEditing({ ...editing, date: d })} /></View>
                <Field label="Kg" value={editing.kg} onChangeText={v => setEditing({ ...editing, kg: decimal(v) })} keyboardType="decimal-pad" style={{ flex: 1 }} />
              </View>
              <View style={{ flexDirection: 'row', gap: space.sm }}>
                <Button label="Cancelar" variant="secondary" onPress={() => setEditing(null)} style={{ flex: 1 }} />
                <Button label="Salvar" onPress={saveEdit} disabled={parseKg(editing.kg) === null} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text }}>{brDate(f.date)}{lot.supplies.length > 1 && f.supplyId ? <Muted> {names.get(f.supplyId)}</Muted> : null}</Text>
                <Text style={{ color: colors.text }}><Text style={{ fontWeight: '700' }}>{kg(f.kg)}</Text>{f.cost !== null ? <Muted>  {brMoney(f.cost)}</Muted> : null}</Text>
              </View>
              {isPending(f.id) ? <Badge label="na fila" tone="amber" /> : canEdit ? (
                <View style={{ flexDirection: 'row', gap: space.md }}>
                  <TextButton label="Editar" onPress={() => setEditing({ id: f.id, date: f.date, kg: toField(f.kg) })} />
                  <TextButton label="Apagar" tone="red" onPress={() => remove(f.id)} />
                </View>
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}
    </Section>
  )
}

// ── Pesagens: histórico com editar e apagar ─────────────────────────────

function WeighingHistory({ lot, farmId, canEdit, today, fail }: SectionProps) {
  const hasAnimals = lot.animals.length > 0
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ date: '', headCount: '', avgWeight: '' })
  const [weights, setWeights] = useState<Record<string, string>>({})
  const rows = lot.weighings.map((w, i) => {
    const prev = lot.weighings[i - 1]
    const days = prev ? daysBetween(prev.date, w.date) : 0
    return { ...w, gmd: prev && days > 0 ? (w.avgWeight - prev.avgWeight) / days : null }
  }).reverse()

  const startEdit = (w: Lot['weighings'][number]) => {
    setEditing(w.id)
    setForm({ date: w.date, headCount: String(w.headCount), avgWeight: toField(w.avgWeight) })
    // Pesos de cada animal nesse dia
    setWeights(Object.fromEntries(lot.animals.flatMap(a => { const found = a.weighings.find(x => x.date === w.date); return found ? [[a.id, toField(found.weight)]] : [] })))
  }
  const save = (id: string) => {
    if (form.date > today) return fail('A pesagem não pode ser no futuro')
    if (hasAnimals) {
      const w = numericWeights(weights)
      if (!Object.keys(w).length) return fail('Informe o peso de pelo menos um animal')
      editWeighing(farmId, lot, id, { date: form.date, weights: w })
    } else {
      const heads = Number(form.headCount)
      const avg = parseKg(form.avgWeight)
      if (!Number.isInteger(heads) || heads < 1) return fail('Informe quantas cabeças tem o lote')
      if (avg === null || avg > 2000) return fail('Informe o peso médio por cabeça, em kg')
      editWeighing(farmId, lot, id, { date: form.date, headCount: heads, avgWeight: avg })
    }
    fail('')
    setEditing(null)
  }
  const remove = (id: string) => {
    Alert.alert('Apagar esta pesagem?', hasAnimals ? 'Os pesos de cada animal nesse dia também serão apagados.' : undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => removeWeighing(farmId, lot, id) },
    ])
  }

  return (
    <Section title="Pesagens">
      <Card style={{ paddingVertical: 4 }}>
        {rows.map((w, i) => {
          const isEntry = i === rows.length - 1
          if (editing === w.id) {
            return (
              <View key={w.id} style={{ backgroundColor: colors.greenSoft, borderRadius: radius.sm, padding: space.sm, marginVertical: 6 }}>
                <DateField label={`Data${isEntry ? ' (entrada do lote)' : ''}`} value={form.date} onChange={d => setForm({ ...form, date: d })} />
                {hasAnimals ? <WeightList animals={lot.animals} weights={weights} onChange={setWeights} /> : (
                  <View style={{ flexDirection: 'row', gap: space.sm }}>
                    <Field label="Cabeças" value={form.headCount} onChangeText={v => setForm({ ...form, headCount: v.replace(/\D/g, '') })} keyboardType="number-pad" style={{ flex: 1 }} />
                    <Field label="Peso médio (kg)" value={form.avgWeight} onChangeText={v => setForm({ ...form, avgWeight: decimal(v) })} keyboardType="decimal-pad" style={{ flex: 1 }} />
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
                  <Button label="Cancelar" variant="secondary" onPress={() => setEditing(null)} style={{ flex: 1 }} />
                  <Button label="Salvar" onPress={() => save(w.id)} style={{ flex: 1 }} />
                </View>
              </View>
            )
          }
          return (
            <View key={w.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                <Text style={{ flex: 1, color: colors.text }}>{brDate(w.date)}{isEntry ? <Muted> entrada</Muted> : null}</Text>
                <Muted>{w.headCount} cab.</Muted>
                <Text style={{ fontWeight: '700', color: colors.text }}>{kg(w.avgWeight)}</Text>
                {w.gmd !== null ? <Text style={{ color: colors.green, fontSize: font.sm }}>{brNumber(w.gmd, 3)}/dia</Text> : null}
              </View>
              {isPending(w.id) ? <View style={{ alignItems: 'flex-end', marginTop: 4 }}><Badge label="na fila" tone="amber" /></View> : canEdit ? (
                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: space.lg }}>
                  <TextButton label="Editar" onPress={() => startEdit(w)} />
                  {!isEntry ? <TextButton label="Apagar" tone="red" onPress={() => remove(w.id)} /> : null}
                </View>
              ) : null}
            </View>
          )
        })}
      </Card>
    </Section>
  )
}

// ── Recria: cobertura das novilhas (o registro é feito na tela Reprodução) ──

function ReproductionSection({ females, today, canBreed }: { females: LotAnimal[]; today: string; canBreed: boolean }) {
  const router = useRouter()
  const months = (birth: string) => Math.floor(daysBetween(birth, today) / 30.44)
  return (
    <Section title={females.length === 1 ? 'Reprodução da novilha' : 'Reprodução das novilhas'} hint="Registre o cio e a cobertura (inseminação ou monta natural). O parto previsto entra nos avisos e na tela Reprodução.">
      <Card style={{ paddingVertical: 4 }}>
        {females.map(f => (
          <View key={f.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.text }}><Text style={{ fontWeight: '700' }}>{tag(f)}</Text> {f.name} <Muted>{months(f.birthDate)} meses</Muted></Text>
              <Muted>{f.reproductions[0]?.heatDate ? `Cio em ${brDate(f.reproductions[0].heatDate)} · ` : ''}{f.reproductions[0] ? coverageLine(f.reproductions[0]) : 'Sem registro'}</Muted>
            </View>
            {canBreed ? <TextButton label={f.reproductions[0] ? 'Nova cobertura' : 'Registrar cobertura'} onPress={() => router.push({ pathname: '/reproducao/[id]', params: { id: 'nova', femaleId: f.id } })} /> : null}
          </View>
        ))}
      </Card>
    </Section>
  )
}
