import { Text, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { discardOutbox, listOutbox, retryFailed } from '@/sync/local'
import { syncNow, useSyncState } from '@/sync'
import { Badge, Button, Card, IconCircle, Muted, Notice, Row, Screen, Tile, TileGrid } from '@/ui'
import { colors, space } from '@/theme'
import { useT, useLocale } from '@/lib/i18n'

const MODULOS: Record<string, string> = { leite: 'Leite', animais: 'Animal', vacinacao: 'Vacina', veterinario: 'Tratamento', financeiro: 'Financeiro', estoque: 'Estoque', reproducao: 'Reprodução', usuarios: 'Usuário', fazendas: 'Propriedade', perfil: 'Meu cadastro', ofertas: 'Oferta', pedidos: 'Pedido', fornecedores: 'Fornecedor', admin: 'Administração', '': 'Registro' }
const ACOES: Record<string, string> = { POST: 'criar', PUT: 'alterar', PATCH: 'alterar', DELETE: 'apagar' }

export default function Sincronizacao() {
  const farmId = useFarmId()
  const { canAccess } = useSession()
  const sync = useSyncState()
  const items = useLive(() => listOutbox(farmId), [farmId])
  const t = useT()
  const locale = useLocale()

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md }}>
          <IconCircle icon={sync.online ? 'cloud-done-outline' : 'cloud-offline-outline'} tone={sync.online ? 'green' : 'amber'} size={48} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontWeight: '700', fontSize: 18, color: colors.text }}>{t(sync.online ? 'Com internet' : 'Sem internet')}</Text>
            <Muted>{sync.lastSyncAt ? t('Última sincronização: {date}', { date: new Date(sync.lastSyncAt).toLocaleString(locale) }) : t('Ainda não sincronizado')}</Muted>
          </View>
        </View>
        {/* Números em cartões coloridos: o que falta enviar e o que o servidor recusou */}
        <TileGrid>
          <Tile accent={sync.pending ? 'blue' : 'plain'} label={t('Para enviar')} value={String(sync.pending)} />
          <Tile accent={sync.failed ? 'red' : 'plain'} label={t('Recusados')} value={String(sync.failed)} />
        </TileGrid>
        {sync.error ? <Notice tone="red" text={sync.error} /> : null}
        <Button label={t(sync.syncing ? 'Sincronizando…' : 'Sincronizar agora')} loading={sync.syncing} onPress={() => void syncNow(farmId, canAccess)} style={{ marginTop: space.md }} />
      </Card>
      <Muted style={{ marginBottom: space.sm }}>
        {t('Tudo o que você anota fica guardado no aparelho na hora. Esta lista é o que ainda não chegou ao servidor. Se um envio for recusado, o servidor não aceitou o registro (por exemplo, um animal apagado): corrija ou descarte.')}
      </Muted>
      {items.length === 0 ? <Card><Muted>{t('Nada pendente. Tudo o que foi anotado já está no servidor.')}</Muted></Card> : items.map(o => (
        <Card key={o.seq} style={{ paddingVertical: space.sm }}>
          <Row left={<IconCircle icon={o.failed ? 'alert-circle-outline' : 'cloud-upload-outline'} tone={o.failed ? 'red' : 'blue'} />}
            title={`${t(ACOES[o.method] ?? o.method)} · ${t(MODULOS[o.module] ?? o.module)}`} detail={`${new Date(o.createdAt).toLocaleString(locale)}${o.lastError ? ' · ' + t(o.lastError) : ''}`}
            badge={<Badge label={o.failed ? 'Recusado' : 'Para enviar'} tone={o.failed ? 'red' : 'blue'} />} />
          {o.failed ? <Button label="Descartar este envio" variant="ghost" onPress={() => discardOutbox(o.seq)} /> : null}
        </Card>
      ))}
      {sync.failed > 0 ? <Button label="Tentar de novo os recusados" variant="secondary" onPress={() => { retryFailed(farmId); void syncNow(farmId, canAccess) }} /> : null}
    </Screen>
  )
}
