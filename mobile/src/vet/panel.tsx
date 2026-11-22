// Painel do veterinário consultor no app: os dados de GET /api/veterinario (propriedades, tarefas e agenda), a
// abertura da propriedade de um cliente e os blocos de tarefas e de agenda usados em Consultoria e na tela Início.
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useImperativeHandle, useState, type Ref } from 'react'
import { Pressable, Text, View } from 'react-native'
import { api, NetworkError } from '@/api/client'
import { useSession } from '@/auth/session'
import { getCache, setCache } from '@/db'
import { todayISO } from '@/lib/format'
import { useLocale, useT } from '@/lib/i18n'
import { pendingCount } from '@/sync/local'
import { Badge, Button, Card, DateField, Field, Muted, Notice, SelectField } from '@/ui'
import { colors, font, space } from '@/theme'

export interface VetClient {
  id: string; farmId: string; name: string; owner: string | null; city: string | null; state: string | null
  animals: number; awaitingDiagnosis: number; pregnancyRate: number | null; birthsSoon: number
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

/** Abre a propriedade do cliente (se for outra) e segue para a tela pedida. */
export function useOpenFarm(setError: (msg: string) => void) {
  const { user, switchFarm } = useSession()
  const router = useRouter()
  const t = useT()
  const [busy, setBusy] = useState<string | null>(null)
  const open = useCallback(async (farmId: string, next: string) => {
    setError('')
    if (user?.farmId !== farmId) {
      // A fila é enviada na propriedade aberta: trocar com algo pendente mandaria a anotação para a propriedade errada
      if (user?.farmId && pendingCount(user.farmId).pending > 0) {
        setError(t('Ainda há anotações salvas só no celular. Conecte-se à internet e espere o envio antes de abrir outra propriedade.'))
        return
      }
      setBusy(farmId)
      try {
        await switchFarm(farmId)
      } catch (e) {
        setError(e instanceof NetworkError ? t('Sem internet: para abrir outra propriedade é preciso conexão.') : e instanceof Error ? t(e.message) : t('Não foi possível abrir a propriedade'))
        return
      } finally {
        setBusy(null)
      }
    }
    router.push(appRoute(next) as never)
  }, [user?.farmId, switchFarm, router, t, setError])
  return { open, busy }
}

/** Etiqueta da pendência: atrasada primeiro, depois atenção, depois aviso */
const BADGE: Record<VetTask['tone'], { label: string; order: number }> = { red: { label: 'Atrasada', order: 0 }, amber: { label: 'Atenção', order: 1 }, blue: { label: 'Aviso', order: 2 } }

/** Pendências das propriedades atendidas, as atrasadas primeiro. Tocar abre a propriedade na tela certa. */
export function VetTasks({ panel, onOpen, busy }: { panel: VetPanel; onOpen: (farmId: string, href: string) => void; busy: string | null }) {
  const t = useT()
  const tasks = (panel.tasks ?? [])
    .flatMap(k => { const c = panel.clients.find(x => x.farmId === k.farmId); return c ? [{ k, c }] : [] })
    .sort((a, b) => BADGE[a.k.tone].order - BADGE[b.k.tone].order)
  return (
    <View style={{ marginBottom: space.md }}>
      <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.lg, marginBottom: space.sm }}>{t('Pendências')}</Text>
      {!tasks.length ? <Card><Muted>{t('Nada pendente nas propriedades que você atende.')}</Muted></Card> : null}
      {tasks.map(({ k, c }) => {
        const detail = [c.name, k.late ? t(k.late === 1 ? '{n} já passou da data' : '{n} já passaram da data', { n: k.late }) : null, k.detail ? t(k.detail) : null].filter(Boolean).join(' · ')
        return (
          <Pressable key={k.farmId + k.title} disabled={!!busy} onPress={() => onOpen(c.farmId, k.href)} accessibilityRole="button"
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: space.md, marginBottom: space.sm, opacity: busy === c.farmId ? 0.5 : pressed ? 0.7 : 1 })}>
            <View style={{ flex: 1, gap: 2 }}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
                <Text style={{ color: colors.text, fontSize: font.md, fontWeight: '700' }}>{t(k.title, { n: k.n })}</Text>
                <Badge label={BADGE[k.tone].label} tone={k.tone} />
              </View>
              <Muted>{detail}</Muted>
            </View>
            <Text style={{ color: colors.muted, fontSize: font.lg }}>›</Text>
          </Pressable>
        )
      })}
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

/** Topo da tela Início do veterinário: o que fazer nas propriedades e as próximas visitas. */
export function VetToday() {
  const { panel, reload } = useVetPanel()
  const [error, setError] = useState('')
  const { open, busy } = useOpenFarm(setError)
  const router = useRouter()
  if (!panel) return null
  return (
    <>
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Abrir a agenda da semana" icon="calendar-outline" onPress={() => router.push('/agenda')} style={{ marginBottom: space.md }} />
      <VetTasks panel={panel} onOpen={(farmId, href) => void open(farmId, href)} busy={busy} />
      <VetAgenda panel={panel} onChanged={reload} compact />
    </>
  )
}
