import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Switch, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate, isoDay, todayISO } from '@/lib/format'
import { ACQUISITIONS, SPECIES, STATUSES, animalOptions, getAnimal, getAnimalPhoto, removeAnimal, saveAnimal, statusTone } from '@/repos/animals'
import { CATTLE_BREEDS, isBovine } from '@/lib/animalRules'
import { listVaccinations, vaccStatus } from '@/repos/vaccinations'
import { listTreatments } from '@/repos/treatments'
import { listReproductions, statusTone as reproTone } from '@/repos/reproductions'
import { Badge, Button, Card, Chips, DateField, Field, IconCircle, Muted, Notice, Row, Screen, SelectField } from '@/ui'
import { PhotoField, PhotoView } from '@/ui/photo'
import { colors, space } from '@/theme'
import { useT } from '@/lib/i18n'
import { api, NetworkError } from '@/api/client'
import { useSyncState } from '@/sync'
import { useVetPanel } from '@/vet/panel'

const NEW_FARM = '__nova'

export default function AnimalScreen() {
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>()
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const isNew = !id || id === 'novo'
  const animal = useLive(() => (isNew ? null : getAnimal(id)), [id])
  const photo = useLive(() => (isNew ? null : getAnimalPhoto(id)), [id])
  const [editing, setEditing] = useState(isNew)
  const sync = useSyncState()
  const t = useT()

  // Aberto de outra propriedade (veterinário): a ficha chega com a sincronização da propriedade que acabou de abrir
  if (!isNew && !animal) return <Screen><Stack.Screen options={{ title: t('Animal') }} /><Notice text={t(sync.syncing ? 'Carregando os dados da propriedade…' : 'Animal não encontrado.')} /></Screen>
  if (editing) return <AnimalForm farmId={farmId} animal={animal} photo={photo} onDone={(newId) => { if (isNew) router.replace({ pathname: '/animais/[id]', params: { id: newId, saved: '1' } }); else setEditing(false) }} canEdit={canEdit} />

  const vacc = listVaccinations(farmId).filter(v => v.animalId === animal!.id)
  const treats = listTreatments(farmId).filter(tr => tr.animalId === animal!.id)
  const a = animal!
  // Fêmea: a reprodução fica na própria ficha, com a cobertura já ligada a ela
  const repros = a.gender === 'Fêmea' ? listReproductions(farmId).filter(r => r.femaleId === a.id) : []
  return (
    <Screen>
      <Stack.Screen options={{ title: a.name }} />
      {saved === '1' ? <Notice tone="green" text={t('Animal cadastrado com sucesso!')} /> : null}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <PhotoView uri={photo} name={a.name} size={72} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{a.name}</Text>
            <Muted>{t(a.species)}{a.breed ? ` · ${a.breed}` : ''} · {t(a.gender)} · {t('código')} {a.customCode || a.code}</Muted>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
          <Badge label={t(a.status)} tone={statusTone(a.status)} />
          <Badge label={t(a.gender)} tone={a.gender === 'Fêmea' ? 'purple' : 'blue'} />
          {a.isCastrated ? <Badge label={t('Castrado')} /> : null}
        </View>
        <Muted style={{ marginTop: space.sm }}>{t('Nascimento:')} {brDate(a.birthDate)} · {t(ACQUISITIONS.find(x => x[0] === a.acquisitionType)?.[1] ?? a.acquisitionType)}</Muted>
        {a.fatherName ? <Muted style={{ marginTop: space.xs }}>{t('Pai:')} {a.fatherName}</Muted> : null}
        {a.observations ? <Text style={{ marginTop: space.sm, color: colors.text }}>{a.observations}</Text> : null}
        {canEdit ? <Button label={t('Editar')} variant="secondary" onPress={() => setEditing(true)} style={{ marginTop: space.md }} /> : null}
      </Card>
      {a.gender === 'Fêmea' ? (
        <Card>
          <Text style={{ fontWeight: '700', color: colors.text }}>{t('Reprodução')}</Text>
          {repros.length === 0 ? <Muted>{t('Nenhuma cobertura anotada.')}</Muted> : repros.slice(0, 4).map(r => (
            <Row key={r.id} left={<IconCircle icon="heart-outline" tone={reproTone(r.status)} size={36} />}
              title={`${t('Cobertura')} ${brDate(r.coverageDate)}`}
              detail={r.actualBirthDate ? `${t('Parto real')} ${brDate(r.actualBirthDate)}` : r.expectedBirthDate ? `${t('Parto esperado')} ${brDate(r.expectedBirthDate)}` : r.maleName || undefined}
              badge={<Badge label={t(r.status)} tone={reproTone(r.status)} />} onPress={() => router.push(`/reproducao/${r.id}`)} />
          ))}
          {canEdit && a.status !== 'Morto' && a.status !== 'Vendido' ? <Button label={t('+ Registrar cobertura')} variant="ghost" onPress={() => router.push({ pathname: '/reproducao/[id]', params: { id: 'nova', femaleId: a.id } })} /> : null}
        </Card>
      ) : null}
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
  // Raça: escolhe da lista ou "Outra" e digita
  const knownBreed = !animal?.breed || CATTLE_BREEDS.includes(animal.breed)
  const [breedChoice, setBreedChoice] = useState<string | null>(animal?.breed ? (knownBreed ? animal.breed : 'Outra') : null)
  const [breedOther, setBreedOther] = useState(knownBreed ? '' : animal?.breed ?? '')
  const [motherId, setMotherId] = useState<string | null>(animal?.motherId ?? null)
  const [fatherName, setFatherName] = useState(animal?.fatherName ?? '')
  const [observations, setObservations] = useState(animal?.observations ?? '')
  const [imageUrl, setImageUrl] = useState(photo ?? '')
  const [error, setError] = useState('')
  const t = useT()
  // Veterinário cadastrando: escolhe a fazenda (a aberta, outra atendida ou uma nova, que o servidor cria)
  const { user } = useSession()
  const vetNew = !!user?.vet && !animal
  const { panel, reload: reloadPanel } = useVetPanel()
  const [farmChoice, setFarmChoice] = useState<string | null>(farmId)
  const [newFarmName, setNewFarmName] = useState('')
  const [saving, setSaving] = useState(false)
  const otherFarm = vetNew && farmChoice !== farmId
  const mothers = animalOptions(farmId).filter(o => /vaca/i.test(o.detail ?? '') && o.value !== animal?.id)

  function save() {
    if (!name.trim()) { setError(t('Informe o nome')); return }
    if (!species || !gender || !status || !acquisitionType) { setError(t('Preencha espécie, sexo, situação e origem')); return }
    if (birthDate > todayISO()) { setError(t('A data de nascimento não pode ser no futuro')); return }
    if (otherFarm) return void saveInOtherFarm()
    const id = saveAnimal(farmId, { name, species, breed: breedChoice === 'Outra' ? breedOther : breedChoice ?? '', gender, birthDate, status, customCode, acquisitionType, isCastrated, observations, motherId, fatherName, imageUrl: imageUrl !== (photo ?? '') ? imageUrl : undefined }, animal?.id)
    onDone(id)
  }

  /** Veterinário: animal de outra fazenda atendida (ou de uma nova) vai direto para o servidor */
  async function saveInOtherFarm() {
    if (farmChoice === NEW_FARM && !newFarmName.trim()) { setError(t('Informe o nome da fazenda')); return }
    setSaving(true)
    setError('')
    try {
      await api('/api/veterinario/animais', {
        method: 'POST',
        body: {
          ...(farmChoice === NEW_FARM ? { newFarmName: newFarmName.trim() } : { farmId: farmChoice }),
          name: name.trim(), species, gender, birthDate, status, customCode: customCode.trim() || null, acquisitionType, isCastrated,
          breed: breedChoice === 'Outra' ? breedOther : breedChoice ?? '', observations: observations.trim() || null, fatherName: fatherName.trim() || null,
        },
      })
      if (farmChoice === NEW_FARM) void reloadPanel()
      const farmName = farmChoice === NEW_FARM ? newFarmName.trim() : panel?.clients.find(c => c.farmId === farmChoice)?.name ?? ''
      Alert.alert(t('Animal cadastrado'), t('{name} cadastrado em {farm}.', { name: name.trim(), farm: farmName }))
      router.back()
    } catch (e) {
      setError(e instanceof NetworkError ? t('Sem internet: para cadastrar em outra fazenda é preciso conexão. Na fazenda aberta funciona sem internet.') : e instanceof Error ? t(e.message) : t('Não foi possível salvar.'))
    } finally {
      setSaving(false)
    }
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
      {vetNew ? (
        <>
          <SelectField label={t('Fazenda')} value={farmChoice}
            options={[
              ...(panel?.clients ?? []).filter(c => c.farmId).map(c => ({ value: c.farmId!, label: c.farmId === farmId ? `${c.name} (${t('aberta')})` : c.name })),
              ...(panel?.clients.some(c => c.farmId === farmId) ? [] : [{ value: farmId, label: `${user?.farmName ?? t('Fazenda aberta')} (${t('aberta')})` }]),
              { value: NEW_FARM, label: t('Outra fazenda (ainda não cadastrada)') },
            ]}
            onChange={setFarmChoice} />
          {farmChoice === NEW_FARM ? <Field label={t('Nome da fazenda')} value={newFarmName} onChangeText={setNewFarmName} placeholder={t('Ex.: Sítio Boa Vista')} /> : null}
          {otherFarm ? <Muted style={{ marginBottom: space.md }}>{t('Em outra fazenda o cadastro vai direto para o servidor (precisa de internet). A fazenda nova entra em "Fazendas atendidas".')}</Muted> : null}
        </>
      ) : null}
      {!otherFarm ? <PhotoField value={imageUrl} onChange={setImageUrl} name={name} /> : null}
      <Field label={t('Nome')} value={name} onChangeText={setName} autoFocus={!animal} />
      <SelectField label={t('Espécie / categoria')} value={species} options={SPECIES.map(s => ({ value: s, label: t(s) }))} onChange={setSpecies} />
      {species && isBovine(species) ? (
        <>
          <SelectField label={t('Raça')} value={breedChoice} options={[...CATTLE_BREEDS, 'Outra'].map(b => ({ value: b, label: b === 'Outra' ? t('Outra') : b }))} onChange={setBreedChoice} allowEmpty />
          {breedChoice === 'Outra' ? <Field label={t('Qual raça?')} value={breedOther} onChangeText={setBreedOther} maxLength={40} /> : null}
        </>
      ) : null}
      <Chips label={t('Sexo')} value={gender} options={[{ value: 'Fêmea', label: 'Fêmea' }, { value: 'Macho', label: 'Macho' }]} onChange={setGender} />
      <DateField label={t('Data de nascimento')} value={birthDate} onChange={setBirthDate} />
      <Chips label={t('Situação')} value={status} options={STATUSES.map(s => ({ value: s, label: s }))} onChange={setStatus} />
      <Field label={t('Brinco ou outro código (opcional)')} value={customCode} onChangeText={setCustomCode} autoCapitalize="characters" hint={t('O número da propriedade é dado automaticamente')} />
      <Chips label={t('Origem')} value={acquisitionType} options={ACQUISITIONS.map(([v, l]) => ({ value: v as string, label: l as string }))} onChange={setAcquisitionType} />
      {acquisitionType === 'nascimento' ? <SelectField label={t('Mãe (opcional)')} value={motherId} options={mothers} onChange={setMotherId} searchable allowEmpty /> : null}
      {/* Pai: o sistema usa para não deixar cobrir com o pai ou o avô */}
      <Field label={t('Pai (opcional)')} value={fatherName} onChangeText={setFatherName} maxLength={80} placeholder={t('Ex.: Trovão ou RGD 12345')} hint={t('Nome ou registro do touro ou do sêmen. Serve para não deixar cobrir com o pai ou o avô.')} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md }}>
        <Text style={{ color: colors.text, fontSize: 16 }}>{t('Castrado')}</Text>
        <Switch value={isCastrated} onValueChange={setIsCastrated} trackColor={{ true: colors.green }} />
      </View>
      <Field label={t('Observações')} value={observations} onChangeText={setObservations} multiline />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label={t('Salvar')} onPress={save} loading={saving} disabled={!canEdit} />
      {animal && canEdit ? <Button label={t('Apagar animal')} variant="destructive" icon="trash-outline" onPress={remove} style={{ marginTop: space.xl }} /> : null}
    </Screen>
  )
}
