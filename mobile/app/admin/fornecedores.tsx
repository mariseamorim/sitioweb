// Aprovar fornecedores (porte de src/app/admin/fornecedores/page.tsx). Lista é a cópia local de /api/fornecedores;
// aprovar/bloquear entra na fila de envio e a cópia já muda.
import { Alert, Text, View } from 'react-native'
import { useFarmId } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate } from '@/lib/format'
import { openWhatsApp } from '@/lib/whatsapp'
import { CACHE, plural, readCache, setApproval, STATUS_LABEL, STATUS_TONE, type AdminVendor } from '@/repos/admin'
import { AdminOnly } from '@/ui/AdminOnly'
import { TextButton } from '@/ui/TextButton'
import { Badge, Button, Card, Empty, Muted, Screen, Title } from '@/ui'
import { colors, font, space } from '@/theme'

export default function AdminFornecedores() {
  return <AdminOnly><Fornecedores /></AdminOnly>
}

function Fornecedores() {
  const farmId = useFarmId()
  const vendors = useLive(() => readCache<AdminVendor>(CACHE.vendors), [])
  const pending = vendors.filter(v => v.status === 'pendente').length

  function block(v: AdminVendor) {
    Alert.alert(`Bloquear ${v.companyName}?`, 'As ofertas deixam de aparecer e o fornecedor não consegue mais usar o painel.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Bloquear', style: 'destructive', onPress: () => setApproval(farmId, 'vendors', v.id, 'bloqueado') },
    ])
  }

  return (
    <Screen>
      <Title sub={pending ? `${plural(pending, 'cadastro', 'cadastros')} aguardando aprovação` : 'Aprove quem pode publicar ofertas no app'}>Fornecedores</Title>
      {vendors.length === 0 ? (
        <Empty title="Nenhum fornecedor cadastrado." text="O link de cadastro é /fornecedor/cadastro. Sem internet, sincronize uma vez para baixar a lista." />
      ) : vendors.map(v => (
        <Card key={v.id}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.sm }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={{ fontSize: font.md, fontWeight: '600', color: colors.text }}>{v.companyName}</Text>
              <Muted>{v.contactName} · {v.email} · {v.phone}{v.document ? ` · ${v.document}` : ''}</Muted>
              <Muted>
                {[v.city, v.state].filter(Boolean).join('/') || 'Cidade não informada'} · cadastrado em {brDate(v.createdAt)} · {plural(v._count.clients, 'cliente', 'clientes')} · {plural(v._count.promotions, 'oferta', 'ofertas')}
              </Muted>
              {v.description ? <Text style={{ fontSize: font.sm, color: colors.text, marginTop: 4 }}>{v.description}</Text> : null}
            </View>
            <Badge label={STATUS_LABEL[v.status] ?? v.status} tone={STATUS_TONE[v.status] ?? 'muted'} />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm, marginTop: space.md }}>
            {v.status !== 'aprovado' ? <Button label="Aprovar" onPress={() => setApproval(farmId, 'vendors', v.id, 'aprovado')} style={{ minHeight: 44 }} /> : null}
            {v.status !== 'bloqueado' ? <Button label="Bloquear" variant="secondary" onPress={() => block(v)} style={{ minHeight: 44 }} /> : null}
            <TextButton label="WhatsApp" onPress={() => void openWhatsApp(v.whatsapp || v.phone, `Olá, ${v.contactName}! Aqui é do Anota Aí Agro, sobre o cadastro da ${v.companyName}.`)} />
          </View>
        </Card>
      ))}
    </Screen>
  )
}
