import { Pressable, Text, View } from 'react-native'
import { Card, Muted } from '@/ui'
import { colors, font, radius, space } from '@/theme'
import { monthName, monthShort } from '@/lib/reproInsights'
import { useT } from '@/lib/i18n'
import type { VetClient, VetPanel } from './panel'

// Gráficos do painel do veterinário com todas as propriedades juntas (como src/app/consultoria/VetCharts.tsx do site):
// partos previstos por mês em colunas empilhadas (uma cor por propriedade, na ordem do painel) e concepção por
// propriedade em barras deitadas; tocar numa barra abre os indicadores da propriedade. Feitos com Views, sem biblioteca.

// Paleta categórica validada (ordem fixa; a cor segue a propriedade). Da 8ª em diante, todas juntas em "Outras".
const PALETTE = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6']
const OTHER = '#9ca3af'
const PLOT_HEIGHT = 120
/** Espaço branco entre as partes empilhadas */
const GAP = 2

interface Series { key: string; name: string; color: string; counts: number[] }

export function VetCharts({ panel, onOpen, busy }: { panel: VetPanel; onOpen: (farmId: string, href: string) => void; busy: string | null }) {
  if (!panel.clients.length) return null
  return (
    <>
      <BirthsChart clients={panel.clients} />
      <RateBars clients={panel.clients} onOpen={onOpen} busy={busy} />
    </>
  )
}

function BirthsChart({ clients }: { clients: VetClient[] }) {
  const t = useT()
  const months = clients.find(c => c.birthsByMonth?.length)?.birthsByMonth?.map(m => m.month) ?? []
  const countsOf = (c: VetClient) => months.map(month => c.birthsByMonth?.find(m => m.month === month)?.count ?? 0)
  const series: Series[] = clients.slice(0, PALETTE.length).map((c, i) => ({ key: c.id, name: c.name, color: PALETTE[i], counts: countsOf(c) }))
  const rest = clients.slice(PALETTE.length)
  if (rest.length) series.push({ key: 'outras', name: t('Outras ({n})', { n: rest.length }), color: OTHER, counts: months.map((_, i) => rest.reduce((sum, c) => sum + countsOf(c)[i], 0)) })
  const totals = months.map((_, i) => series.reduce((sum, s) => sum + s.counts[i], 0))
  const total = totals.reduce((a, b) => a + b, 0)
  const max = Math.max(1, ...totals)
  const births = (n: number) => t(n === 1 ? '{n} parto previsto' : '{n} partos previstos', { n })
  // Só entram na legenda as propriedades com algum parto no período
  const shown = series.filter(s => s.counts.some(Boolean))
  let peak = 0
  totals.forEach((n, i) => { if (n > totals[peak]) peak = i })

  return (
    <Card>
      <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{t('Partos previstos por mês')}</Text>
      <Muted>{t('Todas as propriedades, pelas coberturas em aberto')}</Muted>
      {!months.length || total === 0 ? <Muted style={{ textAlign: 'center', paddingVertical: space.xl }}>{t('Nenhum parto previsto nos próximos 6 meses.')}</Muted> : (
        <>
          {shown.length > 1 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: space.xs, marginTop: space.sm }}>
              {shown.map(s => (
                <View key={s.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: s.color }} />
                  <Text style={{ fontSize: font.sm, color: colors.text }}>{s.name}</Text>
                </View>
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: PLOT_HEIGHT + 18, borderBottomWidth: 1, borderBottomColor: colors.border, marginTop: space.md }}>
            {months.map((month, i) => {
              const parts = series.filter(s => s.counts[i] > 0)
              const label = [`${monthName(month)}: ${births(totals[i])}`, ...parts.map(s => `${s.name}: ${s.counts[i]}`)].join('. ')
              return (
                <View key={month} accessible accessibilityLabel={label} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                  {totals[i] > 0 ? <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, marginBottom: 2 }}>{totals[i]}</Text> : null}
                  {/* De baixo para cima, na ordem do painel; a parte de cima tem os cantos arredondados */}
                  <View style={{ width: '62%', maxWidth: 28, flexDirection: 'column-reverse' }}>
                    {parts.map((s, j) => {
                      const height = Math.max(2, Math.round((s.counts[i] / max) * PLOT_HEIGHT))
                      const top = j === parts.length - 1
                      return <View key={s.key} style={{ height, backgroundColor: s.color, marginTop: top ? 0 : GAP, borderTopLeftRadius: top ? Math.min(4, height) : 0, borderTopRightRadius: top ? Math.min(4, height) : 0 }} />
                    })}
                  </View>
                </View>
              )
            })}
          </View>
          <View style={{ flexDirection: 'row', marginTop: 4 }}>
            {months.map(month => <Text key={month} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: colors.muted }} numberOfLines={1}>{monthShort(month)}</Text>)}
          </View>
          <View style={{ marginTop: space.sm, backgroundColor: colors.bg, borderRadius: radius.sm, padding: space.sm }}>
            <Text style={{ fontSize: font.sm, color: colors.muted }}>
              {t('Maior:')} {monthName(months[peak])}: {births(totals[peak])}
              {shown.length > 1 ? ` (${shown.filter(s => s.counts[peak] > 0).map(s => `${s.name} ${s.counts[peak]}`).join(', ')})` : ''}
            </Text>
          </View>
        </>
      )}
    </Card>
  )
}

function RateBars({ clients, onOpen, busy }: { clients: VetClient[]; onOpen: (farmId: string, href: string) => void; busy: string | null }) {
  const t = useT()
  // Maior para a menor; as sem diagnóstico no fim
  const sorted = [...clients].sort((a, b) => (b.pregnancyRate ?? -1) - (a.pregnancyRate ?? -1))
  return (
    <Card>
      <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>{t('Concepção por propriedade')}</Text>
      <Muted>{t('Das diagnosticadas nos últimos 12 meses, quantas ficaram prenhas. Toque para ver os indicadores.')}</Muted>
      <View style={{ marginTop: space.sm }}>
        {sorted.map(c => (
          <Pressable key={c.id} disabled={!!busy} onPress={() => onOpen(c.farmId, '/reproducao/indicadores')} accessibilityRole="button"
            accessibilityLabel={`${c.name}: ${c.pregnancyRate === null ? t('sem diagnóstico') : `${c.pregnancyRate}%`}`}
            style={({ pressed }) => ({ paddingVertical: space.sm, minHeight: 44, opacity: busy === c.farmId ? 0.5 : pressed ? 0.7 : 1 })}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, marginBottom: 4 }}>
              <Text style={{ flex: 1, color: colors.text, fontSize: font.sm }} numberOfLines={1}>{c.name}</Text>
              <Text style={{ color: colors.text, fontSize: font.sm, fontWeight: '700' }}>{c.pregnancyRate === null ? '—' : `${c.pregnancyRate}%`} ›</Text>
            </View>
            <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.border, overflow: 'hidden' }}>
              {c.pregnancyRate !== null ? <View style={{ width: `${Math.max(1, c.pregnancyRate)}%`, height: 10, backgroundColor: colors.green }} /> : null}
            </View>
          </Pressable>
        ))}
      </View>
      {sorted.some(c => c.pregnancyRate === null) ? <Muted style={{ marginTop: space.xs }}>{t('— ainda sem diagnóstico de gestação nos últimos 12 meses')}</Muted> : null}
    </Card>
  )
}
