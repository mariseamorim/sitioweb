import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { isoDay, todayISO } from '@/lib/format'
import { animalOptions } from '@/repos/animals'
import { getVaccination, removeVaccination, saveVaccination, saveVaccinationForMany } from '@/repos/vaccinations'
import { listAnimals } from '@/repos/animals'
import { listLots } from '@/repos/lots'
import { VACC_TARGETS, herdCategories, targetAnimals, type VaccTarget } from '@/lib/vaccinationGroups'
import { Button, Chips, DateField, Field, Muted, Notice, Screen, SelectField } from '@/ui'
import { space } from '@/theme'
import { useT } from '@/lib/i18n'

const COMMON = ['Febre Aftosa', 'Brucelose (B19)', 'Raiva', 'Clostridiose', 'Carbúnculo', 'IBR/BVD', 'Leptospirose', 'Botulismo']

export default function VacinaForm() {
  const { id, animalId: presetAnimal } = useLocalSearchParams<{ id: string; animalId?: string }>()
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const t = useT()
  const editing = id && id !== 'nova' ? getVaccination(id) : null

  const [animalId, setAnimalId] = useState<string | null>(editing?.animalId ?? presetAnimal ?? null)
  const [vaccineName, setVaccineName] = useState(editing?.vaccineName ?? '')
  const [scheduledDate, setScheduledDate] = useState(editing ? isoDay(editing.scheduledDate) : todayISO())
  const [appliedDate, setAppliedDate] = useState(editing?.appliedDate ? isoDay(editing.appliedDate) : '')
  const [batch, setBatch] = useState(editing?.batch ?? '')
  const [manufacturer, setManufacturer] = useState(editing?.manufacturer ?? '')
  const [appliedBy, setAppliedBy] = useState(editing?.appliedBy ?? '')
  // Aplicar em: um animal, o rebanho inteiro, uma categoria ou um lote (só no registro novo)
  const [target, setTarget] = useState<VaccTarget>('animal')
  const [category, setCategory] = useState<string | null>(null)
  const [lotId, setLotId] = useState<string | null>(null)
  const herd = target === 'animal' ? [] : listAnimals(farmId)
  const group = target === 'animal' ? [] : targetAnimals(herd, target, { category: category ?? undefined, lotId: lotId ?? undefined })
  const [observations, setObservations] = useState(editing?.observations ?? '')
  const [error, setError] = useState('')

  function save() {
    if (!vaccineName.trim()) { setError('Informe a vacina'); return }
    if (target !== 'animal') {
      if (!group.length) { setError('Nenhum animal vivo nesse grupo.'); return }
      saveVaccinationForMany(farmId, group.map(a => a.id), { vaccineName, scheduledDate, appliedDate, appliedBy, batch, manufacturer, observations })
      router.back()
      return
    }
    if (!animalId) { setError('Escolha o animal'); return }
    saveVaccination(farmId, { animalId, vaccineName, scheduledDate, appliedDate, appliedBy, batch, manufacturer, observations }, editing?.id)
    router.back()
  }

  function remove() {
    if (!editing) return
    Alert.alert(t('Apagar vacina'), t('Apagar este registro de vacina?'), [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Apagar'), style: 'destructive', onPress: () => { removeVaccination(farmId, editing.id); router.back() } },
    ])
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t(editing ? 'Vacina' : 'Registrar vacina') }} />
      {!editing ? <Chips options={VACC_TARGETS.map(o => ({ value: o.key, label: o.label }))} value={target} onChange={setTarget} /> : null}
      {target === 'animal' ? <SelectField label="Animal" value={animalId} options={animalOptions(farmId)} onChange={setAnimalId} searchable placeholder="Escolher o animal" /> : null}
      {target === 'categoria' ? <SelectField label="Categoria" value={category} options={herdCategories(herd).map(c => ({ value: c.species, label: `${t(c.species)} (${c.n})` }))} onChange={setCategory} placeholder="Escolher a categoria" /> : null}
      {target === 'lote' ? <SelectField label="Lote de recria ou engorda" value={lotId} options={listLots(farmId).filter(l => !l.endDate).map(l => ({ value: l.id, label: l.name }))} onChange={setLotId} placeholder="Escolher o lote" /> : null}
      {target !== 'animal' ? <Muted style={{ marginBottom: space.md }}>{group.length === 1 ? t('1 animal vai receber a vacina.') : t('{n} animais vão receber a vacina.', { n: group.length })}</Muted> : null}
      <SelectField label="Vacina" value={COMMON.includes(vaccineName) ? vaccineName : vaccineName ? '__outra' : null} options={[...COMMON.map(v => ({ value: v, label: v })), { value: '__outra', label: 'Outra (digitar)' }]} onChange={v => setVaccineName(v === '__outra' ? ' ' : v ?? '')} />
      {vaccineName && !COMMON.includes(vaccineName) ? <Field label="Nome da vacina" value={vaccineName.trim()} onChangeText={setVaccineName} autoFocus /> : null}
      <DateField label="Data agendada" value={scheduledDate} onChange={setScheduledDate} />
      <DateField label="Data da aplicação (vazio = ainda não aplicada)" value={appliedDate} onChange={setAppliedDate} allowEmpty />
      {!appliedDate ? <Button label="Marcar como aplicada hoje" variant="secondary" onPress={() => setAppliedDate(todayISO())} style={{ marginBottom: space.md }} /> : null}
      <Field label="Aplicado por" value={appliedBy} onChangeText={setAppliedBy} hint="Quem aplicou a vacina" />
      <Field label="Lote (opcional)" value={batch} onChangeText={setBatch} autoCapitalize="characters" />
      <Field label="Fabricante (opcional)" value={manufacturer} onChangeText={setManufacturer} />
      <Field label="Observações" value={observations} onChangeText={setObservations} multiline />
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Salvar" onPress={save} disabled={!canEdit} />
      {editing && canEdit ? <Button label="Apagar" variant="ghost" onPress={remove} style={{ marginTop: space.sm }} /> : null}
    </Screen>
  )
}
