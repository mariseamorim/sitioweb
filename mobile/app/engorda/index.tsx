import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate, brNumber, todayISO } from '@/lib/format'
import { STOCK_WARNING_DAYS, lotSummary, projectTarget } from '@/lib/lots'
import { isInRearing, rearingSummary } from '@/lib/rearing'
import { listLots, productLines, type Lot } from '@/repos/lots'
import { listRearing, type RearingRow } from '@/repos/rearing'
import { Badge, Button, Card, Chips, Empty, Fab, IconCircle, Muted, Screen, Tile, TileGrid } from '@/ui'
import { Section, StatGrid, TextButton, coverageLine, kg, phaseLabel, plural, tag } from '@/ui/lots'
import { colors, font, space } from '@/theme'
import { useT } from '@/lib/i18n'

type Tab = 'todos' | 'recria' | 'engorda'

/** Lotes de recria e engorda e a recria um a um (porte de src/app/engorda/page.tsx do site) */
export default function Engorda() {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const t = useT()
  const today = todayISO()
  const [tab, setTab] = useState<Tab>('todos')
  const lots = useLive(() => listLots(farmId), [farmId])
  const rearing = useLive(() => listRearing(farmId), [farmId])
  const rearingActive = rearing.filter(isInRearing)

  const visible = lots.filter(l => tab === 'todos' || l.phase === tab)
  const openLots = visible.filter(l => !l.endDate)
  const closed = visible.filter(l => l.endDate)
  const count = (phase: string) => lots.filter(l => l.phase === phase && !l.endDate).length + (phase === 'recria' ? rearingActive.length : 0)

  // Resumo dos lotes abertos da aba: cabeças, peso médio e ganho por dia ponderados pelas cabeças
  const summaries = openLots.map(l => lotSummary(l.weighings, today, l.endDate))
  const heads = summaries.reduce((s, x) => s + (x.last?.headCount ?? 0), 0)
  const weight = summaries.reduce((s, x) => s + (x.last ? x.last.avgWeight * x.last.headCount : 0), 0)
  const withGmd = summaries.filter(x => x.gmd !== null && x.last)
  const gmdHeads = withGmd.reduce((s, x) => s + x.last!.headCount, 0)
  const avgWeight = heads ? weight / heads : null
  const gmd = gmdHeads ? withGmd.reduce((s, x) => s + x.gmd! * x.last!.headCount, 0) / gmdHeads : null

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Muted style={{ marginBottom: space.sm }}>{t('Na recria, acompanhe cada bezerro sozinho (desmama, pesagens, cobertura da novilha) ou em lote. Na engorda, junte os animais em lotes, pese e veja o ganho por dia, o trato e quando chegam ao peso de saída.')}</Muted>
        {/* Atalho para os planos (etapas, ganho por dia esperado e meta), escolhidos depois no lote */}
        <Card onPress={() => router.push('/engorda/planos')} style={{ marginBottom: space.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconCircle icon="trending-up-outline" tone="blue" />
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.text }}>{t('Planos')}</Text>
              <Muted>{t('Etapas, ganho por dia esperado e meta de peso dos lotes')}</Muted>
            </View>
            <Text style={{ color: colors.green, fontWeight: '700', fontSize: font.sm }}>{t('Abrir')}</Text>
          </View>
        </Card>
        <Chips value={tab} onChange={setTab} options={[{ value: 'todos', label: `${t('Todos')} (${count('recria') + count('engorda')})` }, { value: 'recria', label: `${t('Recria')} (${count('recria')})` }, { value: 'engorda', label: `${t('Engorda')} (${count('engorda')})` }]} />

        {/* Números dos lotes abertos da aba, antes das listas */}
        {openLots.length > 0 ? (
          <View style={{ marginTop: space.md }}>
            <TileGrid>
              <Tile accent="blue" label={t('Ganho por dia (média)')} value={gmd !== null ? `${brNumber(gmd, 2)} kg/d` : '—'} />
              <Tile accent="green" label={t('Peso médio')} value={avgWeight !== null ? kg(avgWeight) : '—'} />
              <Tile accent="teal" label={t('Cabeças nos lotes')} value={String(heads)} />
              <Tile accent="amber" label={t('Lotes abertos')} value={String(openLots.length)} />
            </TileGrid>
          </View>
        ) : null}

        {tab !== 'engorda' ? <RearingSection list={rearing} today={today} canEdit={canEdit} /> : null}
        {openLots.length > 0 ? <Text style={{ fontWeight: '700', color: colors.muted, fontSize: font.sm, marginTop: space.md, marginBottom: space.sm }}>{t('LOTES')}</Text> : null}

        {visible.length === 0 ? (
          <Empty title={tab === 'todos' ? t('Nenhum lote ainda') : t('Nenhum lote de {phase}', { phase: phaseLabel(tab).toLowerCase() })}
            text={tab === 'recria' ? 'Para acompanhar um animal sozinho, use “Acompanhar um animal”. Para um grupo, crie um lote de recria.' : 'Crie um lote com os animais cadastrados (ou só a quantidade e o peso médio). A cada pesagem, o app mostra quanto o lote ganhou.'} />
        ) : (
          <>
            {openLots.map(l => <LotCard key={l.id} lot={l} today={today} canEdit={canEdit} />)}
            {closed.length > 0 ? (
              <Section title="Encerrados">
                {closed.map(l => <LotCard key={l.id} lot={l} today={today} canEdit={false} />)}
              </Section>
            ) : null}
          </>
        )}
      </Screen>
      {canEdit ? <Fab label="+ Novo lote" onPress={() => router.push({ pathname: '/engorda/novo', params: { phase: tab === 'recria' ? 'recria' : 'engorda' } })} /> : null}
    </View>
  )
}

// ── Cartão do lote ──────────────────────────────────────────────────────

function LotCard({ lot, today, canEdit }: { lot: Lot; today: string; canEdit: boolean }) {
  const router = useRouter()
  const t = useT()
  const s = lotSummary(lot.weighings, today, lot.endDate)
  const projection = lot.endDate ? null : projectTarget(s, lot.targetWeight)
  const covered = lot.phase === 'recria' ? lot.animals.filter(a => a.reproductions[0] && ['Coberta', 'Prenha'].includes(a.reproductions[0].status)).length : 0
  const females = lot.animals.filter(a => a.gender === 'Fêmea').length
  const open = (focus?: 'pesar' | 'animais') => router.push({ pathname: '/engorda/[id]', params: focus ? { id: lot.id, focus } : { id: lot.id } })
  return (
    <Card onPress={() => open()}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.text }} numberOfLines={1}>{lot.name}</Text>
          <Muted>{plural(s.days, 'dia', 'dias')} {t('no lote')}{lot.endDate ? ` · ${t('saiu em {date}', { date: brDate(lot.endDate) })}` : ''}</Muted>
        </View>
        <Badge label={phaseLabel(lot.phase)} tone={lot.phase === 'recria' ? 'blue' : 'amber'} />
      </View>
      {s.last && lot.targetWeight && !lot.endDate ? <View style={{ marginTop: space.md }}><WeightToTarget current={s.last.avgWeight} target={lot.targetWeight} /></View> : null}
      <View style={{ marginTop: space.md }}>
        <StatGrid items={[
          { title: 'Animais', value: String(lot.animals.length || s.last?.headCount || 0) },
          { title: 'Peso médio', value: s.last ? kg(s.last.avgWeight) : '—' },
          { title: 'Ganho/dia', value: s.gmd !== null ? `${s.gmd >= 0 ? '+' : ''}${brNumber(s.gmd, 3)}` : '—', tone: 'green' },
        ]} />
      </View>
      {s.gainKg !== null ? <Text style={{ marginTop: space.md, color: colors.text, fontSize: font.sm }}>{t('Ganhou {kg} por cabeça desde a entrada.', { kg: kg(s.gainKg) })}</Text> : null}
      {projection ? <Text style={{ marginTop: 4, color: colors.text, fontSize: font.sm }}>{t('Chega a {kg} em {days} ({date}).', { kg: kg(lot.targetWeight!), days: plural(projection.days, 'dia', 'dias'), date: brDate(projection.date) })}</Text> : null}
      {females > 0 && lot.phase === 'recria' ? <Text style={{ marginTop: 4, color: colors.text, fontSize: font.sm }}>{covered} {t('de')} {plural(females, 'novilha', 'novilhas')} {t(covered === 1 ? 'coberta' : 'cobertas')}.</Text> : null}
      {productLines(lot, today).filter(p => p.perDay).map(p => {
        const warn = p.days !== null && p.days <= STOCK_WARNING_DAYS
        return <Text key={p.id} style={{ marginTop: 4, fontSize: font.sm, color: warn ? colors.amber : colors.muted, fontWeight: warn ? '700' : '400' }}>{p.supply.name}: {kg(p.perDay!)}/{t('dia')}{p.days !== null ? ` · ${t('estoque para {days}', { days: plural(p.days, 'dia', 'dias') })}` : ''}</Text>
      })}
      {canEdit ? (
        <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md }}>
          <Button label="+ Animais" variant="secondary" onPress={() => open('animais')} style={{ flex: 1 }} />
          <Button label="Pesar" onPress={() => open('pesar')} style={{ flex: 1 }} />
        </View>
      ) : null}
    </Card>
  )
}

/** Barra de quanto o animal (ou o lote, em média) já chegou do peso-alvo */
function WeightToTarget({ current, target }: { current: number; target: number }) {
  const t = useT()
  const pct = Math.max(0, Math.min(100, (current / target) * 100))
  return (
    <View accessible accessibilityLabel={t('{n}% da meta de {kg}', { n: Math.round(pct), kg: kg(target) })}>
      <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.border }}>
        <View style={{ width: `${pct}%`, height: 10, borderRadius: 5, backgroundColor: colors.blue }} />
      </View>
      <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: 2 }}>{t('Meta: {kg}', { kg: kg(target) })} · {Math.round(pct)}%</Text>
    </View>
  )
}

// ── Recria um a um ──────────────────────────────────────────────────────

function RearingSection({ list, today, canEdit }: { list: RearingRow[]; today: string; canEdit: boolean }) {
  const router = useRouter()
  const [showEnded, setShowEnded] = useState(false)
  const t = useT()
  const active = list.filter(isInRearing)
  const ended = list.filter(a => !isInRearing(a))
  return (
    <Section title="Recria um a um" hint="Bezerros e novilhas acompanhados sem lote: desmama, pesagens, ganho por dia e cobertura."
      right={canEdit ? <TextButton label="Acompanhar um animal" onPress={() => router.push('/recria/novo')} /> : undefined}>
      {active.length === 0 ? (
        <Muted style={{ padding: space.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 12 }}>
          {t('Nenhum animal acompanhado sozinho. Em “Acompanhar um animal”, informe a desmama e o peso: o app passa a mostrar o ganho por dia e, nas novilhas, a cobertura.')}
        </Muted>
      ) : active.map(a => <RearingCard key={a.id} animal={a} today={today} canEdit={canEdit} />)}
      {ended.length > 0 ? (
        <View>
          <Pressable onPress={() => setShowEnded(v => !v)} style={{ minHeight: 44, justifyContent: 'center' }} accessibilityRole="button">
            <Text style={{ color: colors.muted, fontWeight: '700', fontSize: font.sm }}>{showEnded ? '▾' : '▸'} {t('Saíram da recria')} ({ended.length})</Text>
          </Pressable>
          {showEnded ? (
            <Card style={{ paddingVertical: 4 }}>
              {ended.map(a => {
                const s = rearingSummary(a, today)
                return (
                  <Pressable key={a.id} onPress={() => router.push(`/recria/${a.id}`)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text }}><Text style={{ fontWeight: '700' }}>{tag(a)}</Text> {a.name}</Text>
                      <Muted>{brDate(a.rearingStart)} {t('a')} {brDate(a.rearingEnd)} · {plural(s.days, 'dia', 'dias')}{s.gainKg !== null ? ` · ${t('ganhou {kg}', { kg: kg(s.gainKg) })}` : ''}</Muted>
                    </View>
                    <Text style={{ color: colors.green, fontWeight: '700', fontSize: font.sm }}>{t('Abrir')}</Text>
                  </Pressable>
                )
              })}
            </Card>
          ) : null}
        </View>
      ) : null}
    </Section>
  )
}

function RearingCard({ animal, today, canEdit }: { animal: RearingRow; today: string; canEdit: boolean }) {
  const router = useRouter()
  const t = useT()
  const s = rearingSummary(animal, today)
  const open = () => router.push(`/recria/${animal.id}`)
  return (
    <Card onPress={open}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.text }} numberOfLines={1}>{tag(animal)} {animal.name}</Text>
          <Muted>{t(animal.species)} · {s.months} {t('meses')}</Muted>
        </View>
        <Badge label="Recria" tone="blue" />
      </View>
      {/* Peso atual em destaque, com o ganho por dia; a barra mostra quanto falta para a meta */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.md }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>{s.last ? kg(s.last.weight) : '—'}</Text>
        {s.gmd !== null ? <Badge label={`${s.gmd >= 0 ? '+' : ''}${brNumber(s.gmd, 2)} kg/d`} tone={s.gmd >= 0 ? 'green' : 'red'} /> : null}
      </View>
      {s.last && animal.rearingTarget ? <View style={{ marginTop: space.sm }}><WeightToTarget current={s.last.weight} target={animal.rearingTarget} /></View> : null}
      {s.gainKg !== null ? <Text style={{ marginTop: space.sm, color: colors.text, fontSize: font.sm }}>{t('Ganhou {kg} desde a desmama.', { kg: kg(s.gainKg) })}</Text> : null}
      {s.projection ? <Text style={{ marginTop: 4, color: colors.text, fontSize: font.sm }}>{t('Chega a {kg} em {days} ({date}).', { kg: kg(animal.rearingTarget!), days: plural(s.projection.days, 'dia', 'dias'), date: brDate(s.projection.date) })}</Text> : null}
      {!s.last ? <Muted style={{ marginTop: space.sm }}>{t('Sem pesagem ainda. Pese para o app calcular o ganho.')}</Muted> : null}
      {animal.gender === 'Fêmea' ? <Muted style={{ marginTop: 4 }}>{coverageLine(animal.reproductions[0])}</Muted> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, marginTop: space.md }}>
        {canEdit ? <Button label="Pesar" variant="secondary" onPress={open} style={{ flexGrow: 1, flexBasis: 140 }} /> : null}
        <Muted>{plural(s.days, 'dia', 'dias')} {t('na recria')}</Muted>
      </View>
    </Card>
  )
}
