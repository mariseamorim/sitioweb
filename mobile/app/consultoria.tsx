import { useRef, useState } from 'react'
import { Share, Text, useWindowDimensions, View } from 'react-native'
import { API_BASE, isDemo } from '@/api/client'
import { useSession } from '@/auth/session'
import { Button, Card, Empty, Muted, Notice, Screen, Tile, TileGrid } from '@/ui'
import { colors, font, space } from '@/theme'
import { todayISO } from '@/lib/format'
import { useT } from '@/lib/i18n'
import { useOpenFarm, useVetPanel, VetAgenda, VetTasks, type AgendaHandle, type VetClient } from '@/vet/panel'
import { VetCharts } from '@/vet/charts'

// Painel do veterinário consultor (como src/app/consultoria/page.tsx do site): o que fazer em cada propriedade, a
// agenda de visitas e as propriedades atendidas com os números de reprodução. Os números vêm do servidor; sem internet
// mostra a última cópia. Cadastrar propriedade de cliente, dar acesso ao produtor, relatório de visita, recibos,
// estoque do veterinário e o histórico dos encerrados ficam no site.
export default function Consultoria() {
  const { user } = useSession()
  const t = useT()
  // Largura mínima dos botões pequenos: a palavra mais longa inteira, no tamanho de letra do celular (bold ≈ 0,62 da letra por caractere)
  const { fontScale } = useWindowDimensions()
  const longest = Math.max(...['Indicadores', 'Reprodução', 'Animais'].map((label) => t(label).length))
  const smallButton = { flexGrow: 1, flexBasis: Math.ceil(longest * font.md * 0.62 * fontScale) + 2 * space.lg + 4 }
  const { panel, offline, error: loadError, reload } = useVetPanel()
  const [error, setError] = useState('')
  const { open, busy } = useOpenFarm(setError)
  const agenda = useRef<AgendaHandle>(null)

  if (!panel) return <Screen>{loadError ? <Notice tone="red" text={loadError} /> : <Empty title={offline ? t('Sem internet') : t('Carregando…')} text={offline ? t('O painel de consultoria precisa de conexão na primeira vez.') : undefined} />}</Screen>

  const link = `${API_BASE}/meu-veterinario?codigo=${panel.vet.inviteCode}`
  const rates = panel.clients.filter(c => c.pregnancyRate !== null).map(c => c.pregnancyRate as number)
  const average = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null
  const total = (pick: (c: VetClient) => number) => panel.clients.reduce((sum, c) => sum + pick(c), 0)
  const today = todayISO()
  const visitsToday = (panel.visits ?? []).filter(v => v.date.slice(0, 10) === today).length
  const lateShots = (panel.tasks ?? []).filter(k => k.href.startsWith('/vacinacao')).reduce((sum, k) => sum + (k.late ?? 0), 0)

  return (
    <Screen>
      {isDemo() ? <Notice tone="blue" text={t('Demonstração: dados fictícios, guardados só neste celular. Nada é enviado ao servidor. Para sair, use "Sair da conta" em Mais.')} /> : null}
      {offline ? <Notice text={t('Sem internet: mostrando os números da última vez que o painel carregou.')} /> : null}
      {error || loadError ? <Notice tone="red" text={error || loadError} /> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: font.xl, fontWeight: '800', color: colors.greenDark }} numberOfLines={2}>{panel.vet.name}</Text>
          <Muted>{panel.clients.length} {panel.clients.length === 1 ? t('propriedade atendida') : t('propriedades atendidas')} · {total(c => c.animals)} {t('animais')}</Muted>
        </View>
        <Button label={t('+ Visita')} disabled={!panel.clients.length} onPress={() => agenda.current?.openNew()} />
      </View>
      <TileGrid>
        <Tile accent="amber" label={t('Visitas hoje')} value={String(visitsToday)} detail={t('Para realizar')} />
        <Tile accent="blue" label={t('A diagnosticar')} value={String(total(c => c.awaitingDiagnosis))} detail={t('Animais')} />
        <Tile accent="red" label={t('Vacinas atrasadas')} value={String(lateShots)} detail={t('Pendentes')} />
        <Tile accent="green" label={t('Concepção média')} value={average === null ? '—' : `${average}%`} detail={t('Do rebanho')} />
      </TileGrid>

      <VetAgenda ref={agenda} panel={panel} onChanged={reload} />
      <VetTasks panel={panel} onOpen={(farmId, href) => void open(farmId, href)} busy={busy} />
      <VetCharts panel={panel} onOpen={(farmId, href) => void open(farmId, href)} busy={busy} />

      <Card style={{ backgroundColor: colors.greenSoft, borderColor: colors.green }}>
        <Text style={{ fontWeight: '700', color: colors.greenDark }}>{t('Seu código de veterinário')}</Text>
        <Text style={{ fontSize: 26, fontWeight: '700', letterSpacing: 4, color: colors.greenDark, marginVertical: space.sm }} selectable>{panel.vet.inviteCode}</Text>
        <Muted style={{ marginBottom: space.md }}>{t('O produtor informa este código em “Meu veterinário”, no site, para liberar a propriedade para você.')}</Muted>
        <Button label={t('Enviar ao produtor')} onPress={() => { void Share.share({ message: t('Olá! Sou {name}, veterinário. Para eu acompanhar a sua propriedade no Anota Aí Agro, abra este link e confirme: {link}', { name: panel.vet.name, link }) }) }} />
      </Card>

      {panel.clients.length === 0 ? <Empty title={t('Nenhuma propriedade ainda')} text={t('Envie o seu código ao produtor. Para cadastrar a propriedade de um cliente que ainda não usa o sistema, use o site.')} /> : panel.clients.map(c => (
        <Card key={c.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
            <Text style={{ flex: 1, fontSize: font.lg, fontWeight: '700', color: colors.text }} numberOfLines={2}>{c.name}</Text>
            {user?.farmId === c.farmId ? <Text style={{ color: colors.green, fontWeight: '700', fontSize: font.sm }}>{t('Aberta')}</Text> : null}
          </View>
          <Muted>{[c.owner, [c.city, c.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || t('Sem dados do produtor')}</Muted>
          <Text style={{ color: colors.text, fontSize: font.sm, marginTop: space.sm }}>
            {c.animals} {t('animais')} · {t('concepção')} {c.pregnancyRate === null ? '—' : `${c.pregnancyRate}%`} · {c.awaitingDiagnosis} {t('a diagnosticar')} · {c.birthsSoon} {c.birthsSoon === 1 ? t('parto') : t('partos')} {t('em 30 dias')}
          </Text>
          <Button label={t('Diagnóstico em lote')} onPress={() => void open(c.farmId, '/reproducao/diagnostico')} loading={busy === c.farmId} disabled={!!busy} style={{ marginTop: space.md }} />
          {/* Com letra grande os botões passam para a linha de baixo em vez de quebrar a palavra no meio */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm }}>
            <Button label={t('Indicadores')} variant="secondary" onPress={() => void open(c.farmId, '/reproducao/indicadores')} disabled={!!busy} style={smallButton} />
            <Button label={t('Reprodução')} variant="secondary" onPress={() => void open(c.farmId, '/reproducao')} disabled={!!busy} style={smallButton} />
            <Button label={t('Animais')} variant="secondary" onPress={() => void open(c.farmId, '/animais')} disabled={!!busy} style={smallButton} />
          </View>
        </Card>
      ))}

      {panel.ended.length > 0 ? <Muted>{panel.ended.length} {panel.ended.length === 1 ? t('atendimento encerrado') : t('atendimentos encerrados')}: {t('o histórico do que você lançou está no site, em Consultoria.')}</Muted> : null}
    </Screen>
  )
}
