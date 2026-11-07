// Aprovar laticínios e associações (porte de src/app/admin/organizacoes/page.tsx). Lista é a cópia local de
// /api/organizacoes; aprovar/bloquear entra na fila de envio e a cópia já muda.
import { Alert, Text, View } from 'react-native'
import { useFarmId } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate } from '@/lib/format'
import { openWhatsApp } from '@/lib/whatsapp'
import { CACHE, ORG_LABEL, plural, readCache, setApproval, STATUS_LABEL, STATUS_TONE, type Organization } from '@/repos/admin'
import { AdminOnly } from '@/ui/AdminOnly'
import { TextButton } from '@/ui/TextButton'
import { Badge, Button, Card, Empty, Muted, Screen, Title } from '@/ui'
import { colors, font, space } from '@/theme'

export default function AdminOrganizacoes() {
  return <AdminOnly><Organizacoes /></AdminOnly>
}

function Organizacoes() {
  const farmId = useFarmId()
  const organizations = useLive(() => readCache<Organization>(CACHE.orgs), [])
  const pending = organizations.filter(o => o.status === 'pendente').length

  function block(o: Organization) {
    Alert.alert(`Bloquear ${o.name}?`, 'A conta deixa de conseguir usar o painel.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Bloquear', style: 'destructive', onPress: () => setApproval(farmId, 'orgs', o.id, 'bloqueado') },
    ])
  }

  const counts = (o: Organization) => o.type === 'laticinio'
    ? `${plural(o._count.points, 'ponto', 'pontos')} de coleta · ${plural(o._count.routes, 'rota', 'rotas')}`
    : plural(o._count.members, 'associado', 'associados')

  return (
    <Screen>
      <Title sub={pending ? `${plural(pending, 'cadastro', 'cadastros')} aguardando aprovação` : 'Aprove quem pode usar os painéis de laticínio e associação'}>Laticínios e associações</Title>
      {organizations.length === 0 ? (
        <Empty title="Nenhum cadastro ainda." text="O link de cadastro fica em Criar conta. Sem internet, sincronize uma vez para baixar a lista." />
      ) : organizations.map(o => (
        <Card key={o.id}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: font.sm, fontWeight: '700', color: colors.green, textTransform: 'uppercase' }}>{ORG_LABEL[o.type] ?? o.type}</Text>
              <Text style={{ fontSize: font.md, fontWeight: '600', color: colors.text }}>{o.name}</Text>
              <Muted>{o.contactName} · {o.email} · {o.phone}{o.document ? ` · ${o.document}` : ''}</Muted>
              <Muted>{[o.city, o.state].filter(Boolean).join('/') || 'Cidade não informada'} · cadastrado em {brDate(o.createdAt)} · {counts(o)}</Muted>
            </View>
            <Badge label={STATUS_LABEL[o.status] ?? o.status} tone={STATUS_TONE[o.status] ?? 'muted'} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.md }}>
            {o.status !== 'aprovado' ? <Button label="Aprovar" onPress={() => setApproval(farmId, 'orgs', o.id, 'aprovado')} style={{ minHeight: 44 }} /> : null}
            {o.status !== 'bloqueado' ? <Button label="Bloquear" variant="secondary" onPress={() => block(o)} style={{ minHeight: 44 }} /> : null}
            <TextButton label="WhatsApp" onPress={() => void openWhatsApp(o.phone, `Olá, ${o.contactName}! Aqui é do Anota Aí Agro, sobre o cadastro de ${o.name}.`)} />
          </View>
        </Card>
      ))}
    </Screen>
  )
}
