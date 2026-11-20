import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Switch, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate, isoDay, todayISO } from '@/lib/format'
import { ACQUISITIONS, SPECIES, STATUSES, animalOptions, getAnimal, getAnimalPhoto, removeAnimal, saveAnimal, statusTone } from '@/repos/animals'
import { listVaccinations, vaccStatus } from '@/repos/vaccinations'
import { listTreatments } from '@/repos/treatments'
import { Badge, Button, Card, DateField, Field, IconCircle, Muted, Notice, Row, Screen, SelectField } from '@/ui'
import { PhotoField, PhotoView } from '@/ui/photo'
import { colors, space } from '@/theme'
import { useT } from '@/lib/i18n'

export default function AnimalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const isNew = !id || id === 'novo'
  const animal = useLive(() => (isNew ? null : getAnimal(id)), [id])
  const photo = useLive(() => (isNew ? null : getAnimalPhoto(id)), [id])
  const [editing, setEditing] = useState(isNew)
  const t = useT()

  if (!isNew && !animal) return <Screen><Stack.Screen options={{ title: t('Animal') }} /><Notice text={t('Animal não encontrado.')} /></Screen>
  if (editing) return <AnimalForm farmId={farmId} animal={animal} photo={photo} onDone={(newId) => { if (isNew) router.replace(`/animais/${newId}`); else setEditing(false) }} canEdit={canEdit} />

  const vacc = listVaccinations(farmId).filter(v => v.animalId === animal!.id)
  const treats = listTreatments(farmId).filter(tr => tr.animalId === animal!.id)
  const a = animal!
  return (
    <Screen>
      <Stack.Screen options={{ title: a.name }} />
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <PhotoView uri={photo} name={a.name} size={72} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{a.name}</Text>
            <Muted>{t(a.species)} · {t(a.gender)} · {t('código')} {a.customCode || a.code}</Muted>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          <Badge label={t(a.status)} tone={statusTone(a.status)} />
          <Badge label={t(a.gender)} tone={a.gender === 'Fêmea' ? 'purple' : 'blue'} />
          {a.isCastrated ? <Badge label={t('Castrado')} /> : null}
        </View>
        <Muted style={{ marginTop: space.sm }}>{t('Nascimento:')} {brDate(a.birthDate)} · {t(ACQUISITIONS.find(x => x[0] === a.acquisitionType)?.[1] ?? a.acquisitionType)}</Muted>
        {a.observations ? <Text style={{ marginTop: space.sm, color: colors.text }}>{a.observations}</Text> : null}
        {canEdit ? <Button label={t('Editar')} variant="secondary" onPress={() => setEditing(true)} style={{ marginTop: space.md }} /> : null}
      </Card>
      <Card>
        <Text style={{ fontWeight: '700', color: colors.text }}>{t('Vacinas')}</Text>
        {vacc.length === 0 ? <Muted>{t('Nenhuma vacina anotada.')}</Muted> : vacc.slice(0, 8).map(v => {
          const s = vaccStatus(v)
          return <Row key={v.id} left={<IconCircle icon="shield-checkmark-outline" tone={s === 'Aplicada' ? 'green' : s === 'Vencida' ? 'red' : 'amber'} size={36} />} title={v.vaccineName} detail={`${s === 'Aplicada' ? t('Aplicada em') + ' ' + brDate(v.appliedDate) : t('Agendada para') + ' ' + brDate(v.scheduledDate)}`} badge={<Badge label={t(s)} tone={s === 'Aplicada' ? 'green' : s === 'Vencida' ? 'red' : 'amber'} />} onPress={() => router.push(`/vacinas/${v.id}`)} />
        })}
        {canEdit ? <Button label={t('+ Vacina')} variant="ghost" onPress={() => router.push({ pathname: '/vacinas/[id]', params: { id: 'nova', animalId: a.id } })} /> : null}
      </Card>
      <Card>
        <Text style={{ fontWeight: '700', color: colors.text }}>{t('Tratamentos')}</Text>
        {treats.length === 0 ? <Muted>{t('Nenhum tratamento anotado.')}</Muted> : treats.slice(0, 8).map(tm => (
          <Row key={tm.id} left={<IconCircle icon="medkit-outline" tone="blue" size={36} />} title={tm.medicine} detail={`${brDate(tm.startDate)}${tm.endDate ? ` ${t('a')} ` + brDate(tm.endDate) : ''}`} onPress={() => router.push(`/tratamentos/${tm.id}`)} />
        ))}
        {canEdit ? <Button label={t('+ Tratamento')} variant="ghost" onPress={() => router.push({ pathname: '/tratamentos/[id]', params: { id: 'novo', animalId: a.id } })} /> : null}
      </Card>
    </Screen>
  )
}

function AnimalForm({ farmId, animal, photo, onDone, canEdit }: { farmId: string; animal: ReturnType<typeof getAnimal>; photo: string | null; onDone: (id: string) => void; canEdit: boolean }) {
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
  const [imageUrl, setImageUrl] = useState(photo ?? '')
  const [error, setError] = useState('')
  const t = useT()
  const mothers = animalOptions(farmId).filter(o => /vaca/i.test(o.detail ?? '') && o.value !== animal?.id)

  function save() {
    if (!name.trim()) { setError(t('Informe o nome')); return }
    if (!species || !gender || !status || !acquisitionType) { setError(t('Preencha espécie, sexo, situação e origem')); return }
    if (birthDate > todayISO()) { setError(t('A data de nascimento não pode ser no futuro')); return }
    const id = saveAnimal(farmId, { name, species, gender, birthDate, status, customCode, acquisitionType, isCastrated, observations, motherId, imageUrl: imageUrl !== (photo ?? '') ? imageUrl : undefined }, animal?.id)
    onDone(id)
  }

  function remove() {
    if (!animal) return
    Alert.alert(t('Apagar animal'), t('Apagar {name} e tudo o que foi anotado para ele (leite, vacinas, tratamentos)?', { name: animal.name }), [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Apagar'), style: 'destructive', onPress: () => { removeAnimal(farmId, animal.id); router.back() } },
    ])
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t(animal ? 'Editar animal' : 'Cadastrar animal') }} />
      <PhotoField value={imageUrl} onChange={setImageUrl} name={name} />
      <Field label={t('Nome')} value={name} onChangeText={setName} autoFocus={!animal} />
      <SelectField label={t('Espécie / categoria')} value={species} options={SPECIES.map(s => ({ value: s, label: t(s) }))} onChange={setSpecies} />
      <SelectField label={t('Sexo')} value={gender} options={[{ value: 'Fêmea', label: t('Fêmea') }, { value: 'Macho', label: t('Macho') }]} onChange={setGender} />
      <DateField label={t('Data de nascimento')} value={birthDate} onChange={setBirthDate} />
      <SelectField label={t('Situação')} value={status} options={STATUSES.map(s => ({ value: s, label: t(s) }))} onChange={setStatus} />
      <Field label={t('Brinco ou outro código (opcional)')} value={customCode} onChangeText={setCustomCode} autoCapitalize="characters" hint={t('O número da propriedade é dado automaticamente')} />
      <SelectField label={t('Origem')} value={acquisitionType} options={ACQUISITIONS.map(([v, l]) => ({ value: v, label: t(l) }))} onChange={setAcquisitionType} />
      {acquisitionType === 'nascimento' ? <SelectField label={t('Mãe (opcional)')} value={motherId} options={mothers} onChange={setMotherId} searchable allowEmpty /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>{t('Castrado')}</Text>
        <Switch value={isCastrated} onValueChange={setIsCastrated} trackColor={{ true: colors.green }} />
      </View>
      <Field label={t('Observações')} value={observations} onChangeText={setObservations} multiline />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label={t('Salvar')} onPress={save} disabled={!canEdit} />
      {animal && canEdit ? <Button label={t('Apagar animal')} variant="ghost" onPress={remove} style={{ marginTop: space.sm }} /> : null}
    </Screen>
  )
}
