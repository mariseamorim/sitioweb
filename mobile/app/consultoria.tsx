import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Share, Text, View } from 'react-native'
import { api, API_BASE, NetworkError } from '@/api/client'
import { useSession } from '@/auth/session'
import { getCache, setCache } from '@/db'
import { pendingCount } from '@/sync/local'
import { Button, Card, Empty, Muted, Notice, Screen, Stat } from '@/ui'
import { colors, font, space } from '@/theme'

interface Client {
  id: string; farmId: string; name: string; owner: string | null; city: string | null; state: string | null
  animals: number; awaitingDiagnosis: number; pregnancyRate: number | null; birthsSoon: number
}
interface Panel {
  vet: { name: string; inviteCode: string }
  openFarmId: string | null
  clients: Client[]
  /** Próximas visitas da agenda (marcar e remarcar é no site) */
  visits?: { id: string; farmName: string; date: string; time: string | null; purpose: string | null }[]
  ended: { id: string; name: string; records: number }[]
}

const CACHE_KEY = 'vet_panel'

// Painel do veterinário consultor (como src/app/consultoria/page.tsx do site): as propriedades atendidas e os
// números de reprodução de cada uma. Os números vêm do servidor; sem internet mostra a última cópia.
// Cadastrar propriedade de cliente, dar acesso ao produtor, marcar visita, relatório de visita, recibos, estoque do
// veterinário e o histórico dos encerrados ficam no site.
export default function Consultoria() {
  const { user, switchFarm } = useSession()
  const router = useRouter()
  const [panel, setPanel] = useState<Panel | null>(() => getCache<Panel>(CACHE_KEY))
  const [offline, setOffline] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await api<Panel>('/api/veterinario')
      setCache(CACHE_KEY, data)
      setPanel(data)
      setOffline(false)
    } catch (e) {
      if (e instanceof NetworkError) setOffline(true)
      else setError(e instanceof Error ? e.message : 'Não foi possível carregar o painel')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  /** Abre a propriedade do cliente (se for outra) e segue para a tela pedida. */
  async function open(client: Client, next: '/reproducao/diagnostico' | '/reproducao/indicadores' | '/reproducao' | '/(tabs)/animais') {
    setError('')
    if (user?.farmId !== client.farmId) {
      // A fila é enviada na propriedade aberta: trocar com algo pendente mandaria a anotação para a propriedade errada
      if (user?.farmId && pendingCount(user.farmId).pending > 0) {
        setError('Ainda há anotações salvas só no celular. Conecte-se à internet e espere o envio antes de abrir outra propriedade.')
        return
      }
      setBusy(client.id)
      try {
        await switchFarm(client.farmId)
      } catch (e) {
        setError(e instanceof NetworkError ? 'Sem internet: para abrir outra propriedade é preciso conexão.' : e instanceof Error ? e.message : 'Não foi possível abrir a propriedade')
        return
      } finally {
        setBusy(null)
      }
    }
    router.push(next)
  }

  if (!panel) return <Screen>{error ? <Notice tone="red" text={error} /> : <Empty title={offline ? 'Sem internet' : 'Carregando…'} text={offline ? 'O painel de consultoria precisa de conexão na primeira vez.' : undefined} />}</Screen>

  const link = `${API_BASE}/meu-veterinario?codigo=${panel.vet.inviteCode}`
  const rates = panel.clients.filter(c => c.pregnancyRate !== null).map(c => c.pregnancyRate as number)
  const average = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null
  const total = (pick: (c: Client) => number) => panel.clients.reduce((sum, c) => sum + pick(c), 0)

  return (
    <Screen>
      {offline ? <Notice text="Sem internet: mostrando os números da última vez que o painel carregou." /> : null}
      {error ? <Notice tone="red" text={error} /> : null}
      <Muted style={{ marginBottom: space.md }}>{panel.clients.length} {panel.clients.length === 1 ? 'propriedade atendida' : 'propriedades atendidas'} · {total(c => c.animals)} animais</Muted>
      <View style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.md }}>
        <Stat label="a diagnosticar" value={String(total(c => c.awaitingDiagnosis))} tone={total(c => c.awaitingDiagnosis) ? 'amber' : undefined} />
        <Stat label="concepção média" value={average === null ? '—' : `${average}%`} tone="green" />
        <Stat label="partos em 30 dias" value={String(total(c => c.birthsSoon))} />
      </View>

      {panel.visits?.length ? (
        <Card>
          <Text style={{ fontWeight: '700', color: colors.text, fontSize: font.md }}>Próximas visitas</Text>
          {panel.visits.map(v => (
            <View key={v.id} style={{ marginTop: space.sm }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{new Date(v.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}{v.time ? ` · ${v.time}` : ''} · {v.farmName}</Text>
              {v.purpose ? <Muted>{v.purpose}</Muted> : null}
            </View>
          ))}
          <Muted style={{ marginTop: space.sm }}>Para marcar ou remarcar, use o site.</Muted>
        </Card>
      ) : null}

      <Card style={{ backgroundColor: colors.greenSoft, borderColor: colors.green }}>
        <Text style={{ fontWeight: '700', color: colors.greenDark }}>Seu código de veterinário</Text>
        <Text style={{ fontSize: 26, fontWeight: '700', letterSpacing: 4, color: colors.greenDark, marginVertical: space.sm }} selectable>{panel.vet.inviteCode}</Text>
        <Muted style={{ marginBottom: space.md }}>O produtor informa este código em “Meu veterinário”, no site, para liberar a propriedade para você.</Muted>
        <Button label="Enviar ao produtor" onPress={() => { void Share.share({ message: `Olá! Sou ${panel.vet.name}, veterinário. Para eu acompanhar a sua propriedade no Anota Aí Agro, abra este link e confirme: ${link}` }) }} />
      </Card>

      {panel.clients.length === 0 ? <Empty title="Nenhuma propriedade ainda" text="Envie o seu código ao produtor. Para cadastrar a propriedade de um cliente que ainda não usa o sistema, use o site." /> : panel.clients.map(c => (
        <Card key={c.id}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm }}>
            <Text style={{ flex: 1, fontSize: font.lg, fontWeight: '700', color: colors.text }} numberOfLines={2}>{c.name}</Text>
            {user?.farmId === c.farmId ? <Text style={{ color: colors.green, fontWeight: '700', fontSize: font.sm }}>Aberta</Text> : null}
          </View>
          <Muted>{[c.owner, [c.city, c.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Sem dados do produtor'}</Muted>
          <Text style={{ color: colors.text, fontSize: font.sm, marginTop: space.sm }}>
            {c.animals} animais · concepção {c.pregnancyRate === null ? '—' : `${c.pregnancyRate}%`} · {c.awaitingDiagnosis} a diagnosticar · {c.birthsSoon} {c.birthsSoon === 1 ? 'parto' : 'partos'} em 30 dias
          </Text>
          <Button label="Diagnóstico em lote" onPress={() => void open(c, '/reproducao/diagnostico')} loading={busy === c.id} disabled={!!busy} style={{ marginTop: space.md }} />
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.sm }}>
            <Button label="Indicadores" variant="secondary" onPress={() => void open(c, '/reproducao/indicadores')} disabled={!!busy} style={{ flex: 1 }} />
            <Button label="Reprodução" variant="secondary" onPress={() => void open(c, '/reproducao')} disabled={!!busy} style={{ flex: 1 }} />
            <Button label="Animais" variant="secondary" onPress={() => void open(c, '/(tabs)/animais')} disabled={!!busy} style={{ flex: 1 }} />
          </View>
        </Card>
      ))}

      {panel.ended.length > 0 ? <Muted>{panel.ended.length} {panel.ended.length === 1 ? 'atendimento encerrado' : 'atendimentos encerrados'}: o histórico do que você lançou está no site, em Consultoria.</Muted> : null}
    </Screen>
  )
}
