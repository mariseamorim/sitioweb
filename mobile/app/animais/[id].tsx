import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Switch, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate, isoDay, todayISO } from '@/lib/format'
import { ACQUISITIONS, SPECIES, STATUSES, animalOptions, getAnimal, removeAnimal, saveAnimal } from '@/repos/animals'
import { listVaccinations, vaccStatus } from '@/repos/vaccinations'
import { listTreatments } from '@/repos/treatments'
import { Badge, Button, Card, DateField, Field, Muted, Notice, Row, Screen, SelectField } from '@/ui'
import { colors, space } from '@/theme'

export default function AnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const isNew = !id || id === 'novo'
  const animal = useLive(() => (isNew ? null : getAnimal(id)), [id])
  const [editing, setEditing] = useState(isNew)

  if (!isNew && !animal) return <Screen><Stack.Screen options={{ title: 'Animal' }} /><Notice text="Animal não encontrado." /></Screen>
  if (editing) return <AnimalForm farmId={farmId} animal={animal} onDone={(newId) => { if (isNew) router.replace(`/animais/${newId}`); else setEditing(false) }} canEdit={canEdit} />

  const vacc = listVaccinations(farmId).filter(v => v.animalId === animal!.id)
  const treats = listTreatments(farmId).filter(t => t.animalId === animal!.id)
  const a = animal!
  return (
    <Screen>
      <Stack.Screen options={{ title: a.name }} />
      <Card>
        <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{a.name}</Text>
        <Muted>{a.species} · {a.gender} · código {a.customCode || a.code}</Muted>
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
          <Badge label={a.status} tone={a.status === 'Vivo' ? 'green' : a.status === 'Doente' ? 'amber' : 'muted'} />
          {a.isCastrated ? <Badge label="Castrado" /> : null}
        </View>
        <Muted style={{ marginTop: space.sm }}>Nascimento: {brDate(a.birthDate)} · {ACQUISITIONS.find(x => x[0] === a.acquisitionType)?.[1] ?? a.acquisitionType}</Muted>
        {a.observations ? <Text style={{ marginTop: space.sm, color: colors.text }}>{a.observations}</Text> : null}
        {canEdit ? <Button label="Editar" variant="secondary" onPress={() => setEditing(true)} style={{ marginTop: space.md }} /> : null}
      </Card>
      <Card>
        <Text style={{ fontWeight: '700', color: colors.text }}>Vacinas</Text>
        {vacc.length === 0 ? <Muted>Nenhuma vacina anotada.</Muted> : vacc.slice(0, 8).map(v => {
          const s = vaccStatus(v)
          return <Row key={v.id} title={v.vaccineName} detail={`${s === 'Aplicada' ? 'Aplicada em ' + brDate(v.appliedDate) : 'Agendada para ' + brDate(v.scheduledDate)}`} badge={<Badge label={s} tone={s === 'Aplicada' ? 'green' : s === 'Vencida' ? 'red' : 'amber'} />} onPress={() => router.push(`/vacinas/${v.id}`)} />
        })}
        {canEdit ? <Button label="+ Vacina" variant="ghost" onPress={() => router.push({ pathname: '/vacinas/[id]', params: { id: 'nova', animalId: a.id } })} /> : null}
      </Card>
      <Card>
        <Text style={{ fontWeight: '700', color: colors.text }}>Tratamentos</Text>
        {treats.length === 0 ? <Muted>Nenhum tratamento anotado.</Muted> : treats.slice(0, 8).map(t => (
          <Row key={t.id} title={t.medicine} detail={`${brDate(t.startDate)}${t.endDate ? ' a ' + brDate(t.endDate) : ''}`} onPress={() => router.push(`/tratamentos/${t.id}`)} />
        ))}
        {canEdit ? <Button label="+ Tratamento" variant="ghost" onPress={() => router.push({ pathname: '/tratamentos/[id]', params: { id: 'novo', animalId: a.id } })} /> : null}
      </Card>
    </Screen>
  )
}

function AnimalForm({ farmId, animal, onDone, canEdit }: { farmId: string; animal: ReturnType<typeof getAnimal>; onDone: (id: string) => void; canEdit: boolean }) {
  const router = useRouter()
  const [name, setName] = useState(animal?.name ?? '')
  const [species, setSpecies] = useState<string | null>(animal?.species ?? 'Vaca')
  const [gender, setGender] = useState<string | null>(animal?.gender ?? 'Fêmea')
  const [birthDate, setBirthDate] = useState(animal ? isoDay(animal.birthDate) : todayISO())
  const [status, setStatus] = useState<string | null>(animal?.status ?? 'Vivo')
  const [customCode, setCustomCode] = useState(animal?.customCode ?? '')
  const [acquisitionType, setAcquisitionType] = useState<string | null>(animal?.acquisitionType ?? 'existente')
  const [isCastrated, setIsCastrated] = useState(!!animal?.isCastrated)
  const [motherId, setMotherId] = useState<string | null>(animal?.motherId ?? null)
  const [observations, setObservations] = useState(animal?.observations ?? '')
  const [error, setError] = useState('')
  const mothers = animalOptions(farmId).filter(o => /vaca/i.test(o.detail ?? '') && o.value !== animal?.id)

  function save() {
    if (!name.trim()) { setError('Informe o nome'); return }
    if (!species || !gender || !status || !acquisitionType) { setError('Preencha espécie, sexo, situação e origem'); return }
    if (birthDate > todayISO()) { setError('A data de nascimento não pode ser no futuro'); return }
    const id = saveAnimal(farmId, { name, species, gender, birthDate, status, customCode, acquisitionType, isCastrated, observations, motherId }, animal?.id)
    onDone(id)
  }

  function remove() {
    if (!animal) return
    Alert.alert('Apagar animal', `Apagar ${animal.name} e tudo o que foi anotado para ele (leite, vacinas, tratamentos)?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => { removeAnimal(farmId, animal.id); router.back() } },
    ])
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: animal ? 'Editar animal' : 'Cadastrar animal' }} />
      <Field label="Nome" value={name} onChangeText={setName} autoFocus={!animal} />
      <SelectField label="Espécie / categoria" value={species} options={SPECIES.map(s => ({ value: s, label: s }))} onChange={setSpecies} />
      <SelectField label="Sexo" value={gender} options={[{ value: 'Fêmea', label: 'Fêmea' }, { value: 'Macho', label: 'Macho' }]} onChange={setGender} />
      <DateField label="Data de nascimento" value={birthDate} onChange={setBirthDate} />
      <SelectField label="Situação" value={status} options={STATUSES.map(s => ({ value: s, label: s }))} onChange={setStatus} />
      <Field label="Brinco ou outro código (opcional)" value={customCode} onChangeText={setCustomCode} autoCapitalize="characters" hint="O número da propriedade é dado automaticamente" />
      <SelectField label="Origem" value={acquisitionType} options={ACQUISITIONS.map(([v, l]) => ({ value: v, label: l }))} onChange={setAcquisitionType} />
      {acquisitionType === 'nascimento' ? <SelectField label="Mãe (opcional)" value={motherId} options={mothers} onChange={setMotherId} searchable allowEmpty /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>Castrado</Text>
        <Switch value={isCastrated} onValueChange={setIsCastrated} trackColor={{ true: colors.green }} />
      </View>
      <Field label="Observações" value={observations} onChangeText={setObservations} multiline />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Salvar" onPress={save} disabled={!canEdit} />
      {animal && canEdit ? <Button label="Apagar animal" variant="ghost" onPress={remove} style={{ marginTop: space.sm }} /> : null}
    </Screen>
  )
}
