import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Alert, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { useSyncState } from '@/sync'
import { Card, Muted, Row, Screen } from '@/ui'
import { colors, font, space } from '@/theme'

type Item = { title: string; detail?: string; href: string; module?: string; adminOnly?: boolean; icon: keyof typeof Ionicons.glyphMap }

// Os mesmos grupos e itens do menu lateral do site (src/components/Navbar.tsx)
const GROUPS: { label: string; items: Item[] }[] = [
  { label: 'Visão geral', items: [
    { title: 'Painel', href: '/(tabs)', icon: 'grid-outline' },
    { title: 'Propriedades', detail: 'Cadastro e troca de propriedade', href: '/fazendas', module: 'fazendas', icon: 'home-outline' },
  ] },
  { label: 'Rebanho e produção', items: [
    { title: 'Animais', href: '/(tabs)/animais', module: 'animais', icon: 'paw-outline' },
    { title: 'Recria e engorda', detail: 'Lotes, pesagens, trato e recria um a um', href: '/engorda', module: 'animais', icon: 'scale-outline' },
    { title: 'Produção de leite', href: '/(tabs)/leite', module: 'leite', icon: 'water-outline' },
    { title: 'Tratamentos', detail: 'Remédios e carência do leite', href: '/tratamentos', module: 'veterinario', icon: 'bandage-outline' },
    { title: 'Vacinação', href: '/(tabs)/vacinas', module: 'vacinacao', icon: 'medkit-outline' },
    { title: 'Reprodução', detail: 'Coberturas, prenhez e partos', href: '/reproducao', module: 'reproducao', icon: 'heart-outline' },
  ] },
  { label: 'Gestão', items: [
    { title: 'Financeiro', detail: 'Entradas, saídas e saldo', href: '/financeiro', module: 'financeiro', icon: 'cash-outline' },
    { title: 'Estoque', detail: 'Ração, sal, remédios e vacinas', href: '/estoque', module: 'estoque', icon: 'cube-outline' },
    { title: 'Relatórios', detail: 'Leite, rebanho, vacinas, caixa, partos e estoque', href: '/relatorios', icon: 'document-text-outline' },
    { title: 'Usuários', detail: 'Equipe e permissões por módulo', href: '/usuarios', module: 'usuarios', icon: 'people-outline' },
  ] },
  { label: 'Fornecedores', items: [
    { title: 'Ofertas', detail: 'Insumos dos seus fornecedores e da sua região', href: '/ofertas', icon: 'pricetag-outline' },
  ] },
  { label: 'Administração', items: [
    { title: 'Contas e senhas', href: '/admin/contas', adminOnly: true, icon: 'lock-closed-outline' },
    { title: 'Aprovar fornecedores', href: '/admin/fornecedores', adminOnly: true, icon: 'storefront-outline' },
    { title: 'Aprovar laticínios e associações', href: '/admin/organizacoes', adminOnly: true, icon: 'business-outline' },
  ] },
  { label: 'Ajuda', items: [
    { title: 'Ajuda e suporte', href: '/ajuda', icon: 'help-circle-outline' },
  ] },
]

export default function Mais() {
  const { user, canAccess, logout } = useSession()
  const sync = useSyncState()
  const router = useRouter()
  const icon = (name: keyof typeof Ionicons.glyphMap) => <Ionicons name={name} size={22} color={colors.muted} />
  const isAdmin = user?.role === 'admin'

  function sair() {
    const aviso = sync.pending > 0 ? `Há ${sync.pending} registro(s) ainda não enviados ao servidor. Se sair agora, eles serão perdidos. ` : ''
    Alert.alert('Sair da conta', aviso + 'Os dados guardados neste aparelho serão apagados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => { await logout(); router.replace('/login') } },
    ])
  }

  const groups = GROUPS.map(g => ({ ...g, items: g.items.filter(i => (!i.module || canAccess(i.module)) && (!i.adminOnly || isAdmin)) })).filter(g => g.items.length)

  return (
    <Screen>
      <Card onPress={() => router.push('/perfil')}>
        <Text style={{ fontWeight: '700', fontSize: 18, color: colors.text }}>{user?.name}</Text>
        <Muted>{user?.farmName ?? 'Sem propriedade aberta'}</Muted>
        <Text style={{ color: colors.green, fontWeight: '600', fontSize: font.sm, marginTop: space.xs }}>Meu cadastro ›</Text>
      </Card>
      {groups.map(g => (
        <View key={g.label}>
          <Text style={{ fontSize: font.sm, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginBottom: space.xs, marginLeft: space.xs }}>{g.label}</Text>
          <Card style={{ paddingVertical: 4 }}>
            {g.items.map(i => <Row key={i.href} title={i.title} detail={i.detail} right={icon(i.icon)} onPress={() => router.push(i.href as never)} />)}
          </Card>
        </View>
      ))}
      <Card style={{ paddingVertical: 4 }}>
        <Row title="Sincronização" detail={sync.pending ? `${sync.pending} para enviar` : sync.online ? 'Em dia' : 'Sem internet'} right={icon('sync-outline')} onPress={() => router.push('/sincronizacao')} />
        {(user?.farms.length ?? 0) > 1 || isAdmin ? <Row title="Trocar de propriedade" right={icon('swap-horizontal-outline')} onPress={() => router.push('/propriedade')} /> : null}
        <Row title="Sair da conta" right={icon('log-out-outline')} onPress={sair} />
      </Card>
      <View style={{ alignItems: 'center', marginTop: 8 }}><Muted>Anota Aí Agro · app Android</Muted></View>
    </Screen>
  )
}
