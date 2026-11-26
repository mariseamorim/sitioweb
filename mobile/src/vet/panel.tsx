// Painel do veterinário consultor no app: os dados de GET /api/veterinario (propriedades, tarefas e agenda), a
// abertura da propriedade de um cliente e os blocos de tarefas e de agenda usados em Consultoria e na tela Início.
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useImperativeHandle, useState, type Ref } from 'react'
import { FlatList, Modal, Pressable, SafeAreaView, Text, View } from 'react-native'
import { api, NetworkError } from '@/api/client'
import { useSession } from '@/auth/session'
import { getCache, setCache } from '@/db'
import { farmKind } from '@/lib/farmSegments'
import { todayISO } from '@/lib/format'
import { useLocale, useT } from '@/lib/i18n'
import { pendingCount } from '@/sync/local'
import { Badge, Button, Card, DateField, Field, Muted, Notice, SelectField, type Tone } from '@/ui'
import { colors, font, space } from '@/theme'

export interface VetClient {
  id: string; farmId: string; name: string; owner: string | null; city: string | null; state: string | null
  /** O que a propriedade faz (leite, cria, recria, engorda) */
  segments?: string[]
  animals: number; awaitingDiagnosis: number; pregnancyRate: number | null; birthsSoon: number
  /** Vacas prenhes agora (servidor novo; o antigo não manda) */
  pregnant?: number
  /** Partos previstos por mês ("AAAA-MM"): o mês atual e os 5 seguintes */
  birthsByMonth?: { month: string; count: number }[]
}
export interface VetVisit { id: string; clientId: string | null; farmName: string; date: string; time: string | null; purpose: string | null }
export interface VetTask { farmId: string; title: string; detail?: string; n: number; late?: number; href: string; tone: 'red' | 'amber' | 'blue' }
export interface VetPanel {
  vet: { name: string; inviteCode: string }
  openFarmId: string | null
  clients: VetClient[]
  /** O que fazer em cada propriedade (diagnósticos, partos, vacinas, tratamentos) */
  tasks?: VetTask[]
  /** Visitas marcadas a partir de hoje */
  visits?: VetVisit[]
  ended: { id: string; name: string; records: number }[]
}

const CACHE_KEY = 'vet_panel'

/** Painel do servidor; sem internet mostra a última cópia guardada. */
export function useVetPanel() {
  const t = useT()
  const [panel, setPanel] = useState<VetPanel | null>(() => getCache<VetPanel>(CACHE_KEY))
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState('')
  const reload = useCallback(async () => {
    try {
      const data = await api<VetPanel>('/api/veterinario')
      setCache(CACHE_KEY, data)
      setPanel(data)
      setOffline(false)
    } catch (e) {
      if (e instanceof NetworkError) setOffline(true)
      else setError(e instanceof Error ? t(e.message) : t('Não foi possível carregar o painel'))
    }
  }, [t])
  useEffect(() => { void reload() }, [reload])
  return { panel, offline, error, setError, reload }
}

/** Tela do app que corresponde à tela do site indicada na tarefa. */
export function appRoute(href: string) {
  if (href.startsWith('/reproducao/diagnostico')) return '/reproducao/diagnostico'
  if (href.startsWith('/vacinacao')) return '/(tabs)/vacinas'
  if (href.startsWith('/veterinary-treatment')) return '/tratamentos'
  if (href.startsWith('/animais')) return '/(tabs)/animais'
  if (href.startsWith('/reproducao/indicadores')) return '/reproducao/indicadores'
  return '/reproducao'
}

/** Abre a propriedade do cliente (se for outra) e segue para a tela pedida (sem tela: fica onde está). */
export function useOpenFarm(setError: (msg: string) => void) {
  const { user, switchFarm } = useSession()
  const router = useRouter()
  const t = useT()
  const [busy, setBusy] = useState<string | null>(null)
  const open = useCallback(async (farmId: string, next?: string): Promise<boolean> => {
    setError('')
    if (user?.farmId !== farmId) {
      // A fila é enviada na propriedade aberta: trocar com algo pendente mandaria a anotação para a propriedade errada
      if (user?.farmId && pendingCount(user.farmId).pending > 0) {
        setError(t('Ainda há anotações salvas só no celular. Conecte-se à internet e espere o envio antes de abrir outra propriedade.'))
        return false
      }
      setBusy(farmId)
      try {
        await switchFarm(farmId)
      } catch (e) {
        setError(e instanceof NetworkError ? t('Sem internet: para abrir outra propriedade é preciso conexão.') : e instanceof Error ? t(e.message) : t('Não foi possível abrir a propriedade'))
        return false
      } finally {
        setBusy(null)
      }
    }
    // Sem `next`: só troca a propriedade e fica na mesma tela (a barra da propriedade aberta)
    if (next) router.push(appRoute(next) as never)
    return true
  }, [user?.farmId, switchFarm, router, t, setError])
  return { open, busy }
}

/** Etiqueta da pendência: atrasada primeiro, depois atenção, depois aviso */
const BADGE: Record<VetTask['tone'], { label: string; order: number }> = { red: { label: 'Atrasada', order: 0 }, amber: { label: 'Atenção', order: 1 }, blue: { label: 'Aviso', order: 2 } }

/** Pendências de uma propriedade, as atrasadas primeiro */
export function farmTasks(panel: VetPanel | null, farmId: string) {
  return (panel?.tasks ?? []).filter(k => k.farmId === farmId).sort((a, b) => BADGE[a.tone].order - BADGE[b.tone].order)
}

/** Leite, corte ou os dois, com cor própria: o veterinário bate o olho e sabe que fazenda é */
const KIND_TONE: Record<string, Tone> = { Leite: 'blue', Corte: 'amber', 'Leite e corte': 'purple' }
export function FarmKindBadge({ segments }: { segments?: string[] | null }) {
  const kind = farmKind(segments)
  return <Badge label={kind ?? 'Tipo não informado'} tone={kind ? KIND_TONE[kind] : 'muted'} />
}

/**
 * Pendências de uma propriedade, dentro do cartão dela na Consultoria: uma linha por tipo (diagnóstico, partos,
 * vacinas, tratamentos). Tocar abre a propriedade na tela certa. É o único lugar com a lista; o Início só resume.
 */
export function FarmTasks({ panel, farmId, onOpen, busy }: { panel: VetPanel; farmId: string; onOpen: (farmId: string, href: string) => void; busy: string | null }) {
  const t = useT()
  const tasks = farmTasks(panel, farmId)
  if (!tasks.length) return <Muted style={{ marginTop: space.sm }}>{t('Nada pendente nesta propriedade.')}</Muted>
  return (
    <View style={{ marginTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
      {tasks.map(k => (
        <Pressable key={k.title} disabled={!!busy} onPress={() => onOpen(farmId, k.href)} accessibilityRole="button"
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 48, paddingVertical: space.sm, borderBottomWidth: 1, borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 })}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '600' }}>{t(k.title, { n: k.n })}</Text>
            {k.late || k.detail ? <Muted>{[k.late ? t(k.late === 1 ? '{n} já passou da data' : '{n} já passaram da data', { n: k.late }) : null, k.detail ? t(k.detail) : null].filter(Boolean).join(' · ')}</Muted> : null}
          </View>
          <Badge label={BADGE[k.tone].label} tone={k.tone} />
          <Text style={{ color: colors.muted, fontSize: font.lg }}>›</Text>
        </Pressable>
      ))}
    </View>
  )
}

/** Propriedades atendidas para escolher: do painel (com números) ou, sem ele, da sessão */
function farmChoices(panel: VetPanel | null, farms: { id: string; name: string; segments?: string[] }[]) {
  if (panel?.clients.length) {
    return panel.clients.map(c => ({ farmId: c.farmId, name: c.name, segments: c.segments, place: [c.city, c.state].filter(Boolean).join(', '), animals: c.animals as number | null, tasks: farmTasks(panel, c.farmId) }))
  }
  return farms.map(f => ({ farmId: f.id, name: f.name, segments: f.segments, place: '', animals: null as number | null, tasks: [] as VetTask[] }))
}

/**
 * Veterinário: de qual propriedade são os animais e os lançamentos da tela, se ela é de leite ou de corte, e a troca
 * por outra sem sair da tela. Fica no topo do Início, de Animais e de Reprodução.
 */
export function VetFarmBar() {
  const { user } = useSession()
  const t = useT()
  // Só a cópia guardada: a barra aparece em várias telas e não precisa buscar o painel de novo a cada uma
  const panel = getCache<VetPanel>(CACHE_KEY)
  const [error, setError] = useState('')
  const [picking, setPicking] = useState(false)
  const { open, busy } = useOpenFarm(setError)
  if (!user?.vet) return null
  const choices = farmChoices(panel, user.farms)
  const current = choices.find(c => c.farmId === user.farmId)
  const animals = current?.animals ?? null
  const animalsText = (n: number) => t(n === 1 ? '{n} animal' : '{n} animais', { n })
  return (
    <View style={{ marginBottom: space.md }}>
      <Pressable disabled={choices.length < 2} onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel={t('Trocar propriedade')}
        style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: colors.green, borderRadius: 12, padding: space.md, opacity: pressed ? 0.8 : 1 })}>
        <View style={{ flex: 1, gap: 4 }}>
          <Muted>{t('Propriedade aberta')}</Muted>
          <Text style={{ color: colors.greenDark, fontSize: font.lg, fontWeight: '800' }} numberOfLines={2}>{user.farmName ?? t('nenhuma')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
            <FarmKindBadge segments={current?.segments ?? user.farmSegments} />
            {animals !== null ? <Muted>{animalsText(animals)}</Muted> : null}
          </View>
        </View>
        {choices.length > 1 ? <Text style={{ color: colors.green, fontWeight: '700', fontSize: font.md }}>{t('Trocar')} ›</Text> : null}
      </Pressable>
      {error && !picking ? <Notice tone="red" text={error} /> : null}
      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg }}>
            <Text style={{ fontSize: font.lg, fontWeight: '800', color: colors.text }}>{t('Escolher a propriedade')}</Text>
            <Pressable onPress={() => setPicking(false)} hitSlop={12}><Text style={{ color: colors.green, fontWeight: '700', fontSize: font.md }}>{t('Fechar')}</Text></Pressable>
          </View>
          {error ? <View style={{ paddingHorizontal: space.lg }}><Notice tone="red" text={error} /></View> : null}
          <FlatList
            data={choices}
            keyExtractor={c => c.farmId}
            contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}
            renderItem={({ item: c }) => {
              const isOpen = c.farmId === user.farmId
              const late = c.tasks.some(k => k.tone === 'red')
              const info = [
                c.place,
                c.animals !== null ? animalsText(c.animals) : null,
                c.tasks.length ? t(c.tasks.length === 1 ? '{n} pendência' : '{n} pendências', { n: c.tasks.length }) : null,
              ].filter(Boolean).join(' · ')
              return (
                <Pressable disabled={!!busy} accessibilityRole="button" accessibilityState={{ selected: isOpen }}
                  onPress={async () => {
                    if (isOpen) return setPicking(false)
                    setError('')
                    // Só fecha se trocou: o erro (sem internet, anotação na fila) fica visível na lista
                    if (await open(c.farmId)) setPicking(false)
                  }}
                  style={({ pressed }) => ({ backgroundColor: isOpen ? colors.greenSoft : colors.white, borderWidth: isOpen ? 2 : 1, borderColor: isOpen ? colors.green : colors.border, borderRadius: 12, padding: space.md, marginBottom: space.sm, gap: 4, opacity: busy === c.farmId ? 0.5 : pressed ? 0.7 : 1 })}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <Text style={{ flex: 1, color: colors.text, fontSize: font.md, fontWeight: '700' }} numberOfLines={2}>{c.name}</Text>
                    {isOpen ? <Text style={{ color: colors.green, fontWeight: '700', fontSize: font.sm }}>{t('Aberta')}</Text> : null}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
                    <FarmKindBadge segments={c.segments} />
                    {late ? <Badge label="Atrasada" tone="red" /> : null}
                  </View>
                  {info ? <Muted>{info}</Muted> : null}
                </Pressable>
              )
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  )
}

interface Form { id?: string; clientId: string; date: string; time: string; purpose: string }

/**
 * Agenda de visitas. Completa (Consultoria): marcar, remarcar, concluir e cancelar, com internet.
 * Resumida (Início): as próximas três e o atalho para a Consultoria.
 */
/** O topo da Consultoria abre o formulário de nova visita pelo botão "+ Visita" */
export interface AgendaHandle { openNew: () => void }

export function VetAgenda({ panel, onChanged, compact, ref }: { panel: VetPanel; onChanged: () => Promise<void>; compact?: boolean; ref?: Ref<AgendaHandle> }) {
  const t = useT()
  const locale = useLocale()
  const router = useRouter()
  const today = todayISO()
  const [form, setForm] = useState<Form | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const openNew = () => { setError(''); setForm({ clientId: panel.clients[0]?.id ?? '', date: today, time: '', purpose: '' }) }
  useImperativeHandle(ref, () => ({ openNew }))
  const visits = panel.visits ?? []
  const shown = compact ? visits.slice(0, 3) : visits
  const label = (v: VetVisit) => {
    const d = v.date.slice(0, 10)
    const when = d === today ? t('Hoje') : new Date(v.date).toLocaleDateString(locale, { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'UTC' })
    return `${when}${v.time ? ` · ${v.time}` : ''} · ${v.farmName}`
  }

  async function send(path: string, method: 'POST' | 'PATCH', body: unknown) {
    setError('')
    setBusy(true)
    try {
      await api(path, { method, body })
      await onChanged()
      return true
    } catch (e) {
      setError(e instanceof NetworkError ? t('Sem internet: a agenda precisa de conexão para mudar.') : e instanceof Error ? t(e.message) : t('Não foi possível salvar.'))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function save() {
    if (!form) return
    const time = form.time.trim()
    if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return setError(t('Horário no formato 08:30'))
    const ok = form.id
      ? await send(`/api/veterinario/visitas/${form.id}`, 'PATCH', { date: form.date, time, purpose: form.purpose })
      : await send('/api/veterinario/visitas', 'POST', { clientId: form.clientId, date: form.date, time, purpose: form.purpose })
    if (ok) setForm(null)
  }

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
        <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{t('Agenda de visitas')}</Text>
        {compact ? null : <Button label={t('+ Marcar visita')} variant="secondary" disabled={!panel.clients.length || busy} onPress={openNew} />}
      </View>
      {error && !form ? <Notice tone="red" text={error} /> : null}
      {!visits.length ? <Muted style={{ marginTop: space.sm }}>{t('Nenhuma visita marcada.')}</Muted> : null}
      {shown.map(v => {
        const isToday = v.date.slice(0, 10) === today
        return (
          // Visita de hoje em destaque, com borda laranja
          <View key={v.id} style={{ marginTop: space.md, padding: space.md, borderRadius: 12, borderWidth: isToday ? 2 : 1, borderColor: isToday ? '#f59e0b' : colors.border, backgroundColor: isToday ? '#fffbeb' : colors.white }}>
            <Text style={{ color: isToday ? '#92400e' : colors.text, fontWeight: '700', fontSize: font.md }}>{label(v)}</Text>
            <Muted>{v.purpose || t('Sem motivo anotado')}</Muted>
            {compact ? null : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
                <Button label={t('Concluir')} disabled={busy} onPress={() => void send(`/api/veterinario/visitas/${v.id}`, 'PATCH', { status: 'realizada' })} />
                <Button label={t('Remarcar')} variant="ghost" disabled={busy} onPress={() => { setError(''); setForm({ id: v.id, clientId: v.clientId ?? '', date: v.date.slice(0, 10), time: v.time ?? '', purpose: v.purpose ?? '' }) }} />
                <Button label={t('Cancelar')} variant="ghost" disabled={busy} onPress={() => void send(`/api/veterinario/visitas/${v.id}`, 'PATCH', { status: 'cancelada' })} />
              </View>
            )}
          </View>
        )
      })}
      {compact ? (
        <Button label={visits.length > 3 ? t('Ver a agenda toda ({n})', { n: visits.length }) : t('Abrir a Consultoria')} variant="secondary" onPress={() => router.push('/consultoria')} style={{ marginTop: space.md }} />
      ) : null}

      {form ? (
        <View style={{ marginTop: space.md, paddingTop: space.md, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md, marginBottom: space.sm }}>{t(form.id ? 'Remarcar visita' : 'Marcar visita')}</Text>
          {form.id ? null : <SelectField label={t('Propriedade')} value={form.clientId} options={panel.clients.map(c => ({ value: c.id, label: c.name }))} onChange={clientId => setForm({ ...form, clientId: clientId ?? form.clientId })} />}
          <DateField label={t('Dia')} value={form.date} onChange={date => setForm({ ...form, date })} />
          <Field label={t('Horário')} value={form.time} onChangeText={time => setForm({ ...form, time })} placeholder="08:30" keyboardType="numbers-and-punctuation" maxLength={5} />
          <Field label={t('Motivo')} value={form.purpose} onChangeText={purpose => setForm({ ...form, purpose })} placeholder={t('Diagnóstico de gestação, inseminação, vacinação…')} maxLength={200} />
          {error ? <Notice tone="red" text={error} /> : null}
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <Button label={t('Fechar')} variant="secondary" onPress={() => setForm(null)} style={{ flex: 1 }} />
            <Button label={t(form.id ? 'Remarcar' : 'Marcar visita')} loading={busy} onPress={() => void save()} style={{ flex: 1 }} />
          </View>
        </View>
      ) : null}
    </Card>
  )
}
