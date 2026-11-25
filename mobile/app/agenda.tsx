import { Stack, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Linking, Pressable, ScrollView, Share, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { api, NetworkError } from '@/api/client'
import { useFarmId, useSession } from '@/auth/session'
import { getCache, setCache } from '@/db'
import { useLive } from '@/db/events'
import { isoDay, todayISO } from '@/lib/format'
import { AGENDA_GROUPS, AGENDA_KINDS, agendaGroup, agendaShareText, canMarkDone, countByDay, sortAgenda, ddmm, groupAgenda, shiftDay, type AgendaGroupKey, type AgendaItem, type AgendaKind } from '@/lib/agenda'
import { localAgenda, markAgendaDone, undoAgendaDone } from '@/repos/agenda'
import { getVaccination, saveVaccination } from '@/repos/vaccinations'
import { Button, Muted, Notice, Screen } from '@/ui'
import { useOpenFarm } from '@/vet/panel'
import { colors, font, radius, space } from '@/theme'
import { useLocale, useT } from '@/lib/i18n'

// Agenda (como src/components/AgendaView.tsx do site): visitas e manejos por dia, com a faixa da semana, filtros por
// tipo, ações rápidas e o envio pelo WhatsApp. Produtor: montada com o que está no celular (funciona sem internet).
// Veterinário: as propriedades todas, vindas do servidor (sem internet mostra a última cópia).

const KIND_STYLE: Record<AgendaKind, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string }> = {
  visita: { icon: 'home-outline', color: '#1d4ed8', bg: '#dbeafe' },
  vacina: { icon: 'medkit-outline', color: '#0f766e', bg: '#ccfbf1' },
  parto: { icon: 'heart-outline', color: '#7e22ce', bg: '#f3e8ff' },
  secagem: { icon: 'water-outline', color: '#b45309', bg: '#fef3c7' },
  preparto: { icon: 'heart-half-outline', color: '#c2410c', bg: '#ffedd5' },
  diagnostico: { icon: 'checkmark-done-outline', color: '#0369a1', bg: '#e0f2fe' },
  cio: { icon: 'repeat-outline', color: '#be185d', bg: '#fce7f3' },
  carencia: { icon: 'bandage-outline', color: '#b91c1c', bg: '#fee2e2' },
}

/** Tela do site de cada tipo (o veterinário abre a propriedade e segue para a tela equivalente do app) */
const siteHref = (kind: AgendaKind) => kind === 'vacina' ? '/vacinacao' : kind === 'carencia' ? '/veterinary-treatment' : '/reproducao'

/** Segunda-feira da semana do dia */
const weekStartOf = (day: string) => shiftDay(day, -((new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7))

const CACHE_KEY = 'vet_agenda'

export default function AgendaScreen() {
  const { user, canAccess, canEdit } = useSession()
  const farmId = useFarmId()
  const router = useRouter()
  const t = useT()
  const locale = useLocale()
  const isVet = !!user?.vet
  const today = todayISO()
  const [error, setError] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const [week, setWeek] = useState(() => weekStartOf(today))
  const [kind, setKind] = useState<AgendaKind | ''>('')
  // Produtor: abas por período (atrasados, hoje, amanhã, 7 dias, depois), sem semana e sem filtro por tipo
  const [groupTab, setGroupTab] = useState<AgendaGroupKey | null>(null)

  // Produtor: do celular
  const local = useLive(() => (isVet ? [] : localAgenda(farmId, today, canAccess)), [farmId, today, isVet])
  // Veterinário: do servidor
  const [remote, setRemote] = useState<AgendaItem[] | null>(() => (isVet ? getCache<{ items: AgendaItem[] }>(CACHE_KEY)?.items ?? null : null))
  const [offline, setOffline] = useState(false)
  const reload = useCallback(async () => {
    if (!isVet) return
    try {
      const data = await api<{ today: string; items: AgendaItem[] }>('/api/veterinario/agenda')
      setCache(CACHE_KEY, data)
      setRemote(data.items)
      setOffline(false)
    } catch (e) {
      if (e instanceof NetworkError) setOffline(true)
      else setError(e instanceof Error ? t(e.message) : t('Não foi possível carregar a agenda'))
    }
  }, [isVet, t])
  useEffect(() => { void reload() }, [reload])
  const { open, busy } = useOpenFarm(setError)

  // Produtor: as visitas do veterinário vêm do servidor (com internet), com a última cópia guardada no celular
  const visitsKey = `farm_visits_${farmId}`
  const [visits, setVisits] = useState<AgendaItem[]>(() => (isVet ? [] : getCache<AgendaItem[]>(visitsKey) ?? []))
  useEffect(() => {
    if (isVet) return
    api<{ items: AgendaItem[] }>('/api/agenda')
      .then(d => { const v = d.items.filter(i => i.kind === 'visita'); setCache(visitsKey, v); setVisits(v) })
      .catch(() => { /* sem internet: fica a cópia */ })
  }, [isVet, visitsKey])

  // Último manejo marcado como feito, para o "Desfazer"
  // Última ação da agenda, para o "Desfazer": Feito (id do registro) ou vacina Aplicada (volta a ficar sem data de aplicação)
  const [lastDone, setLastDone] = useState<{ item: AgendaItem; id: string; vaccine?: boolean } | null>(null)
  // Item esperando a resposta do servidor (veterinário): o botão mostra carregando e não aceita outro toque
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const all = useMemo(() => (isVet ? remote ?? [] : sortAgenda([...local, ...visits.filter(v => v.date >= shiftDay(today, -30))])), [isVet, remote, local, visits, today])
  const items = useMemo(() => all.filter(i => !kind || i.kind === kind), [all, kind])
  const counts = useMemo(() => countByDay(items), [items])
  const lateCount = items.filter(i => i.late).length
  const shown = selected ? items.filter(i => i.date === selected) : items
  const byGroup = new Map(AGENDA_GROUPS.map(g => [g.key, items.filter(i => agendaGroup(i, today) === g.key)]))
  const currentGroup = groupTab ?? AGENDA_GROUPS.find(g => byGroup.get(g.key)!.length)?.key ?? 'hoje'
  const groups = !isVet
    ? [{ key: currentGroup, label: '', items: byGroup.get(currentGroup) ?? [] }]
    : selected ? [{ key: 'dia', label: '', items: shown }] : groupAgenda(shown, today)
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(week, i))
  const fmt = (day: string, opts: Intl.DateTimeFormatOptions) => new Date(`${day}T12:00:00Z`).toLocaleDateString(locale, { timeZone: 'UTC', ...opts })
  const dayTitle = (day: string) => day === today ? t('Hoje') : day === shiftDay(today, 1) ? t('Amanhã') : fmt(day, { weekday: 'long', day: '2-digit', month: '2-digit' })

  async function share() {
    const list = selected ? shown : items.filter(i => i.date <= shiftDay(today, 7))
    const heading = selected ? t('Agenda de {date}', { date: dayTitle(selected) }) : t('Agenda dos próximos 7 dias')
    const text = list.length ? agendaShareText(list, heading, t) : `*${heading}*\n${t('Nada marcado.')}`
    // WhatsApp direto; sem ele instalado, a janela de compartilhar do celular
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`
    if (await Linking.canOpenURL(url).catch(() => false)) return Linking.openURL(url)
    await Share.share({ message: text })
  }

  function setVaccineApplied(refId: string, appliedDate: string) {
    const v = getVaccination(refId)
    if (!v) return false
    saveVaccination(farmId, {
      animalId: v.animalId, vaccineName: v.vaccineName, scheduledDate: isoDay(v.scheduledDate), appliedDate, appliedBy: v.appliedBy ?? '',
      batch: v.batch ?? '', manufacturer: v.manufacturer ?? '', observations: v.observations ?? '',
    }, v.id)
    return true
  }

  function applyVaccine(item: AgendaItem) {
    setError('')
    if (setVaccineApplied(item.refId, today)) setLastDone({ item, id: item.refId, vaccine: true })
  }

  async function markDone(item: AgendaItem) {
    setError('')
    if (!isVet) {
      setLastDone({ item, id: markAgendaDone(farmId, item.key) })
      return
    }
    setBusyKey(item.key)
    try {
      const row = await api<{ id: string }>('/api/agenda/feitos', { method: 'POST', body: { key: item.key, farmId: item.farmId } })
      setRemote(r => (r ?? []).filter(i => i.key !== item.key))
      setLastDone({ item, id: row.id })
    } catch (e) {
      setError(e instanceof NetworkError ? t('Sem internet: marque como feito quando a conexão voltar.') : e instanceof Error ? t(e.message) : t('Não foi possível salvar.'))
    } finally {
      setBusyKey(null)
    }
  }

  async function undoDone() {
    if (!lastDone) return
    const { item, id, vaccine } = lastDone
    setLastDone(null)
    if (vaccine) return void setVaccineApplied(id, '')
    if (!isVet) return undoAgendaDone(farmId, id)
    try {
      await api(`/api/agenda/feitos/${id}`, { method: 'DELETE' })
      setRemote(r => sortAgenda([...(r ?? []), item]))
    } catch {
      setError(t('Não foi possível desfazer. Tente de novo.'))
    }
  }

  async function visit(item: AgendaItem, status: 'realizada' | 'cancelada') {
    setError('')
    setBusyKey(item.key)
    try {
      await api(`/api/veterinario/visitas/${item.refId}`, { method: 'PATCH', body: { status } })
      await reload()
    } catch (e) {
      setError(e instanceof NetworkError ? t('Sem internet: conclua ou cancele a visita quando a conexão voltar.') : e instanceof Error ? t(e.message) : t('Não foi possível salvar.'))
    } finally {
      setBusyKey(null)
    }
  }

  function openItem(item: AgendaItem) {
    if (isVet) return item.farmId ? void open(item.farmId, siteHref(item.kind)) : undefined
    if (item.kind === 'vacina') return router.push({ pathname: '/vacinas/[id]', params: { id: item.refId } })
    if (item.kind === 'carencia') return router.push({ pathname: '/tratamentos/[id]', params: { id: item.refId } })
    router.push({ pathname: '/reproducao/[id]', params: { id: item.refId } })
  }

  const chip = (active: boolean) => ({ flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: space.md, minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: active ? colors.text : colors.border, backgroundColor: active ? colors.text : colors.white })

  return (
    <Screen>
      <Stack.Screen options={{ title: t('Agenda') }} />
      {offline ? <Notice text={t('Sem internet: mostrando a agenda da última vez que carregou.')} /> : null}
      {error ? <Notice tone="red" text={error} /> : null}
      {lastDone ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, backgroundColor: colors.greenSoft, borderRadius: radius.md, padding: space.md, marginBottom: space.md }}>
          <Ionicons name="checkmark-circle" size={20} color={colors.greenDark} />
          <Text style={{ flex: 1, color: colors.greenDark }}>{t(lastDone.vaccine ? 'Vacina aplicada hoje: {item}' : 'Marcado como feito: {item}', { item: t(lastDone.item.label, lastDone.item.vars) })}</Text>
          <Pressable onPress={() => void undoDone()} accessibilityRole="button" hitSlop={8} style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: space.sm }}><Text style={{ color: colors.greenDark, fontWeight: '800', textDecorationLine: 'underline' }}>{t('Desfazer')}</Text></Pressable>
        </View>
      ) : null}

      <Button label="Enviar pelo WhatsApp" icon="logo-whatsapp" variant="secondary" onPress={() => void share()} style={{ marginBottom: space.md }} />

      {!isVet ? (
        // flexGrow 0: sem isso a faixa de rolagem estica e as abas ficam da altura da tela
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: space.sm }} contentContainerStyle={{ gap: space.sm, alignItems: 'center' }}>
          {AGENDA_GROUPS.map(g => {
            const n = byGroup.get(g.key)!.length
            const on = currentGroup === g.key
            const color = g.key === 'atrasados' ? colors.red : g.key === 'hoje' ? colors.green : g.key === 'depois' ? colors.muted : '#1e40af'
            return (
              <Pressable key={g.key} onPress={() => setGroupTab(g.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, height: 48, borderRadius: radius.md, borderWidth: 2, borderColor: color, backgroundColor: on ? color : colors.white, opacity: !n && !on ? 0.6 : 1 }}>
                <Text style={{ fontWeight: '700', color: on ? colors.white : color }}>{t(g.label)}</Text>
                <View style={{ minWidth: 26, paddingHorizontal: 6, borderRadius: 13, backgroundColor: on ? colors.white : color }}>
                  <Text style={{ textAlign: 'center', fontWeight: '800', color: on ? color : colors.white }}>{n}</Text>
                </View>
              </Pressable>
            )
          })}
        </ScrollView>
      ) : <>
      {/* Semana com a quantidade de tarefas de cada dia */}
      <View style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm }}>
          <Pressable onPress={() => setWeek(shiftDay(week, -7))} accessibilityRole="button" accessibilityLabel={t('Semana anterior')} hitSlop={8} style={{ padding: space.sm }}>
            <Ionicons name="chevron-back" size={22} color={colors.muted} />
          </Pressable>
          <Text style={{ fontWeight: '700', color: colors.text }}>{ddmm(days[0])} – {ddmm(days[6])}</Text>
          <Pressable onPress={() => setWeek(shiftDay(week, 7))} accessibilityRole="button" accessibilityLabel={t('Próxima semana')} hitSlop={8} style={{ padding: space.sm }}>
            <Ionicons name="chevron-forward" size={22} color={colors.muted} />
          </Pressable>
        </View>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {days.map(day => {
            const n = counts.get(day) ?? 0
            const active = selected === day
            const isToday = day === today
            return (
              <Pressable key={day} onPress={() => setSelected(active ? null : day)} accessibilityRole="button" accessibilityState={{ selected: active }}
                accessibilityLabel={`${dayTitle(day)}: ${n === 1 ? t('1 tarefa') : t('{n} tarefas', { n })}`}
                style={{ flex: 1, alignItems: 'center', paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: active ? colors.green : isToday ? colors.green : colors.border, backgroundColor: active ? colors.green : isToday ? colors.greenSoft : colors.white }}>
                <Text style={{ fontSize: 11, fontWeight: '600', textTransform: 'uppercase', color: active ? colors.white : colors.muted }}>{fmt(day, { weekday: 'short' }).replace('.', '').slice(0, 3)}</Text>
                <Text style={{ fontSize: font.lg, fontWeight: '800', color: active ? colors.white : colors.text }}>{Number(day.slice(8, 10))}</Text>
                <View style={{ minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: n ? (active ? colors.white : colors.green) : 'transparent' }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: active ? colors.green : colors.white }}>{n || ''}</Text>
                </View>
              </Pressable>
            )
          })}
        </View>
      </View>

      {/* Filtro por tipo */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: space.md }} contentContainerStyle={{ gap: space.sm }}>
        <Pressable onPress={() => setKind('')} accessibilityRole="button" accessibilityState={{ selected: !kind }} style={chip(!kind)}>
          <Text style={{ fontWeight: '700', color: !kind ? colors.white : colors.text }}>{t('Tudo')}</Text>
        </Pressable>
        {AGENDA_KINDS.filter(k => all.some(i => i.kind === k.kind)).map(k => (
          <Pressable key={k.kind} onPress={() => setKind(kind === k.kind ? '' : k.kind)} accessibilityRole="button" accessibilityState={{ selected: kind === k.kind }} style={chip(kind === k.kind)}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: KIND_STYLE[k.kind].color }} />
            <Text style={{ fontWeight: '700', color: kind === k.kind ? colors.white : colors.text }}>{t(k.label)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      </>}

      {!isVet ? null : selected ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.md }}>
          <Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.text }}>{dayTitle(selected)}</Text>
          <Pressable onPress={() => setSelected(null)} hitSlop={8}><Text style={{ color: colors.green, fontWeight: '700' }}>{t('Ver todos os dias')}</Text></Pressable>
        </View>
      ) : lateCount ? <Text style={{ marginTop: space.md, color: colors.red, fontWeight: '700' }}>{lateCount === 1 ? t('1 tarefa atrasada') : t('{n} tarefas atrasadas', { n: lateCount })}</Text> : null}

      {(isVet ? !shown.length : !groups[0].items.length) ? (
        <View style={{ marginTop: space.md }}>
          <Muted>{t(!isVet ? (currentGroup === 'atrasados' ? 'Nada atrasado.' : 'Nada para este período.') : selected ? 'Nada marcado para este dia.' : 'Nada na agenda. As vacinas, coberturas e tratamentos anotados aparecem aqui com a data de cada manejo.')}</Muted>
        </View>
      ) : null}

      {groups.map(g => (
        <View key={g.key} style={{ marginTop: space.md }}>
          {g.label ? <Text style={{ fontSize: font.sm, fontWeight: '800', textTransform: 'uppercase', color: g.key === 'atrasados' ? colors.red : colors.muted, marginBottom: space.sm }}>{t(g.label)} ({g.items.length})</Text> : null}
          {g.items.map(item => {
            const style = KIND_STYLE[item.kind]
            const detail = [
              !selected && g.key !== 'hoje' ? (item.late ? t('era {date}', { date: ddmm(item.date) }) : dayTitle(item.date)) : null,
              item.time,
              item.detail ? t(item.detail, item.detailVars) : null,
              isVet && item.kind !== 'visita' ? item.farmName : null,
            ].filter(Boolean).join(' · ')
            return (
              <View key={item.key} style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderLeftWidth: 4, borderLeftColor: item.late ? colors.red : style.color, borderRadius: radius.md, padding: space.md, marginBottom: space.sm }}>
                <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: style.bg, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name={style.icon} size={20} color={style.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: font.md, fontWeight: '700', color: colors.text }}>{t(item.label, item.vars)}</Text>
                    {detail ? <Muted>{detail}</Muted> : null}
                  </View>
                </View>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
                  {canMarkDone(item) && (isVet || (canEdit && canAccess('reproducao'))) ? <Button label="Feito" icon="checkmark" loading={busyKey === item.key} disabled={!!busyKey} onPress={() => void markDone(item)} style={{ flexGrow: 1 }} /> : null}
                  {item.kind === 'vacina' && !isVet && canEdit && canAccess('vacinacao') ? <Button label="Aplicada" icon="checkmark" onPress={() => applyVaccine(item)} style={{ flexGrow: 1 }} /> : null}
                  {item.kind === 'visita' && isVet ? (
                    <>
                      <Button label="Concluir" icon="checkmark" loading={busyKey === item.key} disabled={!!busyKey} onPress={() => void visit(item, 'realizada')} style={{ flexGrow: 1 }} />
                      <Button label="Cancelar visita" variant="ghost" disabled={!!busyKey} onPress={() => void visit(item, 'cancelada')} />
                    </>
                  ) : item.kind !== 'visita' ? (
                    <Button label="Abrir" variant="secondary" disabled={!!busy} onPress={() => openItem(item)} style={{ flexGrow: 1 }} />
                  ) : null}
                </View>
              </View>
            )
          })}
        </View>
      ))}
    </Screen>
  )
}
