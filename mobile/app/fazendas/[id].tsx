import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Text } from 'react-native'
import { api, HttpError } from '@/api/client'
import { useFarmId, useSession } from '@/auth/session'
import type { Row } from '@/db'
import { DOCUMENT_TYPES, FARM_SEGMENTS, PROPERTY_TYPES } from '@/lib/farmSegments'
import { DOCUMENT_PLACEHOLDER, maskDocument, maskPhone } from '@/lib/masks'
import { EMPTY_FARM, adoptFarm, createFarmLocal, farmBody, getFarm, updateFarm, type FarmInput } from '@/repos/farms'
import { pendingCount } from '@/sync/local'
import { useSyncState } from '@/sync'
import { Button, Chips, Field, Notice, Screen, SelectField, styles } from '@/ui'
import { CheckGroup } from '@/ui/checks'

const PENDING_MESSAGE = 'Ainda há anotações salvas só no celular. Conecte-se à internet e espere o "Tudo enviado" antes de trocar de propriedade.'
const SEGMENT_OPTIONS = FARM_SEGMENTS.map(s => ({ key: s.key, label: s.label }))

// Cadastro (id = 'nova') ou edição de uma propriedade, com os mesmos campos do site.
export default function FazendaForm() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const farmId = useFarmId()
  const { user, canEdit, canAccess, switchFarm } = useSession()
  const sync = useSyncState()
  const router = useRouter()
  const editing = id && id !== 'nova' ? getFarm(id) : null
  const isAdmin = user?.role === 'admin'

  const [form, setForm] = useState<FarmInput>(() => editing ? {
    name: editing.name, propertyType: editing.propertyType ?? 'Fazenda', documentType: editing.documentType ?? 'CNPJ', documentNumber: editing.documentNumber ?? '',
    owner: editing.owner ?? '', phone: editing.phone ?? '', address: editing.address ?? '', city: editing.city ?? '', state: editing.state ?? '', segments: editing.segments,
  } : EMPTY_FARM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (patch: Partial<FarmInput>) => setForm(f => ({ ...f, ...patch }))

  async function save() {
    setError('')
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    if (form.state.trim() && !/^[A-Za-z]{2}$/.test(form.state.trim())) { setError('Informe a sigla do estado com duas letras'); return }
    if (editing) { updateFarm(farmId, editing.id, form); router.back(); return }
    if (isAdmin) { createFarmLocal(farmId, form); router.back(); return }

    // Produtor: a propriedade nova já abre. Com anotações pendentes no celular, elas iriam para a propriedade errada.
    if (pendingCount(farmId).pending > 0) { setError(PENDING_MESSAGE); return }
    if (!sync.online) {
      createFarmLocal(farmId, form)
      setError('Sem internet: o cadastro ficou na fila e será enviado quando o sinal voltar. A propriedade abre depois de enviada.')
      return
    }
    setSaving(true)
    try {
      const created = await api<Row>('/api/farms', { method: 'POST', body: farmBody(form) })
      adoptFarm(farmId, created)
      await switchFarm(String(created.id))
      router.replace('/(tabs)')
    } catch (e) {
      setError(e instanceof HttpError ? e.message : 'Sem internet. Esta ação precisa de conexão; tente de novo quando o sinal voltar.')
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit || !canAccess('fazendas')) return <Screen><Notice tone="red" text="Você não tem permissão para esta ação" /></Screen>
  if (id !== 'nova' && !editing) return <Screen><Notice tone="red" text="Propriedade não encontrada" /></Screen>

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? 'Editar propriedade' : 'Cadastrar propriedade' }} />
      <Text style={styles.label}>Tipo de Propriedade *</Text>
      <Chips options={PROPERTY_TYPES.map(t => ({ value: t, label: t }))} value={form.propertyType as (typeof PROPERTY_TYPES)[number]} onChange={v => set({ propertyType: v })} />
      <CheckGroup label="O que a propriedade faz? (pode marcar mais de um)" options={SEGMENT_OPTIONS} value={form.segments} onChange={segments => set({ segments })} />
      <Field label="Nome *" value={form.name} onChangeText={name => set({ name })} placeholder={`Nome ${form.propertyType === 'Sítio' ? 'do Sítio' : 'da Fazenda'}`} />
      <Field label="Proprietário" value={form.owner} onChangeText={owner => set({ owner })} placeholder="Nome do proprietário" autoCapitalize="words" />
      <SelectField label="Doc. Tipo" value={form.documentType} options={DOCUMENT_TYPES.map(t => ({ value: t, label: t }))}
        onChange={v => set({ documentType: v ?? 'CNPJ', documentNumber: maskDocument(form.documentNumber, v ?? 'CNPJ') })} />
      <Field label="Documento (CPF/CNPJ)" value={form.documentNumber} onChangeText={t => set({ documentNumber: maskDocument(t, form.documentType) })} keyboardType="numeric"
        placeholder={DOCUMENT_PLACEHOLDER[form.documentType] ?? DOCUMENT_PLACEHOLDER.CPF} />
      <Field label="Telefone" value={form.phone} onChangeText={t => set({ phone: maskPhone(t) })} keyboardType="phone-pad" placeholder="(35) 99999-0000" />
      <Field label="Endereço" value={form.address} onChangeText={address => set({ address })} />
      <Field label="Cidade" value={form.city} onChangeText={city => set({ city })} />
      <Field label="Estado" value={form.state} onChangeText={state => set({ state: state.toUpperCase() })} placeholder="SP" maxLength={2} autoCapitalize="characters" />
      {error ? <Notice tone={error.startsWith('Sem internet:') ? 'amber' : 'red'} text={error} /> : null}
      <Button label="Salvar" onPress={() => void save()} loading={saving} />
    </Screen>
  )
}
