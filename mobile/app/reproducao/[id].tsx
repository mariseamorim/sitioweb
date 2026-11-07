import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { canAddCalf } from '@/lib/animalRules'
import { COVERAGE_METHODS, EMPTY_COVERAGE, gestation, isInsemination, methodLabel, repeatCoverage, repeatedFields, type CoverageForm } from '@/lib/coverage'
import { brDate, isoDay, todayISO } from '@/lib/format'
import { getAnimal } from '@/repos/animals'
import {
  breedableFemales, calfCandidates, createCoverage, getReproduction, isOpen, linkExistingCalf, registerBirth, removeReproduction,
  STATUS_LIST, statusTone, updateCoverage, updateStatus, type Reproduction,
} from '@/repos/reproductions'
import { Badge, Button, Card, Chips, DateField, Field, Muted, Notice, Screen, SelectField } from '@/ui'
import { colors, font, radius, space } from '@/theme'

const STATUS_OPTIONS = STATUS_LIST.map(s => ({ value: s, label: s }))

// Reprodução: id = "nova" abre "Registrar cobertura"; um id existente abre o detalhe do registro
export default function ReproducaoScreen() {
  const { id, femaleId, status } = useLocalSearchParams<{ id: string; femaleId?: string; status?: string }>()
  if (!id || id === 'nova') return <CoverageFormScreen presetFemaleId={femaleId} presetStatus={status} />
  return <DetailScreen id={id} />
}

// ── Registrar cobertura ────────────────────────────────────────────────

function CoverageFormScreen({ presetFemaleId, presetStatus }: { presetFemaleId?: string; presetStatus?: string }) {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const females = useLive(() => breedableFemales(farmId), [farmId])
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

  // Salva a cobertura. Com `repeat`, mantém data, tipo, touro, partida e inseminador e limpa só a fêmea:
  // é o dia de IATF, em que a fila toda leva o mesmo sêmen e só muda o brinco.
  function save(repeat: boolean) {
    if (!form.femaleId) { setError('Escolha a fêmea'); return }
    if (!form.coverageDate) { setError('Informe a data da cobertura'); return }
    setError('')
    createCoverage(farmId, form)
    if (repeat) {
      setForm(repeatCoverage(form))
      setRepeated(prev => ({ count: (prev?.count ?? 0) + 1, kept: repeatedFields(form) }))
      return
    }
    router.back()
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'Registrar cobertura' }} />
      {!canEdit ? <Notice tone="red" text="Sua conta só pode consultar." /> : null}
      {repeated ? <Notice tone="green" text={`${repeated.count} cobertura${repeated.count === 1 ? '' : 's'} salva${repeated.count === 1 ? '' : 's'}. Mantido para a próxima fêmea: ${repeated.kept.join(', ')}.`} /> : null}
      <SelectField label="Fêmea" value={form.femaleId || null} onChange={v => set({ femaleId: v ?? '' })} searchable placeholder="Escolher a fêmea"
        options={females.map(a => ({ value: a.id, label: a.name, detail: `${a.customCode || a.code} · ${a.species}` }))} />
      <Text style={styles.label}>Como foi</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.md }}>
        {COVERAGE_METHODS.map(m => {
          const on = form.method === m.key
          return (
            <Pressable key={m.key} onPress={() => set({ method: on ? '' : m.key })} style={[styles.method, on && { borderColor: colors.green, backgroundColor: colors.greenSoft }]}>
              <Text style={{ fontWeight: '700', color: on ? colors.green : colors.text }}>{m.label}</Text>
              <Muted>{m.hint}</Muted>
            </Pressable>
          )
        })}
      </View>
      <Field label="Touro" value={form.maleName} onChangeText={v => set({ maleName: v })} placeholder="Nome ou código do touro" />
      <DateField label="Data da cobertura *" value={form.coverageDate} onChange={v => set({ coverageDate: v })} />
      {form.status === 'Prenha' && !form.coverageDate ? <Notice text="Se não souber o dia certo, coloque uma data aproximada: ela define a previsão do parto." /> : null}
      <SelectField label="Status" value={form.status} options={STATUS_OPTIONS} onChange={v => set({ status: v ?? 'Coberta' })} />
      {/* Detalhes recolhidos: o registro rápido é fêmea, como foi, touro e data */}
      {!more ? <Button label="Mais detalhes (opcional)" variant="ghost" onPress={() => setShowMore(true)} style={{ marginBottom: space.md }} /> : (
        <Card>
          <Text style={[styles.label, { marginBottom: space.md }]}>Mais detalhes (opcional)</Text>
          {isInsemination(form.method) ? (
            <View>
              <Field label="Partida do sêmen" value={form.semenBatch} onChangeText={v => set({ semenBatch: v })} placeholder="Ex.: 2412-A" autoCapitalize="characters" />
              <Field label="Inseminador" value={form.inseminator} onChangeText={v => set({ inseminator: v })} placeholder="Quem inseminou" />
            </View>
          ) : null}
          <Field label="Registro do touro" value={form.bullRegistry} onChangeText={v => set({ bullRegistry: v })} placeholder="Ex.: RGD 12345" />
          <DateField label="Data do cio" value={form.heatDate} onChange={v => set({ heatDate: v })} allowEmpty />
          <Field label="Observações" value={form.observations} onChangeText={v => set({ observations: v })} multiline />
        </Card>
      )}
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Salvar" onPress={() => save(false)} disabled={!canEdit} />
      <Button label="Salvar e repetir para outra fêmea" variant="secondary" onPress={() => save(true)} disabled={!canEdit} style={{ marginTop: space.sm }} />
      <Muted style={{ marginTop: space.sm }}>Para o dia de inseminação: a data, o tipo, o touro, a partida e o inseminador ficam preenchidos e só a fêmea muda.</Muted>
      {repeated ? <Button label="Fechar" variant="ghost" onPress={() => router.back()} style={{ marginTop: space.sm }} /> : null}
    </Screen>
  )
}

// ── Detalhe do registro ────────────────────────────────────────────────

function DetailScreen({ id }: { id: string }) {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const r = useLive(() => getReproduction(id), [id])
  const [mode, setMode] = useState<'ver' | 'editar' | 'parto'>('ver')
  const [editStatus, setEditStatus] = useState<string | null>(r?.status ?? null)
  const [editBirthDate, setEditBirthDate] = useState(isoDay(r?.actualBirthDate))

  if (!r) return <Screen><Stack.Screen options={{ title: 'Reprodução' }} /><Notice text="Registro não encontrado." /></Screen>

  const g = isOpen(r) ? gestation(r.coverageDate, r.expectedBirthDate, todayISO()) : null
  const mother = canEdit && isOpen(r) ? getAnimal(r.femaleId) : null

  function saveStatus() {
    updateStatus(farmId, r!.id, editStatus || r!.status, editStatus === 'Parida' ? editBirthDate : '')
    router.back()
  }

  function remove() {
    Alert.alert('Excluir este registro de reprodução?', undefined, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { removeReproduction(farmId, r!.id); router.back() } },
    ])
  }

  const item = (label: string, value: string, tone?: string) => (
    <View style={{ marginBottom: space.sm }}>
      <Muted>{label}</Muted>
      <Text style={{ color: tone ?? colors.text, fontWeight: '600', fontSize: font.md }}>{value}</Text>
    </View>
  )

  return (
    <Screen>
      <Stack.Screen options={{ title: r.femaleName ?? 'Reprodução' }} />
      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: space.md }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 22, fontWeight: '700', color: colors.text }}>{r.femaleName ?? 'Animal removido'}</Text>
            <Muted>Cobertura: {brDate(r.coverageDate)}</Muted>
          </View>
          <Badge label={r.status} tone={statusTone(r.status)} />
        </View>
        {item('Touro', `${r.maleName || '—'}${r.bullRegistry ? ` · ${r.bullRegistry}` : ''}`)}
        {r.method ? item('Como foi', `${methodLabel(r.method)}${r.semenBatch ? ` · partida ${r.semenBatch}` : ''}`) : null}
        {r.inseminator ? item('Inseminador', r.inseminator) : null}
        {r.heatDate ? item('Cio', brDate(r.heatDate)) : null}
        {item('Parto esperado', r.expectedBirthDate ? brDate(r.expectedBirthDate) : '—')}
        {g ? (
          <View style={{ marginBottom: space.sm }}>
            <Muted>Gestação</Muted>
            <Text style={{ color: colors.text, fontWeight: '600' }}>
              {g.days} dia{g.days === 1 ? '' : 's'} · {g.toBirth >= 0 ? `faltam ${g.toBirth} dia${g.toBirth === 1 ? '' : 's'} para o parto` : `parto atrasado ${-g.toBirth} dia${g.toBirth === -1 ? '' : 's'}`}
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
        : <Button label="Registrar parto e anotar a cria" onPress={() => setMode('parto')} style={{ marginBottom: space.md }} />) : null}

      {canEdit ? (mode === 'editar'
        ? <RecordEditor farmId={farmId} record={r} onCancel={() => setMode('ver')} onSaved={() => setMode('ver')} />
        : <Button label="Editar registro" variant="secondary" onPress={() => setMode('editar')} style={{ marginBottom: space.md }} />) : null}

      {canEdit ? (
        <Card>
          <Text style={[styles.label, { marginBottom: space.md }]}>Atualizar status</Text>
          <SelectField label="Status" value={editStatus} options={STATUS_OPTIONS} onChange={setEditStatus} />
          {editStatus === 'Parida' ? <DateField label="Data do parto" value={editBirthDate} onChange={setEditBirthDate} allowEmpty /> : null}
          <Button label="Salvar" onPress={saveStatus} />
          <Button label="Excluir" variant="ghost" onPress={remove} style={{ marginTop: space.sm }} />
        </Card>
      ) : null}
    </Screen>
  )
}

/** Corrigir a cobertura: datas, reprodutor, inseminação ou monta, sêmen, registro do touro e observações */
function RecordEditor({ farmId, record, onCancel, onSaved }: { farmId: string; record: Reproduction; onCancel: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<CoverageForm & { expectedBirthDate: string }>({
    femaleId: record.femaleId, status: record.status, coverageDate: isoDay(record.coverageDate), expectedBirthDate: isoDay(record.expectedBirthDate),
    heatDate: isoDay(record.heatDate), method: record.method ?? '', maleName: record.maleName ?? '', bullRegistry: record.bullRegistry ?? '',
    semenBatch: record.semenBatch ?? '', inseminator: record.inseminator ?? '', observations: record.observations ?? '',
  })
  const [error, setError] = useState('')
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }))

  function save() {
    if (!form.coverageDate) { setError('Informe a data da cobertura'); return }
    // A data da cobertura recalcula o parto previsto; a previsão digitada vale por cima
    updateCoverage(farmId, record, form)
    onSaved()
  }

  return (
    <Card>
      <Text style={[styles.label, { marginBottom: space.md }]}>Editar registro</Text>
      <DateField label="Data da cobertura" value={form.coverageDate} onChange={v => set({ coverageDate: v })} />
      <DateField label="Parto estimado" value={form.expectedBirthDate} onChange={v => set({ expectedBirthDate: v })} allowEmpty />
      <DateField label="Data do cio" value={form.heatDate} onChange={v => set({ heatDate: v })} allowEmpty />
      <SelectField label="Como foi" value={form.method || null} onChange={v => set({ method: v ?? '' })} allowEmpty placeholder="Não informado"
        options={COVERAGE_METHODS.map(m => ({ value: m.key, label: m.label, detail: m.hint }))} />
      <Field label="Touro (nome)" value={form.maleName} onChangeText={v => set({ maleName: v })} />
      <Field label="Registro do touro" value={form.bullRegistry} onChangeText={v => set({ bullRegistry: v })} />
      {isInsemination(form.method) || !form.method ? (
        <View>
          <Field label="Partida do sêmen" value={form.semenBatch} onChangeText={v => set({ semenBatch: v })} autoCapitalize="characters" />
          <Field label="Inseminador" value={form.inseminator} onChangeText={v => set({ inseminator: v })} />
        </View>
      ) : null}
      <Field label="Observações" value={form.observations} onChangeText={v => set({ observations: v })} multiline />
      {error ? <Notice tone="red" text={error} /> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button label="Cancelar" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Salvar alteração" onPress={save} style={{ flex: 1 }} />
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
  const defaultName = `Cria da ${mother.name} ${birthDate.slice(0, 4)}`
  const candidates = calfCandidates(farmId, mother)

  function save() {
    if (!canAddCalf({ ...mother, isCastrated: !!mother.isCastrated })) { setError('A mãe precisa ter pelo menos 2 anos e meio para adicionar cria'); return }
    if (existing === 'existente') {
      const calf = candidates.find(c => c.id === existingId)
      if (!calf) { setError('Escolha a cria'); return }
      linkExistingCalf(farmId, reproduction, calf)
      onSaved()
      return
    }
    if (!gender) { setError('Escolha bezerro ou bezerra'); return }
    if (birthDate > todayISO()) { setError('A data do parto não pode ser no futuro'); return }
    if (birthDate < isoDay(mother.birthDate)) { setError('A data do parto não pode ser antes do nascimento da mãe'); return }
    registerBirth(farmId, reproduction, { name: name.trim() || defaultName, gender, birthDate, status })
    onSaved()
  }

  return (
    <Card style={{ borderColor: colors.green, backgroundColor: colors.greenSoft }}>
      <Text style={[styles.label, { marginBottom: space.xs }]}>Registrar parto</Text>
      <Chips options={[{ value: 'nova', label: 'Nova cria' }, { value: 'existente', label: 'Já está cadastrada' }]} value={existing} onChange={setExisting} />
      {existing === 'existente' ? (
        <View>
          <SelectField label={`Qual animal é cria da ${mother.name}?`} value={existingId} onChange={setExistingId} searchable placeholder="Escolha"
            options={candidates.map(a => ({ value: a.id, label: a.name, detail: `${a.customCode || a.code} · nasceu em ${brDate(a.birthDate)}` }))} />
          {candidates.length === 0 ? <Muted style={{ marginBottom: space.md }}>Nenhum animal sem mãe e mais novo que ela.</Muted> : null}
        </View>
      ) : (
        <View>
          <DateField label="Data do parto" value={birthDate} onChange={setBirthDate} />
          <Text style={styles.label}>É bezerro ou bezerra?</Text>
          <Chips options={[{ value: 'Macho', label: 'Bezerro' }, { value: 'Fêmea', label: 'Bezerra' }]} value={gender} onChange={setGender} />
          <Field label="Nome (opcional)" value={name} onChangeText={setName} placeholder={defaultName} />
          <Text style={styles.label}>A cria</Text>
          <Chips options={OUTCOMES} value={status} onChange={setStatus} />
        </View>
      )}
      {error ? <Notice tone="red" text={error} /> : null}
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
        <Button label="Cancelar" variant="ghost" onPress={onCancel} style={{ flex: 1 }} />
        <Button label="Salvar cria" onPress={save} style={{ flex: 1 }} />
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
