// Animais do veterinário: no topo escolhe de qual propriedade ver (uma, ou todas as que atende). Todas vêm do servidor
// (GET /api/veterinario/animais, com a última cópia guardada); uma propriedade vem do celular e funciona sem internet.
// Filtros rápidos: todos, prenhes e a diagnosticar (cobertura ainda sem diagnóstico).
import { useLocalSearchParams, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, Modal, Pressable, SafeAreaView, SectionList, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { api, NetworkError } from '@/api/client'
import { useFarmId, useSession } from '@/auth/session'
import { all, getCache, setCache } from '@/db'
import { useLive } from '@/db/events'
import { ageText } from '@/lib/format'
import { matches } from '@/lib/search'
import { useT } from '@/lib/i18n'
import { listAnimals, statusTone } from '@/repos/animals'
import { Badge, Empty, Fab, Muted, Notice, Row, Search } from '@/ui'
import { AnimalThumb } from '@/ui/photo'
import { colors, font, radius, space } from '@/theme'
import { FarmKindBadge, farmTasks, useOpenFarm, type VetPanel } from '@/vet/panel'

interface HerdRow {
  id: string; name: string; code: string; customCode: string | null; species: string; birthDate: string; status: string
  farmId: string; farmName: string; reproStatus: string | null; hasPhoto?: boolean
}
type Filter = 'todos' | 'prenhes' | 'diagnosticar'
const FILTERS: { key: Filter; label: string; test: (r: HerdRow) => boolean }[] = [
  { key: 'todos', label: 'Todos', test: () => true },
  { key: 'prenhes', label: 'Prenhes', test: r => r.reproStatus === 'Prenha' },
  { key: 'diagnosticar', label: 'A diagnosticar', test: r => r.reproStatus === 'Coberta' },
]
const CACHE_KEY = 'vet_animals'

/** Todos os animais das propriedades atendidas (servidor; sem internet, a última cópia) */
function useAllAnimals(enabled: boolean) {
  const [rows, setRows] = useState<HerdRow[] | null>(() => getCache<HerdRow[]>(CACHE_KEY))
  const [offline, setOffline] = useState(false)
  const reload = useCallback(async () => {
    try {
      const data = await api<HerdRow[]>('/api/veterinario/animais')
      setCache(CACHE_KEY, data)
      setRows(data)
      setOffline(false)
    } catch (e) {
      if (e instanceof NetworkError) setOffline(true)
    }
  }, [])
  useEffect(() => { if (enabled) void reload() }, [enabled, reload])
  return { rows, offline }
}

export function VetAnimals() {
  const { user, canEdit } = useSession()
  const farmId = useFarmId()
  const router = useRouter()
  const t = useT()
  const params = useLocalSearchParams<{ propriedade?: string; filtro?: string; toque?: string }>()
  const panel = getCache<VetPanel>('vet_panel')
  const choices = panel?.clients.length ? panel.clients : (user?.farms ?? []).map(f => ({ id: f.id, farmId: f.id, name: f.name, segments: f.segments, animals: null as number | null, city: null, state: null }))
  const [scope, setScope] = useState<'todas' | 'aberta'>(() => (params.propriedade && params.propriedade !== 'todas' ? 'aberta' : choices.length > 1 ? 'todas' : 'aberta'))
  const [filter, setFilter] = useState<Filter>(() => (FILTERS.some(f => f.key === params.filtro) ? params.filtro as Filter : 'todos'))
  useEffect(() => {
    if (params.propriedade) setScope(params.propriedade === 'todas' ? 'todas' : 'aberta')
    if (params.filtro) setFilter(FILTERS.some(f => f.key === params.filtro) ? params.filtro as Filter : 'todos')
    // `toque` muda a cada toque no Painel: tocar de novo volta para a propriedade e o filtro pedidos
  }, [params.propriedade, params.filtro, params.toque])
  const [q, setQ] = useState('')
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')
  const { open, busy } = useOpenFarm(setError)
  const remote = useAllAnimals(scope === 'todas')

  // Propriedade aberta: do celular, com a situação da reprodução de cada fêmea
  const local = useLive(() => {
    if (scope !== 'aberta') return [] as HerdRow[]
    const open = all<{ femaleId: string; status: string }>("SELECT femaleId, status FROM reproductions WHERE farmId = ? AND status IN ('Coberta', 'Prenha') AND actualBirthDate IS NULL ORDER BY coverageDate DESC", [farmId])
    const repro = new Map<string, string>()
    for (const r of open) if (!repro.has(r.femaleId)) repro.set(r.femaleId, r.status)
    return listAnimals(farmId).map((a): HerdRow => ({ ...a, farmId, farmName: user?.farmName ?? '', reproStatus: repro.get(a.id) ?? null, hasPhoto: !!a.hasPhoto }))
  }, [farmId, scope])

  const base = scope === 'todas' ? remote.rows ?? [] : local
  const searched = useMemo(() => (q.trim() ? base.filter(a => matches(`${a.name} ${a.code} ${a.customCode ?? ''}`, q)) : base), [base, q])
  const counts = new Map(FILTERS.map(f => [f.key, searched.filter(f.test).length]))
  const shown = searched.filter(FILTERS.find(f => f.key === filter)!.test)
  const sections = useMemo(() => {
    const map = new Map<string, { farmId: string; title: string; data: HerdRow[] }>()
    for (const a of shown) {
      const s = map.get(a.farmId) ?? { farmId: a.farmId, title: a.farmName, data: [] }
      s.data.push(a)
      map.set(a.farmId, s)
    }
    return [...map.values()].sort((a, b) => a.title.localeCompare(b.title))
  }, [shown])
  const segmentsOf = (id: string) => choices.find(c => c.farmId === id)?.segments

  async function openAnimal(a: HerdRow) {
    // Animal de outra propriedade: abre a propriedade (a ficha aparece quando os dados dela chegam no celular)
    if (a.farmId !== user?.farmId && !(await open(a.farmId))) return
    router.push(`/animais/${a.id}`)
  }

  async function pick(next: 'todas' | string) {
    setError('')
    if (next === 'todas') { setScope('todas'); setPicking(false); return }
    if (next !== user?.farmId && !(await open(next))) return
    setScope('aberta')
    setPicking(false)
  }

  const total = scope === 'todas' ? (remote.rows?.length ?? choices.reduce((s, c) => s + (c.animals ?? 0), 0)) : local.length
  const scopeName = scope === 'todas' ? t('Todas as propriedades') : user?.farmName ?? t('nenhuma')
  const renderRow = ({ item }: { item: HerdRow }) => (
    <Row title={item.name} detail={`${item.customCode || item.code} · ${t(item.species)} · ${ageText(item.birthDate)}`}
      left={<AnimalThumb id={item.id} name={item.name} hasPhoto={!!item.hasPhoto} />}
      badge={item.reproStatus === 'Prenha' ? <Badge label="Prenha" tone="green" />
        : item.reproStatus === 'Coberta' ? <Badge label="Diagnosticar" tone="amber" />
          : item.status !== 'Vivo' ? <Badge label={t(item.status)} tone={statusTone(item.status)} /> : undefined}
      onPress={() => void openAnimal(item)} />
  )
  const empty = <Empty title={t(q || filter !== 'todos' ? 'Nenhum animal encontrado' : 'Nenhum animal cadastrado')} text={scope === 'todas' && !remote.rows && remote.offline ? t('Sem internet: para ver todas as propriedades é preciso conexão na primeira vez. Escolha uma propriedade.') : undefined} />

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: space.lg, paddingBottom: space.sm, gap: space.sm, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <Pressable onPress={() => setPicking(true)} accessibilityRole="button" accessibilityLabel={t('Escolher a propriedade')}
          style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 56, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.green, backgroundColor: colors.greenSoft, opacity: pressed ? 0.85 : 1 })}>
          <View style={{ flex: 1 }}>
            <Muted>{t('Propriedade')}</Muted>
            <Text style={{ fontSize: font.md, fontWeight: '800', color: colors.greenDark }} numberOfLines={1}>{scopeName}</Text>
          </View>
          {scope === 'aberta' ? <FarmKindBadge segments={segmentsOf(farmId) ?? user?.farmSegments} /> : null}
          <Muted>{t(total === 1 ? '{n} animal' : '{n} animais', { n: total })}</Muted>
          <Ionicons name="chevron-down" size={20} color={colors.green} />
        </Pressable>
        <Search value={q} onChange={setQ} placeholder={t('Nome, código ou brinco')} />
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {FILTERS.map(f => {
            const on = filter === f.key
            return (
              <Pressable key={f.key} onPress={() => setFilter(f.key)} accessibilityRole="radio" accessibilityState={{ checked: on }}
                style={{ minHeight: 40, paddingHorizontal: space.md, borderRadius: 999, justifyContent: 'center', borderWidth: 1, borderColor: on ? colors.green : colors.border, backgroundColor: on ? colors.green : colors.white }}>
                <Text style={{ fontWeight: '700', color: on ? colors.white : colors.text }}>{t(f.label)} {counts.get(f.key) ?? 0}</Text>
              </Pressable>
            )
          })}
        </View>
      </View>
      {scope === 'todas' && remote.offline && remote.rows ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}><Notice text={t('Sem internet: mostrando a lista da última vez que carregou.')} /></View> : null}
      {error ? <View style={{ paddingHorizontal: space.lg, paddingTop: space.sm }}><Notice tone="red" text={error} /></View> : null}

      {scope === 'todas' ? (
        <SectionList
          sections={sections}
          keyExtractor={a => a.id}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 96 }}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({ section }) => (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, paddingTop: space.lg, paddingBottom: space.xs }}>
              <Text style={{ fontSize: font.sm, fontWeight: '800', color: colors.greenDark, textTransform: 'uppercase' }}>{section.title}</Text>
              <FarmKindBadge segments={segmentsOf(section.farmId)} />
              <Muted>({section.data.length})</Muted>
            </View>
          )}
          renderItem={renderRow}
          ListEmptyComponent={empty}
        />
      ) : (
        <FlatList data={shown} keyExtractor={a => a.id} renderItem={renderRow} ListEmptyComponent={empty}
          contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: 96 }} keyboardShouldPersistTaps="handled" />
      )}
      {canEdit ? <Fab label={t('+ Cadastrar')} onPress={() => router.push('/animais/novo')} /> : null}

      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: space.lg }}>
            <Text style={{ fontSize: font.lg, fontWeight: '800', color: colors.text }}>{t('Ver animais de')}</Text>
            <Pressable onPress={() => setPicking(false)} hitSlop={12} accessibilityRole="button"><Text style={{ color: colors.green, fontWeight: '700', fontSize: font.md }}>{t('Fechar')}</Text></Pressable>
          </View>
          {error ? <View style={{ paddingHorizontal: space.lg }}><Notice tone="red" text={error} /></View> : null}
          <FlatList
            data={[{ farmId: 'todas' }, ...choices] as ({ farmId: 'todas' } | (typeof choices)[number])[]}
            keyExtractor={c => c.farmId}
            contentContainerStyle={{ paddingHorizontal: space.lg, paddingBottom: space.xl }}
            renderItem={({ item: c }) => {
              const isAll = c.farmId === 'todas'
              const on = isAll ? scope === 'todas' : scope === 'aberta' && c.farmId === user?.farmId
              const late = !isAll && panel ? farmTasks(panel, c.farmId).filter(k => k.tone === 'red').length : 0
              const info = isAll
                ? t(choices.length === 1 ? '1 propriedade' : '{n} propriedades', { n: choices.length })
                : [[('city' in c ? c.city : null), ('state' in c ? c.state : null)].filter(Boolean).join(', '), 'animals' in c && c.animals !== null ? t(c.animals === 1 ? '{n} animal' : '{n} animais', { n: c.animals }) : null].filter(Boolean).join(' · ')
              return (
                <Pressable disabled={!!busy} onPress={() => void pick(c.farmId)} accessibilityRole="button" accessibilityState={{ selected: on }}
                  style={({ pressed }) => ({ backgroundColor: on ? colors.greenSoft : colors.white, borderWidth: on ? 2 : 1, borderColor: on ? colors.green : colors.border, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, gap: 4, opacity: busy === c.farmId ? 0.5 : pressed ? 0.8 : 1 })}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    {isAll ? <Ionicons name="business-outline" size={22} color={colors.green} /> : null}
                    <Text style={{ flex: 1, fontSize: font.md, fontWeight: isAll ? '800' : '700', color: isAll ? colors.greenDark : colors.text }} numberOfLines={2}>{isAll ? t('Todas as propriedades') : 'name' in c ? c.name : ''}</Text>
                    {late ? <Badge label={t(late === 1 ? '{n} urgente' : '{n} urgentes', { n: late })} tone="red" /> : null}
                    {on ? <Ionicons name="checkmark" size={22} color={colors.green} /> : null}
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm }}>
                    {!isAll && 'segments' in c ? <FarmKindBadge segments={c.segments} /> : null}
                    {info ? <Muted>{info}</Muted> : null}
                  </View>
                </Pressable>
              )
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  )
}
