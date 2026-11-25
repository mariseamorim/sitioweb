import { useState, type ReactNode } from 'react'
import { SHEET_STATUSES } from '@/lib/reproSheet'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { brNumber, todayISO } from '@/lib/format'
import { exportCSV, exportPDF } from '@/lib/reportExport'
import { badgeTone, buildReport, REPORT_TYPES, type Report, type ReportSection, type ReportTone } from '@/lib/reports'
import { animalOptions } from '@/repos/animals'
import { Ionicons } from '@expo/vector-icons'
import { Badge, Button, Card, Chips, DateField, IconCircle, Muted, Notice, Screen, SelectField, Tile, TileGrid, Title, type Accent } from '@/ui'
import { chartColors, colors, font, radius, space } from '@/theme'
import { useT, type Vars } from '@/lib/i18n'

type Preset = 'mes' | 'mes-passado' | 'ano' | 'outro'

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'mes', label: 'Este mês' },
  { value: 'mes-passado', label: 'Mês passado' },
  { value: 'ano', label: 'Este ano' },
  { value: 'outro', label: 'Outro período' },
]

// Ícone de cada tipo de relatório (só aparência; todos no verde, como no modelo)
const REPORT_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  financeiro: 'bar-chart-outline', partos: 'paw', rebanho: 'list', estoque: 'cube-outline',
  'ficha-animal': 'id-card-outline', leite: 'water-outline', vacinacao: 'medkit', 'ficha-reprodutiva': 'heart-outline',
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function presetRange(preset: Exclude<Preset, 'outro'>): [string, string] {
  const now = new Date()
  if (preset === 'mes') return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), todayISO()]
  if (preset === 'mes-passado') return [iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), iso(new Date(now.getFullYear(), now.getMonth(), 0))]
  return [iso(new Date(now.getFullYear(), 0, 1)), todayISO()]
}

// ── Prévia em barras ────────────────────────────────────────────────────
// Lida das próprias tabelas do relatório (não muda nada no que vai para o PDF): leite por dia, leite por mês da ficha
// do animal e o saldo do caixa por dia. Com mais de 31 dias, junta por mês para as barras não ficarem finas demais.

type Point = { label: string; value: number }

/** "1.234,5" / "R$ 1.234,56" / "-R$ 10,00" → número */
function parseBr(v: string | number): number {
  if (typeof v === 'number') return v
  const s = v.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : 0
}

/** Soma por dia (dd/mm/aaaa) e, se passar de 31 dias, por mês (mm/aaaa) */
function byDayOrMonth(pairs: [string, number][]): Point[] {
  const days = new Map<string, number>()
  for (const [d, v] of pairs) days.set(d, (days.get(d) ?? 0) + v)
  if (days.size <= 31) return [...days.entries()].map(([d, v]) => ({ label: d.slice(0, 5), value: v }))
  const months = new Map<string, number>()
  for (const [d, v] of days) { const m = d.slice(3, 5) + '/' + d.slice(8, 10); months.set(m, (months.get(m) ?? 0) + v) }
  return [...months.entries()].map(([m, v]) => ({ label: m, value: v }))
}

function chartOf(key: string, report: Report): { title: string; unit: 'L' | 'R$'; points: Point[] } | null {
  const section = (title: string) => report.sections.find(s => s.title === title)
  if (key === 'leite') {
    const s = section('Por dia')
    if (!s?.rows.length) return null
    return { title: 'Leite por dia (L)', unit: 'L', points: byDayOrMonth(s.rows.map(r => [String(r[0]), parseBr(r[2])])) }
  }
  if (key === 'ficha-animal') {
    const s = section('Leite por mês')
    if (!s?.rows.length) return null
    return { title: 'Leite por mês (L)', unit: 'L', points: s.rows.map(r => ({ label: String(r[0]).slice(0, 3) + String(r[0]).slice(5, 7), value: parseBr(r[1]) })) }
  }
  if (key === 'financeiro') {
    const s = section('Lançamentos')
    if (!s?.rows.length) return null
    return { title: 'Saldo por dia', unit: 'R$', points: byDayOrMonth(s.rows.map(r => [String(r[0]), parseBr(r[5])])) }
  }
  return null
}

const BAR_AREA = 110

/** Colunas simples (como DayBars do Leite). Valor negativo (caixa) fica vermelho; o maior valor vem escrito em cima. */
function Bars({ points, unit }: { points: Point[]; unit: 'L' | 'R$' }) {
  const max = Math.max(1, ...points.map(p => Math.abs(p.value)))
  const best = points.reduce((a, b) => (Math.abs(b.value) > Math.abs(a.value) ? b : a), points[0])
  const every = points.length > 10 ? Math.ceil(points.length / 6) : 1
  const gap = points.length > 10 ? 2 : 6
  const fmt = (v: number) => (unit === 'L' ? `${brNumber(v, 0)} L` : brNumber(v, 0))
  // Leite: uma cor por coluna (como no site); dinheiro: verde para sobra, vermelho para falta
  const colorOf = (p: Point, i: number) => (unit === 'R$' ? (p.value < 0 ? colors.red : colors.green) : points.length > 14 ? '#0d9488' : chartColors[i % chartColors.length])
  return (
    <View accessible accessibilityLabel={points.map(p => `${p.label}: ${fmt(p.value)}`).join(', ')}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_AREA + 18, gap }}>
        {points.map((p, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            {p === best ? (
              <View style={{ backgroundColor: colorOf(p, i), borderRadius: 5, paddingHorizontal: 4, marginBottom: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: '800', color: '#ffffff' }} numberOfLines={1}>{brNumber(p.value, 0)}</Text>
              </View>
            ) : null}
            <View style={{ width: '100%', height: Math.max(p.value ? 3 : 0, (Math.abs(p.value) / max) * BAR_AREA), backgroundColor: colorOf(p, i), borderTopLeftRadius: 5, borderTopRightRadius: 5 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 4, gap }}>
        {points.map((p, i) => (
          <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, color: colors.muted }} numberOfLines={1}>
            {(points.length - 1 - i) % every === 0 ? p.label : ''}
          </Text>
        ))}
      </View>
    </View>
  )
}

// ── Relatório na tela: cartões em vez de tabela larga ───────────────────
// O PDF e a planilha continuam saindo das colunas e linhas; aqui só muda a aparência.

type T = (text: string, vars?: Vars) => string

// Textos com número no meio viram chave com {n} (como na tela de relatórios do site)
const COUNTED: Record<string, string> = {
  'meses sem parir': '{n} meses sem parir',
  registros: '{n} registros',
  aplicadas: '{n} aplicadas',
  pendentes: '{n} pendentes',
  dias: '{n} dias',
}

function cellText(t: T, v: string | number | undefined): string {
  if (typeof v === 'number') return String(v)
  const s = v ?? ''
  const counted = s.match(/^(\d+) (meses sem parir|registros|aplicadas|pendentes|dias)$/)
  if (counted) return t(COUNTED[counted[2]], { n: counted[1] })
  const average = s.match(/^Média (.+) L\/dia$/)
  if (average) return t('Média {v} L/dia', { v: average[1] })
  return t(s)
}

/** Título traduzido da seção (o de "Demorando para criar" leva o número de meses) */
function sectionTitle(t: T, title: string): string {
  const late = title.match(/^Demorando para criar \(mais de (\d+) meses sem parir, sem prenhez anotada\)$/)
  return late ? t('Demorando para criar (mais de {n} meses sem parir, sem prenhez anotada)', { n: late[1] }) : t(title)
}

const BADGE_TONE: Record<ReportTone, 'green' | 'amber' | 'red'> = { good: 'green', warn: 'amber', bad: 'red' }
/** Cor da pílula pela palavra em português (antes de traduzir); fora das listas, cinza */
const badgeColor = (v: string | number | undefined) => { const tone = badgeTone(v); return tone ? BADGE_TONE[tone] : 'muted' as const }
const TILE_ACCENT: Record<ReportTone, Accent> = { good: 'green', warn: 'amber', bad: 'red' }
const NEUTRAL_ACCENTS: Accent[] = ['blue', 'teal', 'green']

/**
 * Como cada linha vira cartão. `title`: colunas do topo (a 1ª em negrito, as outras ao lado, em cinza);
 * `value`: coluna em destaque à direita (com `suffix` ao lado, ex. a unidade); `pill`: coluna em pílula cinza;
 * `hide`: colunas que não aparecem no cartão; `summary`: a seção inteira num cartão só, uma linha por registro.
 * A chave é "relatório|título da seção" em português (sem título: "relatório|").
 */
interface Layout { title?: number[]; value?: number; suffix?: number; pill?: number; hide?: number[]; summary?: boolean }
const LAYOUTS: Record<string, Layout> = {
  'leite|Por dia': { title: [0], value: 2 },
  'leite|Por vaca': { title: [1, 0], value: 2 },
  'ficha-animal|Dados': { summary: true },
  'ficha-animal|Leite por mês': { summary: true },
  'ficha-animal|Crias': { title: [2, 1] },
  'vacinacao|': { title: [1, 0], hide: [6] },
  'financeiro|Por categoria': { summary: true },
  'financeiro|Lançamentos': { title: [3], value: 5, pill: 2, hide: [1] },
  'partos|Por vaca': { title: [1, 0], hide: [5] },
  'partos|Demorando para criar': { title: [1, 0] },
  'partos|Crias': { title: [3, 2] },
  'rebanho|Resumo por espécie': { summary: true },
  'rebanho|Animais': { title: [0], hide: [3] },
  'estoque|Entradas e saídas': { title: [1], value: 3, suffix: 4 },
  'estoque|Saldo atual': { title: [0], value: 2, suffix: 4 },
}

function layoutOf(reportKey: string, title: string | undefined): Layout {
  const base = title?.startsWith('Demorando para criar') ? 'Demorando para criar' : title ?? ''
  return LAYOUTS[`${reportKey}|${base}`] ?? { title: [0] }
}

const empty = (v: string | number | undefined) => v === undefined || v === '' || v === '—'

function SectionView({ reportKey, section: s }: { reportKey: string; section: ReportSection }) {
  const t = useT()
  const layout = layoutOf(reportKey, s.title)
  const alert = s.alert && s.rows.length ? s.alert : null
  const heading = s.title ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.sm }}>
      {alert ? <Ionicons name="warning-outline" size={18} color={alert === 'bad' ? colors.red : colors.amber} /> : null}
      <Text style={[styles.sectionTitle, alert && { color: alert === 'bad' ? colors.red : colors.amber }]}>{sectionTitle(t, s.title)}</Text>
    </View>
  ) : null

  let body: ReactNode
  if (s.kind === 'cards') {
    let neutral = 0
    body = (
      <TileGrid>
        {s.rows.map((row, i) => {
          const tone = s.tones?.[i]
          const accent = tone ? TILE_ACCENT[tone] : NEUTRAL_ACCENTS[neutral++ % NEUTRAL_ACCENTS.length]
          return <Tile key={i} label={cellText(t, row[0])} value={String(row[1])} accent={accent} />
        })}
      </TileGrid>
    )
  } else if (!s.rows.length) {
    body = <View style={styles.rowCard}><Muted>{t('Nenhum registro')}</Muted></View>
  } else if (layout.summary) {
    body = <SummaryCard section={s} />
  } else {
    body = (
      <View style={{ gap: space.sm }}>
        {s.rows.map((row, i) => <RowCard key={i} section={s} layout={layout} row={row} paid={s.paid?.[i]} />)}
        {s.footer ? <FooterCard section={s} /> : null}
      </View>
    )
  }

  return (
    <View style={[{ marginBottom: space.lg }, alert && {
      backgroundColor: alert === 'bad' ? colors.redSoft : colors.amberSoft, borderColor: alert === 'bad' ? '#fca5a5' : '#fcd34d',
      borderWidth: 1, borderRadius: radius.md, padding: space.md,
    }]}>
      {heading}
      {body}
    </View>
  )
}

/** Um registro em cartão: título e pílula (ou valor) no topo, demais campos embaixo */
function RowCard({ section: s, layout, row, paid }: { section: ReportSection; layout: Layout; row: (string | number)[]; paid?: boolean | null }) {
  const t = useT()
  const titleCols = layout.title ?? [0]
  const [main, ...rest] = titleCols.map(j => row[j]).filter(v => !empty(v))
  const used = new Set([...titleCols, ...(layout.hide ?? []), layout.value, layout.suffix, layout.pill, s.badgeColumn].filter((j): j is number => j !== undefined))
  const details = s.columns.map((c, j) => ({ c, j, v: row[j] })).filter(d => !used.has(d.j) && !empty(d.v))
  const badge = s.badgeColumn !== undefined && !layout.hide?.includes(s.badgeColumn) && !empty(row[s.badgeColumn])
    ? <Badge label={cellText(t, row[s.badgeColumn])} tone={badgeColor(row[s.badgeColumn])} />
    : null
  const value = layout.value !== undefined ? row[layout.value] : undefined
  const valueColor = layout.value !== undefined && s.signedColumn === layout.value
    ? (String(value).trim().startsWith('-') ? colors.red : '#15803d') : colors.text
  const income = row[1] === 'Receita'

  return (
    <View style={styles.rowCard}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.rowTitle} numberOfLines={2}>{cellText(t, main ?? '—')}</Text>
          {rest.length ? <Muted>{rest.map(v => cellText(t, v)).join(' · ')}</Muted> : null}
        </View>
        {value !== undefined ? (
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <Text style={{ fontSize: font.md, fontWeight: '800', color: valueColor }}>
              {String(value)}{layout.suffix !== undefined && !empty(row[layout.suffix]) ? ` ${cellText(t, row[layout.suffix])}` : ''}
            </Text>
            {/* Pago/recebido: joinha verde; pendente: joinha para baixo, vermelho */}
            {paid !== undefined && paid !== null ? (
              <View accessible accessibilityLabel={t(paid ? (income ? 'Recebido' : 'Pago') : 'Pendente')}>
                <Ionicons name={paid ? 'thumbs-up' : 'thumbs-down'} size={18} color={paid ? '#16a34a' : colors.red} />
              </View>
            ) : null}
          </View>
        ) : badge}
      </View>
      {(value !== undefined && badge) || layout.pill !== undefined || details.length ? (
        <View style={styles.details}>
          {value !== undefined ? badge : null}
          {layout.pill !== undefined && !empty(row[layout.pill]) ? <Badge label={cellText(t, row[layout.pill])} tone="muted" /> : null}
          {details.map(d => (
            <Text key={d.j} style={{ fontSize: font.sm, color: colors.muted }}>
              {t(d.c)} <Text style={{ color: colors.text, fontWeight: '600' }}>{cellText(t, d.v)}</Text>
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}

/** Linha totalizadora: negrito com fundo verde-claro (textos à esquerda, números à direita) */
function FooterCard({ section: s }: { section: ReportSection }) {
  const t = useT()
  const cells = (s.footer ?? []).map((v, j) => ({ v, j })).filter(d => !empty(d.v))
  const isNumber = (j: number) => !!s.numeric?.includes(j)
  const left = cells.filter(d => !isNumber(d.j)).map(d => cellText(t, d.v)).join(' · ')
  const right = cells.filter(d => isNumber(d.j)).map(d => cellText(t, d.v)).join(' · ')
  return (
    <View style={styles.footer}>
      <Text style={[styles.footerText, { flex: 1 }]}>{left}</Text>
      {right ? <Text style={styles.footerText}>{right}</Text> : null}
    </View>
  )
}

/** Seção inteira num cartão: uma linha por registro (resumos por espécie, por categoria, dados da ficha) */
function SummaryCard({ section: s }: { section: ReportSection }) {
  const t = useT()
  const numeric = s.numeric ?? []
  const two = s.columns.length === 2
  return (
    <View style={[styles.rowCard, { paddingVertical: space.xs }]}>
      {s.rows.map((row, i) => {
        const textCols = s.columns.map((_, j) => j).filter(j => !numeric.includes(j) && (!two || j === 0))
        const numCols = s.columns.map((_, j) => j).filter(j => numeric.includes(j) || (two && j === 1))
        return (
          <View key={i} style={[styles.summaryLine, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
              {textCols.map(j => (s.badgeColumn === j
                ? <Badge key={j} label={cellText(t, row[j])} tone={badgeColor(row[j])} />
                : <Text key={j} style={two ? { color: colors.muted, fontSize: font.sm } : styles.rowTitle}>{cellText(t, row[j])}</Text>))}
            </View>
            <View style={{ alignItems: 'flex-end', flexShrink: 1 }}>
              {/* Com uma só coluna de número, só o valor; com várias (por espécie), o nome de cada uma ao lado */}
              {numCols.length === 1 ? (
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: font.md, textAlign: 'right' }}>{cellText(t, row[numCols[0]])}</Text>
              ) : numCols.map(j => (
                <Text key={j} style={{ fontSize: font.sm, color: colors.muted }}>
                  {t(s.columns[j])} <Text style={{ color: colors.text, fontWeight: '700' }}>{cellText(t, row[j])}</Text>
                </Text>
              ))}
            </View>
          </View>
        )
      })}
      {s.footer ? (
        <View style={[styles.footer, { marginHorizontal: -space.md, marginBottom: -space.xs, borderRadius: 0, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md }]}>
          <Text style={[styles.footerText, { flex: 1 }]}>{cellText(t, s.footer[0])}</Text>
          <Text style={[styles.footerText, { textAlign: 'right' }]}>
            {s.footer.slice(1).map((v, k) => (numeric.length > 1 ? `${t(s.columns[k + 1])} ${v}` : String(v))).filter(Boolean).join(' · ')}
          </Text>
        </View>
      ) : null}
    </View>
  )
}

// Relatórios: escolha o tipo, o período (ou o animal), veja na tela e baixe em PDF ou planilha. Tudo calculado no aparelho.
export default function Relatorios() {
  const farmId = useFarmId()
  const { user, canAccess } = useSession()
  const t = useT()
  // O veterinário consultor não precisa do relatório de produção de leite (é do produtor)
  const types = REPORT_TYPES.filter(r => canAccess(r.module) && !(user?.vet && r.key === 'leite'))
  const [typeKey, setTypeKey] = useState('')
  const [preset, setPreset] = useState<Preset>('mes')
  const [[from, to], setRange] = useState<[string, string]>(presetRange('mes'))
  const [animalId, setAnimalId] = useState<string | null>(null)
  // Ficha reprodutiva: só um status (ex.: as inseminadas, no dia do diagnóstico); vazio = todas
  const [sheetStatus, setSheetStatus] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null)
  const type = types.find(r => r.key === typeKey)

  function choosePreset(p: Preset) {
    setPreset(p)
    if (p !== 'outro') setRange(presetRange(p))
  }

  function generate() {
    if (!type) return
    setError('')
    try {
      const r = buildReport(type.key, { farmId, farmName: user?.farmName ?? '', from: type.needsPeriod ? from : undefined, to: type.needsPeriod ? to : undefined, animalId, status: sheetStatus || null })
      if (!r) { setError(t(type.needsAnimal ? 'Animal não encontrado' : 'Não foi possível gerar o relatório.')); return }
      setReport(r)
    } catch (e) {
      setError(e instanceof Error ? t(e.message) : t('Não foi possível gerar o relatório.'))
    }
  }

  async function download(kind: 'pdf' | 'csv') {
    if (!report) return
    setBusy(kind)
    try { await (kind === 'pdf' ? exportPDF(report) : exportCSV(report)) } catch (e) { setError(e instanceof Error ? t(e.message) : t('Não foi possível exportar.')) } finally { setBusy(null) }
  }

  const canGenerate = !!type && (!type.needsAnimal || !!animalId) && (!type.needsPeriod || (!!from && !!to && from <= to))
  const chart = report && type ? chartOf(type.key, report) : null

  return (
    <Screen>
      <Title sub="Escolha o relatório, veja na tela e baixe em PDF ou planilha.">Relatórios</Title>
      {types.length === 0 ? <Muted>{t('Você não tem acesso a nenhum relatório. Peça ao administrador.')}</Muted> : null}

      {/* 1. Tipo: cartão branco com borda, ícone verde, título, descrição e › */}
      <View style={{ gap: space.sm, marginBottom: space.md }}>
        {types.map(r => {
          const on = typeKey === r.key
          return (
            <Pressable key={r.key} onPress={() => { setTypeKey(r.key); setReport(null); setError('') }} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={({ pressed }) => [styles.type, on && { borderColor: colors.green, backgroundColor: colors.greenSoft }, pressed && { opacity: 0.85 }]}>
              <IconCircle icon={REPORT_ICON[r.key] ?? 'document-text-outline'} tone="green" />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{t(r.label)}</Text>
                <Muted>{t(r.description)}</Muted>
              </View>
              <Ionicons name="chevron-forward" size={20} color={on ? colors.green : colors.muted} />
            </Pressable>
          )
        })}
      </View>

      {/* 2. Opções */}
      {type ? (
        <Card>
          {type.needsPeriod ? (
            <View>
              <Text style={styles.label}>{t('Período')}</Text>
              <Chips options={PRESETS} value={preset} onChange={choosePreset} />
              {preset === 'outro' ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                  <View style={{ flexGrow: 1, flexBasis: 140 }}><DateField label="De" value={from} onChange={v => setRange([v, to])} /></View>
                  <View style={{ flexGrow: 1, flexBasis: 140 }}><DateField label="Até" value={to} onChange={v => setRange([from, v])} /></View>
                </View>
              ) : <Muted style={{ marginBottom: space.md }}>{t('{from} a {to}', { from: from.split('-').reverse().join('/'), to: to.split('-').reverse().join('/') })}</Muted>}
            </View>
          ) : null}
          {type.key === 'ficha-reprodutiva' ? <Chips options={[{ value: '', label: 'Todas' }, ...SHEET_STATUSES.map(s => ({ value: s.key, label: s.label }))]} value={sheetStatus} onChange={setSheetStatus} /> : null}
          {type.needsAnimal ? <SelectField label="Animal" value={animalId} options={animalOptions(farmId)} onChange={setAnimalId} searchable placeholder="— Selecione —" /> : null}
          <Button label="Ver relatório" onPress={generate} disabled={!canGenerate} />
          {error ? <View style={{ marginTop: space.md }}><Notice tone="red" text={error} /></View> : null}
        </Card>
      ) : null}

      {/* 3. Resultado: cartão de borda verde com título, propriedade e período, prévia e os botões de baixar */}
      {report ? (
        <Card style={{ borderColor: colors.green, borderWidth: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
            <IconCircle icon={(type && REPORT_ICON[type.key]) ?? 'document-text-outline'} tone="green" />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.text }}>{t(report.title)}</Text>
              <Muted>{report.subtitle}</Muted>
            </View>
          </View>
          {chart && chart.points.length ? (
            <View style={{ marginTop: space.md }}>
              <Text style={[styles.label, { marginBottom: space.sm }]}>{t(chart.title)}</Text>
              <Bars points={chart.points} unit={chart.unit} />
            </View>
          ) : null}
          {/* Com letra grande os botões vão um embaixo do outro */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.md }}>
            <Pressable onPress={() => download('pdf')} disabled={!!busy} accessibilityRole="button"
              style={({ pressed }) => [styles.pdf, { opacity: busy && busy !== 'pdf' ? 0.5 : pressed ? 0.85 : 1 }]}>
              {busy === 'pdf' ? <ActivityIndicator color={colors.white} /> : <Ionicons name="download-outline" size={20} color={colors.white} />}
              <Text style={{ color: colors.white, fontWeight: '700', fontSize: font.md }}>{t(busy === 'pdf' ? 'Gerando PDF...' : 'Baixar PDF')}</Text>
            </Pressable>
            <Button label="Baixar planilha" variant="secondary" onPress={() => download('csv')} loading={busy === 'csv'} disabled={!!busy} style={{ flexGrow: 1, flexBasis: 160 }} />
          </View>
          {report.sections.map((s, i) => <SectionView key={i} reportKey={type?.key ?? ''} section={s} />)}
        </Card>
      ) : null}
    </Screen>
  )
}

const styles = {
  type: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.white, padding: space.lg },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.muted, marginBottom: 4 },
  pdf: { flexGrow: 1, flexBasis: 160, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.lg },
  // Cartões do relatório na tela (fundo branco, borda cinza; total em verde-claro)
  sectionTitle: { fontSize: font.md, fontWeight: '700', color: colors.text, flexShrink: 1 },
  rowCard: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm + 2 },
  rowTitle: { fontSize: font.md, fontWeight: '700', color: colors.text },
  details: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: space.md, rowGap: 4, marginTop: 6 },
  summaryLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.sm },
  footer: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.greenSoft, borderWidth: 1, borderColor: '#86efac', borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: space.sm + 2 },
  footerText: { fontSize: font.md, fontWeight: '800', color: colors.greenDark },
} as const
