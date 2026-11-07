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
import { Badge, Button, Card, Chips, Empty, Fab, Muted, Screen, Stat } from '@/ui'
import { MiniStat, Section, StatGrid, TextButton, coverageLine, kg, phaseLabel, plural, tag } from '@/ui/lots'
import { colors, font, space } from '@/theme'

type Tab = 'todos' | 'recria' | 'engorda'

/** Lotes de recria e engorda e a recria um a um (porte de src/app/engorda/page.tsx do site) */
export default function Engorda() {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
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
        <Muted style={{ marginBottom: space.sm }}>Na recria, acompanhe cada bezerro sozinho (desmama, pesagens, cobertura da novilha) ou em lote. Na engorda, junte os animais em lotes, pese e veja o ganho por dia, o trato e quando chegam ao peso de saída.</Muted>
        <Chips value={tab} onChange={setTab} options={[{ value: 'todos', label: 'Todos' }, { value: 'recria', label: `Recria (${count('recria')})` }, { value: 'engorda', label: `Engorda (${count('engorda')})` }]} />

        {tab !== 'engorda' ? <RearingSection list={rearing} today={today} canEdit={canEdit} /> : null}

        {openLots.length > 0 ? (
          <View style={{ gap: space.sm, marginTop: space.lg, marginBottom: space.md }}>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Stat label="Lotes abertos" value={String(openLots.length)} />
              <Stat label="Cabeças nos lotes" value={String(heads)} />
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Stat label="Peso médio" value={avgWeight !== null ? kg(avgWeight) : '—'} />
              <Stat label="Ganho por dia (média)" value={gmd !== null ? `${brNumber(gmd, 3)} kg` : '—'} tone="green" />
            </View>
          </View>
        ) : null}

        {visible.length === 0 ? (
          <Empty title={tab === 'todos' ? 'Nenhum lote ainda' : `Nenhum lote de ${phaseLabel(tab).toLowerCase()}`}
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
          <Muted>{plural(s.days, 'dia', 'dias')} no lote{lot.endDate ? ` · saiu em ${brDate(lot.endDate)}` : ''}</Muted>
        </View>
        <Badge label={phaseLabel(lot.phase)} tone={lot.phase === 'recria' ? 'blue' : 'amber'} />
      </View>
      <View style={{ marginTop: space.md }}>
        <StatGrid items={[
          { title: 'Animais', value: String(lot.animals.length || s.last?.headCount || 0) },
          { title: 'Peso médio', value: s.last ? kg(s.last.avgWeight) : '—' },
          { title: 'Ganho/dia', value: s.gmd !== null ? `${s.gmd >= 0 ? '+' : ''}${brNumber(s.gmd, 3)}` : '—', tone: 'green' },
        ]} />
      </View>
      {s.gainKg !== null ? <Text style={{ marginTop: space.md, color: colors.text, fontSize: font.sm }}>Ganhou <Text style={{ fontWeight: '700' }}>{kg(s.gainKg)}</Text> por cabeça desde a entrada.</Text> : null}
      {projection ? <Text style={{ marginTop: 4, color: colors.text, fontSize: font.sm }}>Chega a {kg(lot.targetWeight!)} em <Text style={{ fontWeight: '700' }}>{plural(projection.days, 'dia', 'dias')}</Text> ({brDate(projection.date)}).</Text> : null}
      {females > 0 && lot.phase === 'recria' ? <Text style={{ marginTop: 4, color: colors.text, fontSize: font.sm }}>{covered} de {plural(females, 'novilha', 'novilhas')} {covered === 1 ? 'coberta' : 'cobertas'}.</Text> : null}
      {productLines(lot, today).filter(p => p.perDay).map(p => {
        const warn = p.days !== null && p.days <= STOCK_WARNING_DAYS
        return <Text key={p.id} style={{ marginTop: 4, fontSize: font.sm, color: warn ? colors.amber : colors.muted, fontWeight: warn ? '700' : '400' }}>{p.supply.name}: {kg(p.perDay!)}/dia{p.days !== null ? ` · estoque para ${plural(p.days, 'dia', 'dias')}` : ''}</Text>
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

// ── Recria um a um ──────────────────────────────────────────────────────

function RearingSection({ list, today, canEdit }: { list: RearingRow[]; today: string; canEdit: boolean }) {
  const router = useRouter()
  const [showEnded, setShowEnded] = useState(false)
  const active = list.filter(isInRearing)
  const ended = list.filter(a => !isInRearing(a))
  return (
    <Section title="Recria um a um" hint="Bezerros e novilhas acompanhados sem lote: desmama, pesagens, ganho por dia e cobertura."
      right={canEdit ? <TextButton label="Acompanhar um animal" onPress={() => router.push('/recria/novo')} /> : undefined}>
      {active.length === 0 ? (
        <Muted style={{ padding: space.md, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 12 }}>
          Nenhum animal acompanhado sozinho. Em “Acompanhar um animal”, informe a desmama e o peso: o app passa a mostrar o ganho por dia e, nas novilhas, a cobertura.
        </Muted>
      ) : active.map(a => <RearingCard key={a.id} animal={a} today={today} canEdit={canEdit} />)}
      {ended.length > 0 ? (
        <View>
          <Pressable onPress={() => setShowEnded(v => !v)} style={{ minHeight: 44, justifyContent: 'center' }} accessibilityRole="button">
            <Text style={{ color: colors.muted, fontWeight: '700', fontSize: font.sm }}>{showEnded ? '▾' : '▸'} Saíram da recria ({ended.length})</Text>
          </Pressable>
          {showEnded ? (
            <Card style={{ paddingVertical: 4 }}>
              {ended.map(a => {
                const s = rearingSummary(a, today)
                return (
                  <Pressable key={a.id} onPress={() => router.push(`/recria/${a.id}`)} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.text }}><Text style={{ fontWeight: '700' }}>{tag(a)}</Text> {a.name}</Text>
                      <Muted>{brDate(a.rearingStart)} a {brDate(a.rearingEnd)} · {plural(s.days, 'dia', 'dias')}{s.gainKg !== null ? ` · ganhou ${kg(s.gainKg)}` : ''}</Muted>
                    </View>
                    <Text style={{ color: colors.green, fontWeight: '700', fontSize: font.sm }}>Abrir</Text>
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
  const s = rearingSummary(animal, today)
  const open = () => router.push(`/recria/${animal.id}`)
  return (
    <Card onPress={open}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.text }} numberOfLines={1}>{tag(animal)} {animal.name}</Text>
          <Muted>{animal.species} · {s.months} meses · {plural(s.days, 'dia', 'dias')} na recria</Muted>
        </View>
        <Badge label="Recria" tone="blue" />
      </View>
      <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
        <MiniStat title="Último peso" value={s.last ? kg(s.last.weight) : '—'} />
        <MiniStat title="Ganho/dia" value={s.gmd !== null ? `${s.gmd >= 0 ? '+' : ''}${brNumber(s.gmd, 3)}` : '—'} tone="green" />
        <MiniStat title="Alvo" value={animal.rearingTarget ? kg(animal.rearingTarget) : '—'} />
      </View>
      {s.gainKg !== null ? <Text style={{ marginTop: space.md, color: colors.text, fontSize: font.sm }}>Ganhou <Text style={{ fontWeight: '700' }}>{kg(s.gainKg)}</Text> desde a desmama.</Text> : null}
      {s.projection ? <Text style={{ marginTop: 4, color: colors.text, fontSize: font.sm }}>Chega a {kg(animal.rearingTarget!)} em <Text style={{ fontWeight: '700' }}>{plural(s.projection.days, 'dia', 'dias')}</Text> ({brDate(s.projection.date)}).</Text> : null}
      {!s.last ? <Muted style={{ marginTop: space.md }}>Sem pesagem ainda. Pese para o app calcular o ganho.</Muted> : null}
      {animal.gender === 'Fêmea' ? <Muted style={{ marginTop: 4 }}>{coverageLine(animal.reproductions[0])}</Muted> : null}
      {canEdit ? <Button label="Pesar" variant="secondary" onPress={open} style={{ marginTop: space.md }} /> : null}
    </Card>
  )
}
