import { useRouter } from 'expo-router'
import { useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { herdCalving, LATE_MONTHS, monthsLabel, plural, pregnancyChecks, type PregnancyCheck } from '@/lib/calving'
import { brDate } from '@/lib/format'
import { birthSoon, isOpen, listHerd, listReproductions, markEmptyAfterCalving, STATUS_LIST, statusTone, updateStatus, type Reproduction } from '@/repos/reproductions'
import { Badge, Button, Card, Chips, Empty, Fab, Muted, Row, Search, Stat } from '@/ui'
import { colors, font, radius, space } from '@/theme'

type Filter = 'Todas' | 'partos' | (typeof STATUS_LIST)[number]

// Reprodução: coberturas, prenhez e partos (mesma tela de src/app/reproducao/page.tsx do site)
export default function Reproducao() {
  const farmId = useFarmId()
  const { canEdit } = useSession()
  const router = useRouter()
  const [filter, setFilter] = useState<Filter>('Todas')
  const [q, setQ] = useState('')
  const { reproductions, herd } = useLive(() => ({ reproductions: listReproductions(farmId), herd: listHerd(farmId) }), [farmId])

  const term = q.trim().toLowerCase()
  const shown = reproductions.filter(r =>
    (filter === 'Todas' || (filter === 'partos' ? birthSoon(r) : r.status === filter))
    && (!term || `${r.femaleName ?? ''} ${r.femaleCode ?? ''} ${r.femaleCustomCode ?? ''}`.toLowerCase().includes(term)))
  const upcoming = reproductions.filter(r => birthSoon(r)).length

  // Resposta do "Confirmar prenhez": atualiza a cobertura anotada depois do parto ou cria o registro
  function answerCheck(check: PregnancyCheck, answer: 'Prenha' | 'Vazia') {
    if (check.openCoverage) {
      updateStatus(farmId, check.openCoverage.id, answer, '', check.openCoverage.observations ?? null)
    } else if (answer === 'Vazia') {
      markEmptyAfterCalving(farmId, check.cow.id)
    } else {
      // Prenha sem cobertura anotada: abre o registro já preenchido para informar a data da cobertura
      router.push({ pathname: '/reproducao/[id]', params: { id: 'nova', femaleId: check.cow.id, status: 'Prenha' } })
    }
  }

  const header = (
    <View>
      <PregnancyCheckPanel checks={pregnancyChecks(herd, reproductions)} canEdit={canEdit} onAnswer={answerCheck} />
      <HerdCalvingPanel herd={herd} reproductions={reproductions} onOpenAnimal={id => router.push(`/animais/${id}`)} />
      {upcoming > 0 ? (
        <Pressable onPress={() => setFilter(filter === 'partos' ? 'Todas' : 'partos')} style={[styles.banner, filter === 'partos' && { borderColor: colors.blue }]}>
          <Text style={{ color: colors.blue, fontSize: font.sm }}>
            <Text style={{ fontWeight: '700' }}>{upcoming}</Text> {upcoming > 1 ? 'partos esperados' : 'parto esperado'} nos próximos 30 dias{filter === 'partos' ? ' · mostrando só esses' : ''}
          </Text>
        </Pressable>
      ) : null}
      <Chips options={(['Todas', ...STATUS_LIST] as Filter[]).map(f => ({ value: f, label: f }))} value={filter === 'partos' ? 'Todas' : filter} onChange={setFilter} />
      <Search value={q} onChange={setQ} placeholder="Buscar animal por nome, código ou brinco" />
    </View>
  )

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={shown}
        keyExtractor={r => r.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 96 }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Row title={item.femaleName ?? 'Animal removido'}
            detail={`${item.maleName ? `Reprodutor ${item.maleName} · ` : ''}Cobertura ${brDate(item.coverageDate)}${item.expectedBirthDate && isOpen(item) ? ` · parto esperado ${brDate(item.expectedBirthDate)}` : item.actualBirthDate ? ` · pariu em ${brDate(item.actualBirthDate)}` : ''}`}
            badge={<Badge label={item.status} tone={statusTone(item.status)} />}
            onPress={() => router.push(`/reproducao/${item.id}`)} />
        )}
        ListEmptyComponent={<Empty title="Nenhum registro encontrado" text={canEdit ? 'Toque em “+ Registrar” para começar.' : undefined} />}
      />
      {canEdit ? <Fab label="+ Registrar" onPress={() => router.push('/reproducao/nova')} /> : null}
    </View>
  )
}

// "Confirmar prenhez": vacas que pariram há 2 meses ou mais e ainda não têm prenha/vazia anotada
function PregnancyCheckPanel({ checks, canEdit, onAnswer }: { checks: PregnancyCheck[]; canEdit: boolean; onAnswer: (c: PregnancyCheck, a: 'Prenha' | 'Vazia') => void }) {
  if (checks.length === 0) return null
  return (
    <Card style={{ backgroundColor: colors.amberSoft, borderColor: '#fcd34d' }}>
      <Text style={{ fontWeight: '700', color: colors.amber, fontSize: font.md }}>Confirmar prenhez</Text>
      <Text style={{ color: colors.amber, fontSize: font.sm }}>Vacas que pariram há 2 meses ou mais. Ela está prenha de novo?</Text>
      {checks.map(c => (
        <View key={c.cow.id} style={styles.checkItem}>
          <Text style={{ fontWeight: '600', color: colors.text }}>{c.cow.name} <Text style={{ fontWeight: '400', color: colors.muted }}>({c.cow.code})</Text></Text>
          <Muted>Pariu em {brDate(c.lastCalving)}, há {monthsLabel(Math.floor(c.daysSince / 30.44))}{c.openCoverage ? ` · coberta em ${brDate(String(c.openCoverage.coverageDate))}` : ''}</Muted>
          {canEdit ? (
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
              <Button label="Prenha" onPress={() => onAnswer(c, 'Prenha')} style={{ flex: 1, minHeight: 40 }} />
              <Button label="Vazia" variant="secondary" onPress={() => onAnswer(c, 'Vazia')} style={{ flex: 1, minHeight: 40 }} />
            </View>
          ) : null}
        </View>
      ))}
      {!canEdit ? <Muted style={{ marginTop: space.sm }}>Para confirmar é preciso permissão de edição.</Muted> : null}
    </Card>
  )
}

// Partos do rebanho: intervalo entre partos, idade na primeira cria e vacas demorando para criar
function HerdCalvingPanel({ herd, reproductions, onOpenAnimal }: { herd: ReturnType<typeof listHerd>; reproductions: Reproduction[]; onOpenAnimal: (id: string) => void }) {
  const [showNoCalf, setShowNoCalf] = useState(false)
  const pregnant = new Set(reproductions.filter(isOpen).map(r => r.femaleId))
  const stats = herdCalving(herd, pregnant)
  if (stats.cows.length === 0) return null
  const late = stats.late.filter(l => l.reason === 'sem-parir')
  const noCalf = stats.late.filter(l => l.reason === 'sem-cria')

  return (
    <View style={{ marginBottom: space.md }}>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat label="Intervalo médio entre partos" value={stats.averageInterval !== null ? monthsLabel(stats.averageInterval) : '—'} />
        <Stat label="Idade média na 1ª cria" value={stats.averageAgeAtFirst !== null ? monthsLabel(stats.averageAgeAtFirst) : '—'} />
        <Stat label="Vacas demorando para criar" value={String(late.length)} tone={late.length > 0 ? 'amber' : undefined} />
      </View>
      {stats.averageInterval === null ? <Muted style={{ marginTop: space.xs }}>Anote pelo menos 2 crias de uma vaca para ver o intervalo entre partos.</Muted> : null}
      {late.length > 0 ? (
        <Card style={{ marginTop: space.sm, marginBottom: 0, paddingVertical: 4, borderColor: '#fcd34d' }}>
          <Muted style={{ marginTop: space.sm }}>Mais de {LATE_MONTHS} meses sem parir e sem prenhez anotada</Muted>
          {late.map(({ stats: s }) => (
            <Row key={s.cow.id} title={`${s.cow.name} (${s.cow.code})`}
              detail={`${plural(s.calves, 'cria', 'crias')}${s.averageInterval !== null ? ` · costuma criar a cada ${monthsLabel(s.averageInterval)}` : ''}`}
              right={<Text style={{ color: colors.amber, fontWeight: '600', fontSize: font.sm }}>{monthsLabel(s.monthsSinceLast ?? 0)} sem parir</Text>}
              onPress={() => onOpenAnimal(s.cow.id)} />
          ))}
        </Card>
      ) : null}
      {noCalf.length > 0 ? (
        <Card style={{ marginTop: space.sm, marginBottom: 0 }}>
          <Pressable onPress={() => setShowNoCalf(!showNoCalf)} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontWeight: '600', color: colors.text, flex: 1 }}>{plural(noCalf.length, 'vaca adulta', 'vacas adultas')} sem nenhuma cria anotada</Text>
            <Text style={{ color: colors.green, fontWeight: '700' }}>{showNoCalf ? 'Esconder' : 'Ver'}</Text>
          </Pressable>
          {showNoCalf ? (
            <View>
              <Muted style={{ marginTop: space.xs }}>Se ela já criou, anote as crias antigas na ficha dela para o intervalo sair certo.</Muted>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
                {noCalf.map(({ stats: s }) => (
                  <Pressable key={s.cow.id} onPress={() => onOpenAnimal(s.cow.id)} style={styles.pill}>
                    <Text style={{ color: colors.text, fontSize: font.sm }}>{s.cow.name} · {monthsLabel(s.ageMonths)}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </Card>
      ) : null}
    </View>
  )
}

const styles = {
  banner: { backgroundColor: colors.blueSoft, borderRadius: radius.md, borderWidth: 1, borderColor: colors.blueSoft, padding: space.md, marginBottom: space.sm },
  checkItem: { backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: '#fde68a', padding: space.md, marginTop: space.sm },
  pill: { borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
} as const
