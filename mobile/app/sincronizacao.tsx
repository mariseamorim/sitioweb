import { Text } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { discardOutbox, listOutbox, retryFailed } from '@/sync/local'
import { syncNow, useSyncState } from '@/sync'
import { Badge, Button, Card, Muted, Notice, Row, Screen } from '@/ui'
import { colors, space } from '@/theme'

const MODULOS: Record<string, string> = { leite: 'Leite', animais: 'Animal', vacinacao: 'Vacina', veterinario: 'Tratamento', financeiro: 'Financeiro', estoque: 'Estoque' }
const ACOES: Record<string, string> = { POST: 'criar', PUT: 'alterar', PATCH: 'alterar', DELETE: 'apagar' }

export default function Sincronizacao() {
  const farmId = useFarmId()
  const { canAccess } = useSession()
  const sync = useSyncState()
  const items = useLive(() => listOutbox(farmId), [farmId])

  return (
    <Screen>
      <Card>
        <Text style={{ fontWeight: '700', fontSize: 18, color: colors.text }}>{sync.online ? 'Com internet' : 'Sem internet'}</Text>
        <Muted>{sync.lastSyncAt ? `Última sincronização: ${new Date(sync.lastSyncAt).toLocaleString('pt-BR')}` : 'Ainda não sincronizado'}</Muted>
        <Muted>{sync.pending} para enviar · {sync.failed} recusados</Muted>
        {sync.error ? <Notice tone="red" text={sync.error} /> : null}
        <Button label={sync.syncing ? 'Sincronizando…' : 'Sincronizar agora'} loading={sync.syncing} onPress={() => void syncNow(farmId, canAccess)} style={{ marginTop: space.md }} />
      </Card>
      <Muted style={{ marginBottom: space.sm }}>
        Tudo o que você anota fica guardado no aparelho na hora. Esta lista é o que ainda não chegou ao servidor. Se um envio for recusado, o servidor não aceitou o registro (por exemplo, um animal apagado): corrija ou descarte.
      </Muted>
      {items.length === 0 ? <Card><Muted>Nada pendente. Tudo o que foi anotado já está no servidor.</Muted></Card> : items.map(o => (
        <Card key={o.seq} style={{ paddingVertical: space.sm }}>
          <Row title={`${ACOES[o.method] ?? o.method} · ${MODULOS[o.module] ?? o.module}`} detail={`${new Date(o.createdAt).toLocaleString('pt-BR')}${o.lastError ? ' · ' + o.lastError : ''}`}
            badge={<Badge label={o.failed ? 'Recusado' : 'Para enviar'} tone={o.failed ? 'red' : 'blue'} />} />
          {o.failed ? <Button label="Descartar este envio" variant="ghost" onPress={() => discardOutbox(o.seq)} /> : null}
        </Card>
      ))}
      {sync.failed > 0 ? <Button label="Tentar de novo os recusados" variant="secondary" onPress={() => { retryFailed(farmId); void syncNow(farmId, canAccess) }} /> : null}
    </Screen>
  )
}
