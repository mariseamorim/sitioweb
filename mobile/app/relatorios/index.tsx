import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { todayISO } from '@/lib/format'
import { exportCSV, exportPDF } from '@/lib/reportExport'
import { buildReport, REPORT_TYPES, type Report } from '@/lib/reports'
import { animalOptions } from '@/repos/animals'
import { Button, Card, Chips, DateField, Muted, Notice, Screen, SelectField, Title } from '@/ui'
import { Table } from '@/ui/table'
import { colors, font, radius, space } from '@/theme'

type Preset = 'mes' | 'mes-passado' | 'ano' | 'outro'

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'mes', label: 'Este mês' },
  { value: 'mes-passado', label: 'Mês passado' },
  { value: 'ano', label: 'Este ano' },
  { value: 'outro', label: 'Outro período' },
]

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
  const types = REPORT_TYPES.filter(t => canAccess(t.module))
  const [typeKey, setTypeKey] = useState('')
  const [preset, setPreset] = useState<Preset>('mes')
  const [[from, to], setRange] = useState<[string, string]>(presetRange('mes'))
  const [animalId, setAnimalId] = useState<string | null>(null)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null)
  const type = types.find(t => t.key === typeKey)

  function choosePreset(p: Preset) {
    setPreset(p)
    if (p !== 'outro') setRange(presetRange(p))
  }

  function generate() {
    if (!type) return
    setError('')
    try {
      const r = buildReport(type.key, { farmId, farmName: user?.farmName ?? '', from: type.needsPeriod ? from : undefined, to: type.needsPeriod ? to : undefined, animalId })
      if (!r) { setError(type.needsAnimal ? 'Animal não encontrado' : 'Não foi possível gerar o relatório.'); return }
      setReport(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível gerar o relatório.')
    }
  }

  async function download(kind: 'pdf' | 'csv') {
    if (!report) return
    setBusy(kind)
    try { await (kind === 'pdf' ? exportPDF(report) : exportCSV(report)) } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível exportar.') } finally { setBusy(null) }
  }

  const canGenerate = !!type && (!type.needsAnimal || !!animalId) && (!type.needsPeriod || (!!from && !!to && from <= to))

  return (
    <Screen>
      <Title sub="Escolha o relatório, veja na tela e baixe em PDF ou planilha.">Relatórios</Title>
      {types.length === 0 ? <Muted>Você não tem acesso a nenhum relatório. Peça ao administrador.</Muted> : null}

      {/* 1. Tipo */}
      <View style={{ gap: space.sm, marginBottom: space.md }}>
        {types.map(t => {
          const on = typeKey === t.key
          return (
            <Pressable key={t.key} onPress={() => { setTypeKey(t.key); setReport(null); setError('') }} style={[styles.type, on && { borderColor: colors.green, backgroundColor: colors.greenSoft }]}>
              <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{t.label}</Text>
              <Muted>{t.description}</Muted>
            </Pressable>
          )
        })}
      </View>

      {/* 2. Opções */}
      {type ? (
        <Card>
          {type.needsPeriod ? (
            <View>
              <Text style={styles.label}>Período</Text>
              <Chips options={PRESETS} value={preset} onChange={choosePreset} />
              {preset === 'outro' ? (
                <View style={{ flexDirection: 'row', gap: space.sm }}>
                  <View style={{ flex: 1 }}><DateField label="De" value={from} onChange={v => setRange([v, to])} /></View>
                  <View style={{ flex: 1 }}><DateField label="Até" value={to} onChange={v => setRange([from, v])} /></View>
                </View>
              ) : <Muted style={{ marginBottom: space.md }}>{from.split('-').reverse().join('/')} a {to.split('-').reverse().join('/')}</Muted>}
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
          <Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.text }}>{report.title}</Text>
          <Muted>{report.subtitle}</Muted>
          <View style={{ flexDirection: 'row', gap: space.sm, marginVertical: space.md }}>
            <Button label={busy === 'pdf' ? 'Gerando PDF...' : 'Baixar PDF'} onPress={() => download('pdf')} loading={busy === 'pdf'} disabled={!!busy} style={{ flex: 1 }} />
            <Button label="Baixar planilha" variant="secondary" onPress={() => download('csv')} loading={busy === 'csv'} disabled={!!busy} style={{ flex: 1 }} />
          </View>
          {report.sections.map((s, i) => (
            <View key={i} style={{ marginBottom: space.lg }}>
              {s.title ? <Text style={[styles.label, { marginBottom: space.sm }]}>{s.title}</Text> : null}
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
