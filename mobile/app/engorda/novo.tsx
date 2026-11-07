import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { todayISO } from '@/lib/format'
import { decimal, isLotPhase, parseKg } from '@/lib/lots'
import { createLot, listHerd, listLots, openLotNames, supplyRef } from '@/repos/lots'
import { listSupplies } from '@/repos/supplies'
import { Button, DateField, Field, Muted, Notice, Screen } from '@/ui'
import { AnimalPicker, OptionCards, ProductsEditor, WeightList, averageOf, kg, numericWeights, parseProducts, type ProductForm } from '@/ui/lots'
import { colors, space } from '@/theme'

/** Novo lote (porte do LotForm de src/app/engorda/page.tsx do site) */
export default function NovoLote() {
  const { phase: defaultPhase } = useLocalSearchParams<{ phase?: string }>()
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const today = todayISO()
  const herd = useLive(() => listHerd(farmId), [farmId])
  const supplies = useLive(() => listSupplies(farmId).map(supplyRef), [farmId])
  const lotNames = useLive(() => openLotNames(listLots(farmId)), [farmId])

  const [mode, setMode] = useState<'animais' | 'quantidade'>(herd.length ? 'animais' : 'quantidade')
  const [name, setName] = useState('')
  const [phase, setPhase] = useState<'recria' | 'engorda'>(isLotPhase(defaultPhase) ? defaultPhase : 'engorda')
  const [startDate, setStartDate] = useState(today)
  const [headCount, setHeadCount] = useState('')
  const [avgWeight, setAvgWeight] = useState('')
  const [targetWeight, setTargetWeight] = useState('')
  const [animalIds, setAnimalIds] = useState<string[]>([])
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [products, setProducts] = useState<ProductForm[]>([])
  const [error, setError] = useState('')
  const chosen = herd.filter(a => animalIds.includes(a.id))
  const chosenWeights = Object.fromEntries(animalIds.map(id => [id, weights[id] ?? '']))
  const avg = averageOf(chosenWeights)

  function save() {
    if (!name.trim()) return setError('Dê um nome ao lote')
    if (startDate > today) return setError('A data de entrada não pode ser no futuro')
    const target = targetWeight.trim() ? parseKg(targetWeight) : null
    if (targetWeight.trim() && (target === null || target > 2000)) return setError('Peso-alvo inválido')
    const parsedProducts = parseProducts(products)
    if (typeof parsedProducts === 'string') return setError(parsedProducts)
    const estimated = avgWeight.trim() ? parseKg(avgWeight) : null
    if (mode === 'animais') {
      if (!animalIds.length) return setError('Escolha os animais do lote')
      if (avg === null && !estimated) return setError('Informe o peso de entrada dos animais ou o peso médio do lote')
      const id = createLot(farmId, { name, phase, startDate, targetWeight: target, supplies: parsedProducts, animals: { ids: animalIds, weights: numericWeights(chosenWeights) }, avgWeight: estimated ?? undefined })
      router.replace(`/engorda/${id}`)
      return
    }
    const heads = Number(headCount)
    if (!Number.isInteger(heads) || heads < 1) return setError('Informe quantas cabeças tem o lote')
    if (!estimated || estimated > 2000) return setError('Informe o peso médio por cabeça, em kg')
    const id = createLot(farmId, { name, phase, startDate, targetWeight: target, supplies: parsedProducts, headCount: heads, avgWeight: estimated })
    router.replace(`/engorda/${id}`)
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Novo lote' }} />
      {!canEdit ? <Notice tone="red" text="Sua conta só pode consultar." /> : null}
      <Field label="Nome do lote" value={name} onChangeText={setName} placeholder="Ex.: Garrotes de julho" autoFocus />
      <OptionCards value={phase} onChange={setPhase} options={[{ value: 'recria', title: 'Recria' }, { value: 'engorda', title: 'Engorda' }]} />
      <DateField label="Data de entrada" value={startDate} onChange={setStartDate} />

      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 4 }}>Como você acompanha este lote?</Text>
      <OptionCards value={mode} onChange={setMode} options={[{ value: 'animais', title: 'Animais cadastrados', hint: 'Peso de cada um' }, { value: 'quantidade', title: 'Só a quantidade', hint: 'Peso médio do lote' }]} />

      {mode === 'animais' ? (
        <View style={{ marginBottom: space.md }}>
          <AnimalPicker herd={herd} lotNames={lotNames} selected={animalIds} onChange={setAnimalIds} />
          {chosen.length > 0 ? (
            <View style={{ marginTop: space.md }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 4 }}>Peso de entrada (opcional, mas é com ele que o app calcula o ganho de cada animal)</Text>
              <WeightList animals={chosen} weights={weights} onChange={setWeights} />
              {avg !== null
                ? <Text style={{ marginTop: space.sm, color: colors.text }}>Peso médio de entrada: <Text style={{ fontWeight: '700' }}>{kg(avg)}</Text></Text>
                : <Field label="Sem pesar agora? Informe o peso médio estimado (kg)" value={avgWeight} onChangeText={v => setAvgWeight(decimal(v))} keyboardType="decimal-pad" placeholder="Ex.: 250" style={{ marginTop: space.md }} />}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Field label="Cabeças" value={headCount} onChangeText={v => setHeadCount(v.replace(/\D/g, ''))} keyboardType="number-pad" style={{ flex: 1 }} />
          <Field label="Peso médio de entrada (kg)" value={avgWeight} onChangeText={v => setAvgWeight(decimal(v))} keyboardType="decimal-pad" placeholder="Ex.: 300" style={{ flex: 1 }} />
        </View>
      )}

      <Field label={phase === 'recria' ? 'Peso-alvo da recria por cabeça (kg, opcional)' : 'Peso de saída desejado por cabeça (kg, opcional)'} value={targetWeight} onChangeText={v => setTargetWeight(decimal(v))} keyboardType="decimal-pad" placeholder={phase === 'recria' ? 'Ex.: 320' : 'Ex.: 540'} />
      <ProductsEditor supplies={supplies} value={products} onChange={setProducts} />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Criar lote" onPress={save} disabled={!canEdit} />
      <Button label="Cancelar" variant="ghost" onPress={() => router.back()} style={{ marginTop: space.sm }} />
      <Muted style={{ textAlign: 'center', marginTop: space.sm }}>Sem internet, o lote fica guardado no celular e é enviado quando a conexão voltar.</Muted>
    </Screen>
  )
}
