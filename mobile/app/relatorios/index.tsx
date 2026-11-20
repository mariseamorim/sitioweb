import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { todayISO } from '@/lib/format'
import { exportCSV, exportPDF } from '@/lib/reportExport'
import { buildReport, REPORT_TYPES, type Report } from '@/lib/reports'
import { animalOptions } from '@/repos/animals'
import type { Ionicons } from '@expo/vector-icons'
import { Button, Card, Chips, DateField, IconCircle, Muted, Notice, Screen, SelectField, Title, type Tone } from '@/ui'
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

// Ícone e cor de cada tipo de relatório (só aparência)
const REPORT_ICON: Record<string, [keyof typeof Ionicons.glyphMap, Tone]> = {
  leite: ['water-outline', 'blue'], 'ficha-animal': ['paw-outline', 'green'], vacinacao: ['shield-checkmark-outline', 'purple'],
  financeiro: ['cash-outline', 'green'], partos: ['heart-outline', 'red'], rebanho: ['list-outline', 'amber'], estoque: ['cube-outline', 'amber'],
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

function presetRange(preset: Exclude<Preset, 'outro'>): [string, string] {
  const now = new Date()
  if (preset === 'mes') return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), todayISO()]
  if (preset === 'mes-passado') return [iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), iso(new Date(now.getFullYear(), now.getMonth(), 0))]
  return [iso(new Date(now.getFullYear(), 0, 1)), todayISO()]
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

  return (
    <Screen>
      <Title sub="Escolha o relatório, veja na tela e baixe em PDF ou planilha.">Relatórios</Title>
      {types.length === 0 ? <Muted>{t('Você não tem acesso a nenhum relatório. Peça ao administrador.')}</Muted> : null}

      {/* 1. Tipo */}
      <View style={{ gap: space.sm, marginBottom: space.md }}>
        {types.map(r => {
          const on = typeKey === r.key
          return (
            <Pressable key={r.key} onPress={() => { setTypeKey(r.key); setReport(null); setError('') }} style={[styles.type, { flexDirection: 'row', alignItems: 'center', gap: space.md }, on && { borderColor: colors.green, backgroundColor: colors.greenSoft }]}>
              <IconCircle icon={REPORT_ICON[r.key]?.[0] ?? 'document-text-outline'} tone={REPORT_ICON[r.key]?.[1] ?? 'green'} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{t(r.label)}</Text>
                <Muted>{t(r.description)}</Muted>
              </View>
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
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1 }}><DateField label="De" value={from} onChange={v => setRange([v, to])} /></View>
                  <View style={{ flex: 1 }}><DateField label="Até" value={to} onChange={v => setRange([from, v])} /></View>
                </View>
              ) : <Muted style={{ marginBottom: space.md }}>{t('{from} a {to}', { from: from.split('-').reverse().join('/'), to: to.split('-').reverse().join('/') })}</Muted>}
            </View>
          ) : null}
          {type.needsAnimal ? <SelectField label="Animal" value={animalId} options={animalOptions(farmId)} onChange={setAnimalId} searchable placeholder="— Selecione —" /> : null}
          <Button label="Ver relatório" onPress={generate} disabled={!canGenerate} />
          {error ? <View style={{ marginTop: space.md }}><Notice tone="red" text={error} /></View> : null}
        </Card>
      ) : null}

      {/* 3. Resultado */}
      {report ? (
        <Card>
          <Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.text }}>{t(report.title)}</Text>
          <Muted>{report.subtitle}</Muted>
          <View style={{ flexDirection: 'row', gap: space.sm, marginVertical: space.md }}>
            <Button label={t(busy === 'pdf' ? 'Gerando PDF...' : 'Baixar PDF')} onPress={() => download('pdf')} loading={busy === 'pdf'} disabled={!!busy} style={{ flex: 1 }} />
            <Button label="Baixar planilha" variant="secondary" onPress={() => download('csv')} loading={busy === 'csv'} disabled={!!busy} style={{ flex: 1 }} />
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
  type: { borderWidth: 2, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.white, padding: space.lg },
  label: { fontSize: font.sm, fontWeight: '600', color: colors.muted, marginBottom: 4 },
} as const
