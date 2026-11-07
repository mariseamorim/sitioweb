import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useMemo, useState, type ReactNode } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { FARM_SEGMENTS } from '@/lib/farmSegments'
import { OWNER_FILTERS, STALE_DAYS, activityLabel, filterOwnerGroups, groupFarmsByOwner, isStale, ownerTotals, type OwnerFilter, type OwnerGroup } from '@/lib/ownerGroups'
import { listFarms, removeFarm, type Farm } from '@/repos/farms'
import { pendingCount } from '@/sync/local'
import { useSyncState } from '@/sync'
import { Badge, Button, Card, Chips, Empty, Fab, Muted, Notice, Screen, Search, Stat } from '@/ui'
import { colors, font, space } from '@/theme'

// As mesmas mensagens do site (src/lib/farmSwitch.ts e a tela de propriedades)
const PENDING_MESSAGE = 'Ainda há anotações salvas só no celular. Conecte-se à internet e espere o "Tudo enviado" antes de trocar de propriedade.'
const OFFLINE_SWITCH = 'Sem internet. Para trocar de propriedade, conecte-se e tente de novo.'
const OFFLINE_ACTION = 'Sem internet. Esta ação precisa de conexão; tente de novo quando o sinal voltar.'

const segmentBadges = (segments: string[]) => FARM_SEGMENTS.filter(s => segments.includes(s.key)).map(s => (
  <Badge key={s.key} label={s.label} tone={s.key === 'leite' || s.key === 'cria' ? 'green' : 'blue'} />
))

// Propriedades: cartões para o produtor; para o administrador, agrupadas por proprietário (porte de OwnerGroups do site).
export default function Fazendas() {
  const farmId = useFarmId()
  const { user, canEdit, switchFarm, refresh } = useSession()
  const sync = useSyncState()
  const router = useRouter()
  const farms = useLive(() => listFarms(farmId), [farmId])
  const [opening, setOpening] = useState<string | null>(null)
  const [error, setError] = useState('')
  const isAdmin = user?.role === 'admin'

  async function openFarm(id: string) {
    setError('')
    if (pendingCount(farmId).pending > 0) { setError(PENDING_MESSAGE); return }
    if (!sync.online) { setError(OFFLINE_SWITCH); return }
    setOpening(id)
    try { await switchFarm(id); router.replace('/(tabs)') } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir esta propriedade.') } finally { setOpening(null) }
  }

  function confirmDelete(farm: Farm) {
    Alert.alert('Excluir esta propriedade?', 'Se ela já tiver registros, será apenas desativada e nada se perde.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => void deleteFarm(farm) },
    ])
  }

  async function deleteFarm(farm: Farm) {
    setError('')
    // A propriedade aberta não pode sumir debaixo do app: o servidor abre outra, e isso precisa de internet e fila vazia
    if (!isAdmin && farm.id === farmId) {
      if (pendingCount(farmId).pending > 0) { setError(PENDING_MESSAGE); return }
      if (!sync.online) { setError(OFFLINE_ACTION); return }
      const other = farms.find(f => f.id !== farm.id && f.isActive)
      if (!other) { setError('Esta é a sua única propriedade. Cadastre outra antes de excluir esta.'); return }
      removeFarm(farmId, farm.id)
      await openFarm(other.id)
      return
    }
    removeFarm(farmId, farm.id)
    if (!isAdmin) void refresh()
  }

  const header = (
    <>
      {error ? <Notice tone="red" text={error} /> : null}
      {!sync.online ? <Notice text="Sem internet: mostrando a última cópia guardada neste aparelho." /> : null}
    </>
  )

  if (isAdmin) {
    return (
      <>
        <AdminGroups farms={farms} activeFarmId={farmId} header={header} opening={opening}
          onOpen={f => void openFarm(f.id)} onEdit={f => router.push(`/fazendas/${f.id}`)} onDelete={confirmDelete} />
        <Fab label="+ Cadastrar" onPress={() => router.push('/fazendas/nova')} />
      </>
    )
  }

  const active = farms.filter(f => f.isActive)
  return (
    <>
      <Screen>
        {header}
        {active.length === 0 ? <Empty title="Nenhuma propriedade cadastrada" text={canEdit ? 'Toque em “Cadastrar” para começar' : undefined} /> : active.map(f => (
          <Card key={f.id}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
              <Text style={{ flex: 1, fontSize: font.lg, fontWeight: '700', color: colors.text }}>{f.name}</Text>
              {f.propertyType ? <Badge label={f.propertyType} tone={f.propertyType === 'Sítio' ? 'amber' : 'green'} /> : null}
            </View>
            {f.documentType || f.documentNumber ? <Muted>{f.documentType}: {f.documentNumber}</Muted> : null}
            {f.owner ? <Muted>Proprietário: {f.owner}</Muted> : null}
            {f.address ? <Muted>{f.address}</Muted> : null}
            {f.city || f.state ? <Muted>{[f.city, f.state].filter(Boolean).join(' — ')}</Muted> : null}
            {f.phone ? <Muted style={{ marginTop: space.xs }}>{f.phone}</Muted> : null}
            {f.segments.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.sm }}>{segmentBadges(f.segments)}</View> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.md }}>
              {f.id === farmId
                ? <Text style={{ fontSize: font.sm, fontWeight: '700', color: colors.muted, paddingHorizontal: space.sm }}>Aberta agora</Text>
                : <Button label={opening === f.id ? 'Abrindo…' : 'Abrir esta propriedade'} variant="secondary" onPress={() => void openFarm(f.id)} disabled={!!opening} />}
              {canEdit ? <Button label="Editar cadastro" variant="ghost" onPress={() => router.push(`/fazendas/${f.id}`)} /> : null}
              {canEdit ? (
                <Pressable onPress={() => confirmDelete(f)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Excluir propriedade ${f.name}`} style={{ marginLeft: 'auto', padding: space.sm }}>
                  <Ionicons name="trash-outline" size={22} color={colors.muted} />
                </Pressable>
              ) : null}
            </View>
          </Card>
        ))}
      </Screen>
      {canEdit ? <Fab label="+ Cadastrar" onPress={() => router.push('/fazendas/nova')} /> : null}
    </>
  )
}

function AdminGroups({ farms, activeFarmId, header, opening, onOpen, onEdit, onDelete }: {
  farms: Farm[]; activeFarmId: string; header: ReactNode; opening: string | null
  onOpen: (f: Farm) => void; onEdit: (f: Farm) => void; onDelete: (f: Farm) => void
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<OwnerFilter>('todos')
  const [openKeys, setOpenKeys] = useState<Record<string, boolean>>({})

  const groups = useMemo(() => groupFarmsByOwner(farms), [farms])
  const totals = useMemo(() => ownerTotals(groups), [groups])
  const visible = useMemo(() => filterOwnerGroups(groups, filter, query), [groups, filter, query])
  const searching = query.trim().length > 0
  // Grupos começam fechados; só a busca por texto abre todos, para o resultado aparecer
  const isOpen = (g: OwnerGroup) => openKeys[g.key] ?? searching
  const filters = OWNER_FILTERS.filter(f => f.key !== 'inativas' || totals.inactive > 0).map(f => ({ value: f.key, label: f.key === 'inativas' ? `${f.label} (${totals.inactive})` : f.label }))

  return (
    <Screen>
      {header}
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.sm }}>
        <Stat label="proprietários" value={String(totals.owners)} />
        <Stat label="propriedades ativas" value={String(totals.farms)} />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
        <Pressable style={{ flex: 1 }} onPress={() => totals.stale && setFilter('paradas')}><Stat label={`sem lançamento há ${STALE_DAYS} dias`} value={String(totals.stale)} tone={totals.stale ? 'red' : undefined} /></Pressable>
        <Pressable style={{ flex: 1 }} onPress={() => totals.unknown && setFilter('semdono')}><Stat label="sem proprietário informado" value={String(totals.unknown)} tone={totals.unknown ? 'amber' : undefined} /></Pressable>
      </View>
      <Search value={query} onChange={setQuery} placeholder="Proprietário, CPF/CNPJ, propriedade ou cidade" />
      <Chips options={filters} value={filter} onChange={setFilter} />
      {visible.length === 0 ? (
        <Empty title={searching ? `Nenhum proprietário ou propriedade com "${query.trim()}".` : 'Nenhuma propriedade neste filtro.'} />
      ) : visible.map(g => {
        const open = isOpen(g)
        const stale = g.farms.some(f => f.isActive && isStale(f.lastActivity))
        const initial = g.unknown ? '?' : g.name.trim().charAt(0).toUpperCase() || '?'
        const [bg, fg] = g.unknown ? [colors.amberSoft, colors.amber] : stale ? [colors.redSoft, colors.red] : [colors.greenSoft, colors.greenDark]
        return (
          <Card key={g.key} style={{ padding: 0, overflow: 'hidden' }}>
            <Pressable onPress={() => setOpenKeys({ ...openKeys, [g.key]: !open })} accessibilityRole="button" accessibilityState={{ expanded: open }}
              style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md }, pressed && { opacity: 0.8 }]}>
              <View style={{ width: 40, height: 40, borderRadius: g.document?.includes('/') ? 8 : 20, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontWeight: '700', color: fg }}>{initial}</Text>
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontWeight: '700', color: colors.text }} numberOfLines={2}>{g.name}</Text>
                <Muted style={{ fontSize: 12 }}>
                  {g.unknown
                    ? 'Cadastros sem nome nem CPF/CNPJ do dono'
                    : [g.document, g.city, g.animals ? `${g.animals} ${g.animals === 1 ? 'animal' : 'animais'}` : null, activityLabel(g.lastActivity)].filter(Boolean).join(' · ')}
                </Muted>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.text }}>{g.farms.length}</Text>
                <Muted style={{ fontSize: 11 }}>{g.farms.length === 1 ? 'propriedade' : 'propriedades'}</Muted>
              </View>
              <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={18} color={colors.muted} />
            </Pressable>
            {open ? (
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg, paddingHorizontal: space.md }}>
                {g.farms.map(f => <AdminFarmRow key={f.id} farm={f} active={f.id === activeFarmId} unknownOwner={g.unknown} opening={opening === f.id} onOpen={onOpen} onEdit={onEdit} onDelete={onDelete} />)}
              </View>
            ) : null}
          </Card>
        )
      })}
    </Screen>
  )
}

function AdminFarmRow({ farm, active, unknownOwner, opening, onOpen, onEdit, onDelete }: {
  farm: Farm; active: boolean; unknownOwner: boolean; opening: boolean
  onOpen: (f: Farm) => void; onEdit: (f: Farm) => void; onDelete: (f: Farm) => void
}) {
  const stale = farm.isActive && isStale(farm.lastActivity)
  const place = [farm.city, farm.state].filter(Boolean).join(', ')
  const detail = [
    place || null,
    `${farm.animals} ${farm.animals === 1 ? 'animal' : 'animais'}`,
    `${farm.members} ${farm.members === 1 ? 'pessoa' : 'pessoas'}`,
    farm.isActive ? activityLabel(farm.lastActivity) : 'inativa',
  ].filter(Boolean).join(' · ')
  return (
    <View style={{ paddingVertical: space.md, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Text style={{ fontWeight: '600', color: colors.text }}>{farm.name}</Text>
      <Muted style={{ fontSize: 12, color: stale ? colors.red : colors.muted }}>{detail}</Muted>
      {farm.segments.length || !farm.isActive ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: space.xs }}>
          {segmentBadges(farm.segments)}
          {!farm.isActive ? <Badge label="Inativa" /> : null}
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm }}>
        <Button label={unknownOwner ? 'Completar' : 'Editar'} variant={unknownOwner ? 'secondary' : 'ghost'} onPress={() => onEdit(farm)} style={{ minHeight: 40 }} />
        <Pressable onPress={() => onDelete(farm)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Excluir propriedade ${farm.name}`} style={{ padding: space.sm }}>
          <Ionicons name="trash-outline" size={22} color={colors.muted} />
        </Pressable>
        <View style={{ flex: 1 }} />
        {farm.isActive ? (active
          ? <Badge label="Aberta" tone="green" />
          : <Button label={opening ? 'Abrindo…' : 'Abrir'} onPress={() => onOpen(farm)} disabled={opening} style={{ minHeight: 40 }} />) : null}
      </View>
    </View>
  )
}
