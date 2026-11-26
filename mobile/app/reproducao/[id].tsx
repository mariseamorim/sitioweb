import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useMemo, useState } from 'react'
import { Alert, Pressable, Text, ToastAndroid, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { canAddCalf } from '@/lib/animalRules'
import { COVERAGE_METHODS, EMPTY_COVERAGE, GESTATION_DAYS, gestation, plusDays, isInsemination, methodLabel, repeatCoverage, repeatedFields, type CoverageForm } from '@/lib/coverage'
import { brDate, isoDay, todayISO } from '@/lib/format'
import { getAnimal } from '@/repos/animals'
import {
  breedableFemales, calfCandidates, createCoverage, getReproduction, inbreedingCheck, isOpen, linkExistingCalf, registerBirth, removeReproduction,
  STATUS_LIST, statusTone, updateCoverage, updateStatus, type Reproduction,
} from '@/repos/reproductions'
import { Badge, Button, Card, Chips, DateField, Field, Muted, Notice, Screen, SelectField } from '@/ui'
import { colors, font, radius, space } from '@/theme'
import { useT } from '@/lib/i18n'
import { useVetStock } from '@/vet/stock'
import { semenLabel } from '@/lib/vetSupplyKinds'
import { VetFarmBar } from '@/vet/panel'
import { INBREEDING_TEXT, KINSHIP_LABEL, type InbreedingConflict } from '@/lib/inbreeding'


// Reprodução: id = "nova" abre "Registrar cobertura"; um id existente abre o detalhe do registro
export default function ReproducaoScreen() {
  const { id, femaleId, status } = useLocalSearchParams<{ id: string; femaleId?: string; status?: string }>()
  const farmId = useFarmId()
  // Trocou de propriedade no formulário (veterinário): começa de novo, para não ficar a fêmea da outra propriedade
  if (!id || id === 'nova') return <CoverageFormScreen key={farmId} presetFemaleId={femaleId} presetStatus={status} />
  return <DetailScreen id={id} />
}

/** Aviso de consanguinidade traduzido (regra em src/lib/inbreeding.ts) */
function inbreedingText(t: ReturnType<typeof useT>, c: InbreedingConflict) {
  return t(INBREEDING_TEXT, { bull: c.bull, who: t(KINSHIP_LABEL[c.kinship]) })
}

// ── Registrar cobertura ────────────────────────────────────────────────

function CoverageFormScreen({ presetFemaleId, presetStatus }: { presetFemaleId?: string; presetStatus?: string }) {
  const farmId = useFarmId()
  const { canEdit, user } = useSession()
  const router = useRouter()
  const t = useT()
  const females = useLive(() => breedableFemales(farmId), [farmId])
  // Veterinário: sêmen do próprio estoque (preenche touro, raça e partida; o servidor desconta 1 dose)
  const { items: vetStock, setItems: setVetStock } = useVetStock(!!user?.vet)
  const semenStock = vetStock.filter(x => x.kind === 'semen')
  const [semenId, setSemenId] = useState<string | null>(null)
  const [form, setForm] = useState<CoverageForm>({
    ...EMPTY_COVERAGE, femaleId: presetFemaleId ?? '', status: presetStatus && STATUS_LIST.includes(presetStatus) ? presetStatus : 'Coberta',
    // Vinda do "Confirmar prenhez": a data da cobertura fica em branco para a pessoa informar
    coverageDate: presetStatus === 'Prenha' ? '' : todayISO(),
  })
  const [showMore, setShowMore] = useState(false)
  // "Salvar e repetir": quantas fêmeas já foram salvas nesta fila e o que ficou preenchido para a próxima
  const [repeated, setRepeated] = useState<{ count: number; kept: string[] } | null>(null)
  const [error, setError] = useState('')
  const set = (patch: Partial<CoverageForm>) => setForm(f => ({ ...f, ...patch }))
  const more = showMore || !!(form.semenBatch || form.inseminator || form.bullRegistry || form.heatDate)
  // Touro que é pai ou avô da fêmea: avisa já ao escolher e não deixa salvar
  const conflict = useMemo(() => inbreedingCheck(farmId, form.femaleId, { maleName: form.maleName, bullRegistry: form.bullRegistry }), [farmId, form.femaleId, form.maleName, form.bullRegistry])
  const inbred = conflict ? inbreedingText(t, conflict) : null

  // Salva a cobertura. Com `repeat`, mantém data, tipo, touro, partida e inseminador e limpa só a fêmea:
  // é o dia de IATF, em que a fila toda leva o mesmo sêmen e só muda o brinco.
  function save(repeat: boolean) {
    if (!form.femaleId) { setError(t('Escolha a fêmea')); return }
    if (!form.coverageDate) { setError(t('Informe a data da cobertura')); return }
    if (inbred) { setError(inbred); return }
    setError('')
    createCoverage(farmId, { ...form, vetSupplyId: semenId })
    // A dose usada sai da conta na tela (o servidor desconta de verdade ao receber)
    if (semenId) setVetStock(list => list.map(x => (x.id === semenId ? { ...x, quantity: x.quantity - 1 } : x)))
    if (repeat) {
      setForm(repeatCoverage(form))
      setRepeated(prev => ({ count: (prev?.count ?? 0) + 1, kept: repeatedFields(form) }))
      return
    }
    const open = form.status === 'Coberta' || form.status === 'Prenha'
    ToastAndroid.show(open ? t('Cobertura salva. Parto previsto para {date}.', { date: brDate(plusDays(form.coverageDate, GESTATION_DAYS)) }) : t('Cobertura salva.'), ToastAndroid.LONG)
    router.back()
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: t('Registrar cobertura') }} />
      {!canEdit ? <Notice tone="red" text={t('Sua conta só pode consultar.')} /> : null}
      <VetFarmBar />
      {repeated ? <Notice tone="green" text={`${t(repeated.count === 1 ? '{n} cobertura salva.' : '{n} coberturas salvas.', { n: repeated.count })} ${t('Mantido para a próxima fêmea:')} ${repeated.kept.join(', ')}.`} /> : null}
      <SelectField label={t('Fêmea')} value={form.femaleId || null} onChange={v => set({ femaleId: v ?? '' })} searchable placeholder={t('Escolher a fêmea')}
        options={females.map(a => ({ value: a.id, label: a.name, detail: `${a.customCode || a.code} · ${t(a.species)}` }))} />
      <Text style={styles.label}>{t('Como foi')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
        {COVERAGE_METHODS.map(m => {
          const on = form.method === m.key
          return (
            <Pressable key={m.key} onPress={() => set({ method: on ? '' : m.key })} style={[styles.method, on && { borderColor: colors.green, backgroundColor: colors.greenSoft }]}>
              <Text style={{ fontWeight: '700', color: on ? colors.green : colors.text }}>{t(m.label)}</Text>
              <Muted>{t(m.hint)}</Muted>
            </Pressable>
          )
        })}
      </View>
      {user?.vet ? (
        <>
          <SelectField label={t('Sêmen do meu estoque')} value={semenId}
            options={semenStock.filter(x => x.quantity >= 1).map(x => ({ value: x.id, label: semenLabel(x) }))}
            placeholder={semenStock.length ? t('Não usar o estoque') : t('Nenhum sêmen no seu estoque')} allowEmpty
            onChange={id => {
              setSemenId(id)
              const sm = semenStock.find(x => x.id === id)
              if (sm) set({ method: form.method === 'natural' || form.method === 'repasse' || !form.method ? 'ia' : form.method, maleName: sm.bullName || sm.name, bullBreed: sm.bullBreed ?? '', semenBatch: sm.semenBatch ?? '' })
            }} />
          {semenId ? <Muted style={{ marginBottom: space.sm }}>{t('Ao salvar, 1 dose sai do seu estoque, com a fazenda e a vaca anotadas.')}</Muted> : null}
        </>
      ) : null}
      <Field label={t('Touro')} value={form.maleName} onChangeText={v => set({ maleName: v })} placeholder={t('Nome ou código do touro')} />
      {inbred ? <Notice tone="red" text={inbred} /> : null}
      <Field label={t('Raça do touro')} value={form.bullBreed} onChangeText={v => set({ bullBreed: v })} placeholder={t('Ex.: Gir, Holandesa')} />
      <DateField label={t('Data da cobertura *')} value={form.coverageDate} onChange={v => set({ coverageDate: v })} />
      {form.status === 'Prenha' && !form.coverageDate ? <Notice text={t('Se não souber o dia certo, coloque uma data aproximada: ela define a previsão do parto.')} /> : null}
      <Chips label={t('Status')} value={form.status} options={STATUS_LIST.map(s => ({ value: s, label: s }))} onChange={v => set({ status: v })} />
      {/* Detalhes recolhidos: o registro rápido é fêmea, como foi, touro e data */}
      {!more ? <Button label={t('Mais detalhes (opcional)')} variant="ghost" onPress={() => setShowMore(true)} style={{ marginBottom: space.md }} /> : (
        <Card>
          <Text style={[styles.label, { marginBottom: space.md }]}>{t('Mais detalhes (opcional)')}</Text>
          {isInsemination(form.method) ? (
            <View>
              <Field label={t('Partida do sêmen')} value={form.semenBatch} onChangeText={v => set({ semenBatch: v })} placeholder={t('Ex.: 2412-A')} autoCapitalize="characters" />
              <Field label={t('Inseminador')} value={form.inseminator} onChangeText={v => set({ inseminator: v })} placeholder={t('Quem inseminou')} />
            </View>
          ) : null}
          <Field label={t('Registro do touro')} value={form.bullRegistry} onChangeText={v => set({ bullRegistry: v })} placeholder={t('Ex.: RGD 12345')} />
          <DateField label={t('Data do cio')} value={form.heatDate} onChange={v => set({ heatDate: v })} allowEmpty />
          <Field label={t('Observações')} value={form.observations} onChangeText={v => set({ observations: v })} multiline />
        </Card>
      )}
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label={t('Salvar')} onPress={() => save(false)} disabled={!canEdit || !!inbred} />
      <Button label={t('Salvar e repetir para outra fêmea')} variant="secondary" onPress={() => save(true)} disabled={!canEdit || !!inbred} style={{ marginTop: space.sm }} />
      <Muted style={{ marginTop: space.sm }}>{t('Para o dia de inseminação: a data, o tipo, o touro, a partida e o inseminador ficam preenchidos e só a fêmea muda.')}</Muted>
      {repeated ? <Button label={t('Fechar')} variant="ghost" onPress={() => router.back()} style={{ marginTop: space.sm }} /> : null}
    </Screen>
  )
}

// ── Detalhe do registro ────────────────────────────────────────────────

function DetailScreen({ id }: { id: string }) {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const t = useT()
  const r = useLive(() => getReproduction(id), [id])
  const [mode, setMode] = useState<'ver' | 'editar' | 'parto'>('ver')
  const [editStatus, setEditStatus] = useState<string | null>(r?.status ?? null)
  const [editBirthDate, setEditBirthDate] = useState(isoDay(r?.actualBirthDate))

  if (!r) return <Screen><Stack.Screen options={{ title: t('Reprodução') }} /><Notice text={t('Registro não encontrado.')} /></Screen>

  const g = isOpen(r) ? gestation(r.coverageDate, r.expectedBirthDate, todayISO()) : null
  const mother = canEdit && isOpen(r) ? getAnimal(r.femaleId) : null

  function saveStatus() {
    updateStatus(farmId, r!.id, editStatus || r!.status, editStatus === 'Parida' ? editBirthDate : '')
    router.back()
  }

  function remove() {
    Alert.alert(t('Excluir este registro de reprodução?'), undefined, [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Excluir'), style: 'destructive', onPress: () => { removeReproduction(farmId, r!.id); router.back() } },
    ])
  }

  const item = (label: string, value: string, tone?: string) => (
    <View style={{ marginBottom: space.sm }}>
      <Muted>{t(label)}</Muted>
      <Text style={{ color: tone ?? colors.text, fontWeight: '600', fontSize: font.md }}>{value}</Text>
    </View>
  )

  return (
    <Screen>
      <Stack.Screen options={{ title: r.femaleName ?? t('Reprodução') }} />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{r.femaleName ?? t('Animal removido')}</Text>
            <Muted>{t('Cobertura')}: {brDate(r.coverageDate)}</Muted>
          </View>
          <Badge label={t(r.status)} tone={statusTone(r.status)} />
        </View>
        {item('Touro', `${r.maleName || '—'}${r.bullBreed ? ` · ${r.bullBreed}` : ''}${r.bullRegistry ? ` · ${r.bullRegistry}` : ''}`)}
        {r.method ? item('Como foi', `${methodLabel(r.method)}${r.semenBatch ? ` · ${t('partida')} ${r.semenBatch}` : ''}`) : null}
        {r.inseminator ? item('Inseminador', r.inseminator) : null}
        {r.heatDate ? item('Cio', brDate(r.heatDate)) : null}
        {item('Parto esperado', r.expectedBirthDate ? brDate(r.expectedBirthDate) : '—')}
        {g ? (
          <View style={{ marginBottom: space.sm }}>
            <Muted>{t('Gestação')}</Muted>
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              {t(g.days === 1 ? '{n} dia' : '{n} dias', { n: g.days })} · {g.toBirth >= 0 ? t(g.toBirth === 1 ? 'falta {n} dia para o parto' : 'faltam {n} dias para o parto', { n: g.toBirth }) : t(g.toBirth === -1 ? 'parto atrasado {n} dia' : 'parto atrasado {n} dias', { n: -g.toBirth })}
            </Text>
            <View style={styles.bar}><View style={[styles.barFill, { width: `${g.percent}%` }]} /></View>
          </View>
        ) : null}
        {r.actualBirthDate ? item('Parto real', brDate(r.actualBirthDate), colors.green) : null}
        {r.observations ? item('Observações', r.observations) : null}
      </Card>

      {/* Parto: anota a cria (ela entra no rebanho, ligada à mãe) e a cobertura fecha sozinha */}
      {mother ? (mode === 'parto'
        ? <CalfForm farmId={farmId} reproduction={r} mother={mother} onCancel={() => setMode('ver')} onSaved={() => router.back()} />
        : <Button label={t('Registrar parto e anotar a cria')} onPress={() => setMode('parto')} style={{ marginBottom: space.md }} />) : null}

      {canEdit ? (mode === 'editar'
        ? <RecordEditor farmId={farmId} record={r} onCancel={() => setMode('ver')} onSaved={() => setMode('ver')} />
        : <Button label={t('Editar registro')} variant="secondary" onPress={() => setMode('editar')} style={{ marginBottom: space.md }} />) : null}

      {canEdit ? (
        <Card>
          <Text style={[styles.label, { marginBottom: space.md }]}>{t('Atualizar status')}</Text>
          <Chips value={editStatus} options={STATUS_LIST.map(s => ({ value: s, label: s }))} onChange={setEditStatus} />
          {editStatus === 'Parida' ? <DateField label={t('Data do parto')} value={editBirthDate} onChange={setEditBirthDate} allowEmpty /> : null}
          <Button label={t('Salvar status')} variant={mother ? 'secondary' : 'primary'} onPress={saveStatus} />
        </Card>
      ) : null}
      {/* Excluir longe das ações do dia a dia */}
      {canEdit ? <Button label={t('Excluir registro')} variant="destructive" icon="trash-outline" onPress={remove} style={{ marginTop: space.xl }} /> : null}
    </Screen>
  )
}

/** Corrigir a cobertura: datas, reprodutor, inseminação ou monta, sêmen, registro do touro e observações */
function RecordEditor({ farmId, record, onCancel, onSaved }: { farmId: string; record: Reproduction; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CoverageForm & { expectedBirthDate: string }>({
    femaleId: record.femaleId, status: record.status, coverageDate: isoDay(record.coverageDate), expectedBirthDate: isoDay(record.expectedBirthDate),
    heatDate: isoDay(record.heatDate), method: record.method ?? '', maleName: record.maleName ?? '', bullBreed: record.bullBreed ?? '', bullRegistry: record.bullRegistry ?? '',
    semenBatch: record.semenBatch ?? '', inseminator: record.inseminator ?? '', observations: record.observations ?? '',
  })
  const [error, setError] = useState('')
  const t = useT()
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))

  function save() {
    if (!form.coverageDate) { setError(t('Informe a data da cobertura')); return }
    const conflict = inbreedingCheck(farmId, record.femaleId, { maleName: form.maleName, bullRegistry: form.bullRegistry })
    if (conflict) { setError(inbreedingText(t, conflict)); return }
    // A data da cobertura recalcula o parto previsto; a previsão digitada vale por cima
    updateCoverage(farmId, record, form)
    onSaved()
  }

  return (
    <Card>
      <Text style={[styles.label, { marginBottom: space.md }]}>{t('Editar registro')}</Text>
      <DateField label={t('Data da cobertura')} value={form.coverageDate} onChange={v => set({ coverageDate: v })} />
      <DateField label={t('Parto estimado')} value={form.expectedBirthDate} onChange={v => set({ expectedBirthDate: v })} allowEmpty />
      <DateField label={t('Data do cio')} value={form.heatDate} onChange={v => set({ heatDate: v })} allowEmpty />
      <SelectField label={t('Como foi')} value={form.method || null} onChange={v => set({ method: v ?? '' })} allowEmpty placeholder={t('Não informado')}
        options={COVERAGE_METHODS.map(m => ({ value: m.key, label: t(m.label), detail: t(m.hint) }))} />
      <Field label={t('Touro (nome)')} value={form.maleName} onChangeText={v => set({ maleName: v })} />
      <Field label={t('Raça do touro')} value={form.bullBreed} onChangeText={v => set({ bullBreed: v })} />
      <Field label={t('Registro do touro')} value={form.bullRegistry} onChangeText={v => set({ bullRegistry: v })} />
      {isInsemination(form.method) || !form.method ? (
        <View>
          <Field label={t('Partida do sêmen')} value={form.semenBatch} onChangeText={v => set({ semenBatch: v })} autoCapitalize="characters" />
          <Field label={t('Inseminador')} value={form.inseminator} onChangeText={v => set({ inseminator: v })} />
        </View>
      ) : null}
      <Field label={t('Observações')} value={form.observations} onChangeText={v => set({ observations: v })} multiline />
      {error ? <Notice tone="red" text={error} /> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label={t('Cancelar')} variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
        <Button label={t('Salvar alteração')} onPress={save} style={{ flex: 1 }} />
      </View>
    </Card>
  )
}

const OUTCOMES = [{ value: 'Vivo', label: 'Viva' }, { value: 'Morto', label: 'Morreu' }, { value: 'Vendido', label: 'Vendida' }]

/** Formulário de cria (o mesmo AddCalfForm do site): cria nova ou uma já cadastrada ligada à mãe */
function CalfForm({ farmId, reproduction, mother, onCancel, onSaved }: {
  farmId: string; reproduction: Reproduction; mother: NonNullable<ReturnType<typeof getAnimal>>; onCancel: () => void; onSaved: () => void
}) {
  const [existing, setExisting] = useState<'nova' | 'existente'>('nova')
  const [existingId, setExistingId] = useState<string | null>(null)
  const [birthDate, setBirthDate] = useState(todayISO())
  const [gender, setGender] = useState<'Macho' | 'Fêmea' | ''>('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState('Vivo')
  const [error, setError] = useState('')
  const t = useT()
  const defaultName = `Cria da ${mother.name} ${birthDate.slice(0, 4)}`
  const candidates = calfCandidates(farmId, mother)

  function save() {
    if (!canAddCalf({ ...mother, isCastrated: !!mother.isCastrated })) { setError(t('A mãe precisa ter pelo menos 2 anos e meio para adicionar cria')); return }
    if (existing === 'existente') {
      const calf = candidates.find(c => c.id === existingId)
      if (!calf) { setError(t('Escolha a cria')); return }
      linkExistingCalf(farmId, reproduction, calf)
      onSaved()
      return
    }
    if (!gender) { setError(t('Escolha bezerro ou bezerra')); return }
    if (birthDate > todayISO()) { setError(t('A data do parto não pode ser no futuro')); return }
    if (birthDate < isoDay(mother.birthDate)) { setError(t('A data do parto não pode ser antes do nascimento da mãe')); return }
    registerBirth(farmId, reproduction, { name: name.trim() || defaultName, gender, birthDate, status })
    onSaved()
  }

  return (
    <Card style={{ borderColor: colors.green, backgroundColor: colors.greenSoft }}>
      <Text style={[styles.label, { marginBottom: space.xs }]}>{t('Registrar parto')}</Text>
      <Chips options={[{ value: 'nova', label: t('Nova cria') }, { value: 'existente', label: t('Já está cadastrada') }]} value={existing} onChange={setExisting} />
      {existing === 'existente' ? (
        <View>
          <SelectField label={t('Qual animal é cria da {name}?', { name: mother.name })} value={existingId} onChange={setExistingId} searchable placeholder={t('Escolha')}
            options={candidates.map(a => ({ value: a.id, label: a.name, detail: `${a.customCode || a.code} · ${t('nasceu em')} ${brDate(a.birthDate)}` }))} />
          {candidates.length === 0 ? <Muted style={{ marginBottom: space.md }}>{t('Nenhum animal sem mãe e mais novo que ela.')}</Muted> : null}
        </View>
      ) : (
        <View>
          <DateField label={t('Data do parto')} value={birthDate} onChange={setBirthDate} />
          <Text style={styles.label}>{t('É bezerro ou bezerra?')}</Text>
          <Chips options={[{ value: 'Macho', label: t('Bezerro') }, { value: 'Fêmea', label: t('Bezerra') }]} value={gender} onChange={setGender} />
          <Field label={t('Nome (opcional)')} value={name} onChangeText={setName} placeholder={defaultName} />
          <Text style={styles.label}>{t('A cria')}</Text>
          <Chips options={OUTCOMES.map(o => ({ ...o, label: t(o.label) }))} value={status} onChange={setStatus} />
        </View>
      )}
      {error ? <Notice tone="red" text={error} /> : null}
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
        <Button label={t('Cancelar')} variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
        <Button label={t('Salvar cria')} onPress={save} style={{ flex: 1 }} />
      </View>
    </Card>
  )
}

const styles = {
  label: { fontSize: font.sm, fontWeight: '600', color: colors.muted, marginBottom: 4 },
  method: { width: '48%', borderWidth: 2, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.white, padding: space.md, flexGrow: 1 },
  bar: { height: 8, borderRadius: 999, backgroundColor: colors.border, overflow: 'hidden', marginTop: 6 },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: colors.blue },
} as const
