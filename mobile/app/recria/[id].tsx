import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate, brNumber, isoDay, todayISO } from '@/lib/format'
import { decimal, parseKg, toField } from '@/lib/lots'
import { isInRearing, rearingEntryError, rearingSummary } from '@/lib/rearing'
import type { HerdAnimal } from '@/repos/lots'
import { addRearingWeighing, eligibleForRearing, enterRearing, getRearing, isPendingWeighing, removeRearingWeighing, setRearingEnd, setRearingTarget, type RearingRow } from '@/repos/rearing'
import { Badge, Button, Card, DateField, Field, Muted, Notice, Screen, Search } from '@/ui'
import { Section, StatGrid, TextButton, coverageLine, kg, plural, tag } from '@/ui/lots'
import { colors, font, radius, space } from '@/theme'

/** Recria um a um: "Acompanhar um animal" (id = novo) ou a ficha de um animal (porte de RearingAnimals.tsx do site) */
export default function RecriaScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const farmId = useFarmId()
  const { canEdit, canAccess } = useSession()
  const today = todayISO()
  const isNew = !id || id === 'novo'
  const animal = useLive(() => (isNew ? null : getRearing(id)), [id])

  if (isNew) return <AddScreen farmId={farmId} canEdit={canEdit} today={today} />
  if (!animal || !animal.rearingStart) return <Screen><Stack.Screen options={{ title: 'Recria' }} /><Notice text="Animal não encontrado na recria." /></Screen>
  return <RearingDetail animal={animal} farmId={farmId} today={today} canEdit={canEdit} canBreed={canEdit && canAccess('reproducao')} />
}

// ── Ficha da recria ─────────────────────────────────────────────────────

function RearingDetail({ animal, farmId, today, canEdit, canBreed }: { animal: RearingRow; farmId: string; today: string; canEdit: boolean; canBreed: boolean }) {
  const router = useRouter()
  const s = rearingSummary(animal, today)
  const inRearing = isInRearing(animal)
  const [date, setDate] = useState(today)
  const [weight, setWeight] = useState('')
  const [target, setTarget] = useState(toField(animal.rearingTarget))
  const [endDate, setEndDate] = useState(today)
  const [error, setError] = useState('')
  const weighings = [...animal.weighings].reverse()

  function saveWeighing() {
    const w = parseKg(weight)
    if (w === null || w > 2000) return setError('Informe o peso em kg, por exemplo 180')
    if (date > today) return setError('Informe a data da pesagem (até hoje)')
    if (date < animal.birthDate) return setError('A pesagem não pode ser antes do nascimento')
    setError('')
    addRearingWeighing(farmId, animal.id, { date, weight: w })
    setWeight('')
    setDate(today)
  }
  const removeWeighing = (w: { id?: string; date: string; weight: number }) => {
    if (!w.id) return
    Alert.alert(`Apagar a pesagem de ${brDate(w.date)} (${kg(w.weight)})?`, undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => removeRearingWeighing(farmId, animal.id, w.id!) },
    ])
  }
  function saveTarget() {
    const n = target.trim() ? parseKg(target) : null
    if (target.trim() && (n === null || n > 2000)) return setError('Peso-alvo inválido: use kg, por exemplo 320')
    setError('')
    setRearingTarget(farmId, animal.id, n)
  }
  function leave() {
    if (endDate > today) return setError('A saída não pode ser no futuro')
    if (endDate < animal.rearingStart!) return setError('A saída não pode ser antes da entrada')
    Alert.alert(`${animal.name} sai da recria?`, 'Use quando vendeu, foi para a engorda ou virou matriz. O histórico fica guardado.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair da recria', onPress: () => { setError(''); setRearingEnd(farmId, animal.id, endDate) } },
    ])
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: `${tag(animal)} ${animal.name}` }} />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{tag(animal)} {animal.name}</Text>
            <Muted>{animal.species} · {s.months} meses · desmama em {brDate(animal.rearingStart)}{animal.rearingEnd ? ` · saiu em ${brDate(animal.rearingEnd)}` : ''}</Muted>
          </View>
          <Badge label={inRearing ? 'Recria' : 'Saiu da recria'} tone={inRearing ? 'blue' : 'muted'} />
        </View>
        <View style={{ marginTop: space.md }}>
          <StatGrid items={[
            { title: 'Na desmama', value: s.entry ? kg(s.entry.weight) : '—' },
            { title: 'Último peso', value: s.last ? kg(s.last.weight) : '—' },
            { title: 'Ganho', value: s.gainKg !== null ? kg(s.gainKg) : '—', tone: 'green' },
            { title: 'Ganho/dia', value: s.gmd !== null ? `${brNumber(s.gmd, 3)} kg` : '—', tone: 'green' },
          ]} />
        </View>
        {s.projection ? <Text style={{ marginTop: space.sm, color: colors.text, fontSize: font.sm }}>No ritmo atual chega a {kg(animal.rearingTarget!)} em <Text style={{ fontWeight: '700' }}>{plural(s.projection.days, 'dia', 'dias')}</Text> ({brDate(s.projection.date)}).</Text> : null}
        <TextButton label="Abrir a ficha do animal" onPress={() => router.push(`/animais/${animal.id}`)} />
      </Card>

      {error ? <Notice tone="red" text={error} /> : null}

      {canEdit && inRearing ? (
        <Section title="Pesar">
          <View style={{ backgroundColor: colors.greenSoft, borderRadius: radius.md, padding: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <View style={{ flex: 1 }}><DateField label="Data" value={date} onChange={setDate} /></View>
              <Field label="Peso (kg)" value={weight} onChangeText={v => setWeight(decimal(v))} keyboardType="decimal-pad" placeholder={s.last ? `Antes: ${brNumber(s.last.weight, 0)}` : 'Ex.: 200'} style={{ flex: 1 }} />
            </View>
            <Button label="Salvar pesagem" onPress={saveWeighing} />
          </View>
        </Section>
      ) : null}

      {weighings.length > 0 ? (
        <Section title="Pesagens">
          <Card style={{ paddingVertical: 4 }}>
            {weighings.map((w, i) => {
              const before = weighings[i + 1]
              const pending = isPendingWeighing(w.id)
              return (
                <View key={w.id ?? `${w.date}-${w.weight}`} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                  <Text style={{ flex: 1, color: colors.text }}>{brDate(w.date)}{w.lotWeighingId ? <Muted> lote</Muted> : null}</Text>
                  <Text style={{ fontWeight: '700', color: colors.text }}>{kg(w.weight)}</Text>
                  {before ? <Muted>{w.weight - before.weight >= 0 ? '+' : ''}{brNumber(w.weight - before.weight)} kg</Muted> : null}
                  {pending ? <Badge label="na fila" tone="amber" /> : canEdit && w.id && !w.lotWeighingId ? <TextButton label="Apagar" tone="red" onPress={() => removeWeighing(w)} /> : null}
                </View>
              )
            })}
          </Card>
        </Section>
      ) : null}

      {canEdit && inRearing ? (
        <Section title={animal.gender === 'Fêmea' ? 'Peso-alvo para a primeira cobertura' : 'Peso-alvo para sair da recria'}>
          <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' }}>
            <Field label="Peso-alvo em kg" value={target} onChangeText={v => setTarget(decimal(v))} keyboardType="decimal-pad" placeholder={animal.gender === 'Fêmea' ? 'Ex.: 320' : 'Ex.: 360'} style={{ flex: 1, marginBottom: 0 }} />
            <Button label="Salvar" variant="secondary" onPress={saveTarget} disabled={target === toField(animal.rearingTarget)} />
          </View>
        </Section>
      ) : null}

      {inRearing && animal.gender === 'Fêmea' ? (
        <Section title="Cobertura da novilha">
          <Card>
            <Text style={{ color: colors.text }}>{coverageLine(animal.reproductions[0])}</Text>
            {canBreed ? <TextButton label={animal.reproductions[0] ? 'Nova cobertura' : 'Registrar cobertura'} onPress={() => router.push({ pathname: '/reproducao/[id]', params: { id: 'nova', femaleId: animal.id } })} /> : null}
          </Card>
        </Section>
      ) : null}

      {canEdit ? (
        <View style={{ marginTop: space.xl, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.lg }}>
          {inRearing ? (
            <View>
              <DateField label="Data de saída" value={endDate} onChange={setEndDate} />
              <Button label="Sair da recria" variant="secondary" onPress={leave} />
            </View>
          ) : <Button label="Voltar para a recria" variant="secondary" onPress={() => setRearingEnd(farmId, animal.id, null)} />}
          <Muted style={{ marginTop: space.sm }}>Para engordar em grupo, crie um lote de engorda com este animal: ele sai da recria sozinho.</Muted>
        </View>
      ) : null}
    </Screen>
  )
}

// ── Acompanhar um animal ────────────────────────────────────────────────

function AddScreen({ farmId, canEdit, today }: { farmId: string; canEdit: boolean; today: string }) {
  const [q, setQ] = useState('')
  const [chosen, setChosen] = useState<HerdAnimal | null>(null)
  const eligible = useLive(() => eligibleForRearing(farmId, today), [farmId, today])
  const term = q.trim().toLowerCase()
  const list = eligible.filter(a => !term || [a.code, a.customCode, a.name, a.species].some(v => v?.toLowerCase().includes(term)))

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Acompanhar um animal' }} />
      <Muted style={{ marginBottom: space.md }}>Bezerros, bezerras e bois jovens que não estão em lote</Muted>
      {!canEdit ? <Notice tone="red" text="Sua conta só pode consultar." /> : null}
      {chosen ? <RearingEntryForm animal={chosen} farmId={farmId} today={today} canEdit={canEdit} onCancel={() => setChosen(null)} /> : eligible.length === 0 ? (
        <Muted style={{ padding: space.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md }}>Nenhum animal disponível: cadastre o bezerro em Animais (ou registre a cria na ficha da vaca) e volte aqui.</Muted>
      ) : (
        <View>
          <Search value={q} onChange={setQ} placeholder="Buscar por brinco, nome ou categoria" />
          <Card style={{ paddingVertical: 4 }}>
            {list.map(a => (
              <Pressable key={a.id} onPress={() => setChosen(a)} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: pressed ? 0.6 : 1 })}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: colors.text, fontSize: font.md }}><Text style={{ fontWeight: '700' }}>{tag(a)}</Text> {a.name}</Text>
                  <Muted>{a.species}</Muted>
                </View>
                <Text style={{ color: colors.blue, fontWeight: '700', fontSize: font.sm }}>Escolher</Text>
              </Pressable>
            ))}
            {list.length === 0 ? <Muted style={{ paddingVertical: space.md }}>Nenhum animal encontrado.</Muted> : null}
          </Card>
        </View>
      )}
    </Screen>
  )
}

/** "Entrar na recria": data da desmama, peso na desmama e peso-alvo (porte de src/components/RearingEntryForm.tsx) */
function RearingEntryForm({ animal, farmId, today, canEdit, onCancel }: { animal: HerdAnimal; farmId: string; today: string; canEdit: boolean; onCancel: () => void }) {
  const router = useRouter()
  const [start, setStart] = useState(today)
  const [weight, setWeight] = useState('')
  const [target, setTarget] = useState('')
  const [error, setError] = useState('')
  const kgOf = (v: string) => (v.trim() ? parseKg(v) ?? NaN : null)

  function submit() {
    const w = kgOf(weight)
    const t = kgOf(target)
    const ruleError = rearingEntryError({ start, birthDate: isoDay(animal.birthDate), today, weight: w, target: t })
    if (ruleError) return setError(ruleError)
    enterRearing(farmId, animal.id, { start, weight: w, target: t })
    router.replace(`/recria/${animal.id}`)
  }

  return (
    <View style={{ backgroundColor: colors.blueSoft, borderRadius: radius.md, padding: space.md }}>
      <Text style={{ color: colors.text, marginBottom: space.md }}><Text style={{ fontWeight: '700' }}>{animal.name}</Text> entra na recria. A partir daqui o app acompanha o peso, o ganho por dia{animal.gender === 'Fêmea' ? ' e a cobertura' : ''}.</Text>
      <DateField label="Data da desmama" value={start} onChange={setStart} />
      <Field label="Peso na desmama (kg)" value={weight} onChangeText={v => setWeight(decimal(v))} keyboardType="decimal-pad" placeholder="Ex.: 180" />
      <Field label="Peso-alvo (kg, opcional)" value={target} onChangeText={v => setTarget(decimal(v))} keyboardType="decimal-pad" placeholder={animal.gender === 'Fêmea' ? 'Ex.: 320 para cobrir' : 'Ex.: 360 para a engorda'} />
      {error ? <Notice tone="red" text={error} /> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Cancelar" variant="secondary" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Entrar na recria" onPress={submit} disabled={!canEdit} style={{ flex: 1 }} />
      </View>
      <Muted style={{ marginTop: space.sm }}>Sem internet, fica guardado no aparelho e sobe quando o sinal voltar.</Muted>
    </View>
  )
}
