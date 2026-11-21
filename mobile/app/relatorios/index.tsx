import { useState } from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { brNumber, todayISO } from '@/lib/format'
import { exportCSV, exportPDF } from '@/lib/reportExport'
import { buildReport, REPORT_TYPES, type Report } from '@/lib/reports'
import { animalOptions } from '@/repos/animals'
import { Ionicons } from '@expo/vector-icons'
import { Button, Card, Chips, DateField, IconCircle, Muted, Notice, Screen, SelectField, Title } from '@/ui'
import { Table } from '@/ui/table'
import { colors, font, radius, space } from '@/theme'
import { useT } from '@/lib/i18n'

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
  'ficha-animal': 'id-card-outline', leite: 'water-outline', vacinacao: 'medkit',
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
  return (
    <View accessible accessibilityLabel={points.map(p => `${p.label}: ${fmt(p.value)}`).join(', ')}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: BAR_AREA + 18, gap }}>
        {points.map((p, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
            {p === best ? <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }} numberOfLines={1}>{brNumber(p.value, 0)}</Text> : null}
            <View style={{ width: '100%', height: Math.max(p.value ? 3 : 0, (Math.abs(p.value) / max) * BAR_AREA), backgroundColor: p.value < 0 ? colors.red : colors.green, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
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
      const r = buildReport(type.key, { farmId, farmName: user?.farmName ?? '', from: type.needsPeriod ? from : undefined, to: type.needsPeriod ? to : undefined, animalId })
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
          {report.sections.map((s, i) => (
            <View key={i} style={{ marginBottom: space.lg }}>
              {s.title ? <Text style={[styles.label, { marginBottom: space.sm }]}>{t(s.title)}</Text> : null}
              <Table columns={s.columns} rows={s.rows} numeric={s.numeric} footer={s.footer} />
            </View>
          ))}
        </Card>
      ) : null}
    </Screen>
  )
}

const styles = {
  type: { flexDirection: 'row', alignItems: 'center', gap: space.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.white, padding: space.lg },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.muted, marginBottom: 4 },
  pdf: { flexGrow: 1, flexBasis: 160, minHeight: 48, borderRadius: radius.md, backgroundColor: colors.green, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.lg },
} as const
