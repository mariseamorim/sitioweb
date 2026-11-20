import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Alert, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { isDemo } from '@/api/client'
import { useSyncState } from '@/sync'
import { Card, Muted, Notice, Row, Screen } from '@/ui'
import { colors, font, space } from '@/theme'
import { useT } from '@/lib/i18n'
import { LanguagePicker } from '@/ui/LanguagePicker'

type Item = { title: string; detail?: string; href: string; module?: string; adminOnly?: boolean; /** Só para o veterinário consultor */ vetOnly?: boolean; icon: keyof typeof Ionicons.glyphMap }

// Os mesmos grupos e itens do menu lateral do site (src/components/Navbar.tsx)
const GROUPS: { label: string; items: Item[] }[] = [
  { label: 'Visão geral', items: [
    { title: 'Consultoria', detail: 'Propriedades que você atende', href: '/consultoria', vetOnly: true, icon: 'briefcase-outline' },
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
    { title: 'Indicadores de reprodução', detail: 'Partos previstos, taxa de prenhez e leite por mês', href: '/reproducao/indicadores', module: 'reproducao', icon: 'bar-chart-outline' },
    { title: 'Diagnóstico em lote', detail: 'Prenha ou vazia, uma depois da outra', href: '/reproducao/diagnostico', module: 'reproducao', icon: 'checkmark-done-outline' },
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
    { title: 'Manual do usuário', detail: 'Passo a passo ilustrado e PDF', href: '/manual', icon: 'book-outline' },
  ] },
]

export default function Mais() {
  const { user, canAccess, logout } = useSession()
  const sync = useSyncState()
  const router = useRouter()
  const icon = (name: keyof typeof Ionicons.glyphMap) => <Ionicons name={name} size={22} color={colors.muted} />
  const isAdmin = user?.role === 'admin'
  const t = useT()

  function sair() {
    const aviso = sync.pending > 0 ? t('Há {n} registro(s) ainda não enviados ao servidor. Se sair agora, eles serão perdidos.', { n: sync.pending }) + ' ' : ''
    Alert.alert(t('Sair da conta'), aviso + t('Os dados guardados neste aparelho serão apagados.'), [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Sair'), style: 'destructive', onPress: async () => { await logout(); router.replace('/login') } },
    ])
  }

  const groups = GROUPS.map(g => ({ ...g, items: g.items.filter(i => (!i.module || canAccess(i.module)) && (!i.adminOnly || isAdmin) && (!i.vetOnly || !!user?.vet)) })).filter(g => g.items.length)

  return (
    <Screen>
      {isDemo() ? <Notice tone="blue" text={t('Demonstração: dados fictícios, guardados só neste celular. Nada é enviado ao servidor. Para sair, use "Sair da conta" em Mais.')} /> : null}
      <Card onPress={() => router.push('/perfil')}>
        <Text style={{ fontWeight: '700', fontSize: 18, color: colors.text }}>{user?.name}</Text>
        <Muted>{user?.farmName ?? t('Sem propriedade aberta')}</Muted>
        <Text style={{ color: colors.green, fontWeight: '600', fontSize: font.sm, marginTop: space.xs }}>{t('Meu cadastro')} ›</Text>
      </Card>
      {groups.map(g => (
        <View key={g.label}>
          <Text style={{ fontSize: font.sm, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginBottom: space.xs, marginLeft: space.xs }}>{t(g.label)}</Text>
          <Card style={{ paddingVertical: 4 }}>
            {g.items.map(i => <Row key={i.href} title={t(i.title)} detail={i.detail && t(i.detail)} right={icon(i.icon)} onPress={() => router.push(i.href as never)} />)}
          </Card>
        </View>
      ))}
      <Card style={{ paddingVertical: 4 }}>
        <Row title={t('Sincronização')} detail={sync.pending ? t('{n} para enviar', { n: sync.pending }) : t(sync.online ? 'Em dia' : 'Sem internet')} right={icon('sync-outline')} onPress={() => router.push('/sincronizacao')} />
        {(user?.farms.length ?? 0) > 1 || isAdmin ? <Row title={t('Trocar de propriedade')} right={icon('swap-horizontal-outline')} onPress={() => router.push('/propriedade')} /> : null}
        <Row title={t('Sair da conta')} right={icon('log-out-outline')} onPress={sair} />
      </Card>
      <LanguagePicker />
      <View style={{ alignItems: 'center', marginTop: 8 }}><Muted>Anota Aí Agro · app Android</Muted></View>
    </Screen>
  )
}
