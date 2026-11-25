import { Ionicons } from '@expo/vector-icons'
import { Avatar } from '@/ui/avatar'
import { useRouter } from 'expo-router'
import { Alert, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { isDemo } from '@/api/client'
import { useSyncState } from '@/sync'
import { Card, IconCircle, Muted, Notice, Row, Screen, type Tone } from '@/ui'
import { colors, font, space } from '@/theme'
import { useT } from '@/lib/i18n'
import { LanguagePicker } from '@/ui/LanguagePicker'

type Item = { title: string; detail?: string; href: string; module?: string; adminOnly?: boolean; /** Só para o veterinário consultor */ vetOnly?: boolean; /** Esconde do veterinário consultor */ vetHide?: boolean; icon: keyof typeof Ionicons.glyphMap; tone: Tone }

// Os mesmos grupos do menu lateral do site (src/components/Navbar.tsx): o primeiro sem título, depois Rebanho, Manejo,
// Gestão, Propriedade, Administração (só o administrador) e Ajuda. Cada item com ícone colorido num círculo.
const GROUPS: { label: string; items: Item[] }[] = [
  { label: '', items: [
    { title: 'Consultoria', detail: 'Propriedades que você atende', href: '/consultoria', vetOnly: true, icon: 'briefcase-outline', tone: 'green' },
    { title: 'Meu estoque', detail: 'Sêmen, medicamentos e material', href: '/meu-estoque', vetOnly: true, icon: 'flask-outline', tone: 'amber' },
    { title: 'Painel', href: '/(tabs)', icon: 'grid-outline', tone: 'green' },
    { title: 'Agenda', detail: 'Vacinas, partos, secagem, cio e visitas por dia', href: '/agenda', icon: 'calendar-outline', tone: 'blue' },
  ] },
  { label: 'Rebanho', items: [
    { title: 'Animais', href: '/(tabs)/animais', module: 'animais', icon: 'paw-outline', tone: 'green' },
    { title: 'Recria e engorda', vetHide: true, detail: 'Lotes, pesagens, trato e recria um a um', href: '/engorda', module: 'animais', icon: 'scale-outline', tone: 'amber' },
    { title: 'Reprodução', detail: 'Coberturas, prenhez e partos', href: '/reproducao', module: 'reproducao', icon: 'heart-outline', tone: 'red' },
    { title: 'Indicadores de reprodução', detail: 'Partos previstos, taxa de prenhez e leite por mês', href: '/reproducao/indicadores', module: 'reproducao', icon: 'bar-chart-outline', tone: 'purple' },
    { title: 'Diagnóstico em lote', detail: 'Prenha ou vazia, uma depois da outra', href: '/reproducao/diagnostico', module: 'reproducao', icon: 'checkmark-done-outline', tone: 'blue' },
  ] },
  { label: 'Manejo', items: [
    { title: 'Produção de leite', vetHide: true, href: '/(tabs)/leite', module: 'leite', icon: 'water-outline', tone: 'blue' },
    { title: 'Vacinação', href: '/(tabs)/vacinas', module: 'vacinacao', icon: 'medkit-outline', tone: 'purple' },
    { title: 'Tratamentos', detail: 'Remédios e carência do leite', href: '/tratamentos', module: 'veterinario', icon: 'bandage-outline', tone: 'red' },
  ] },
  { label: 'Gestão', items: [
    { title: 'Financeiro', detail: 'Entradas, saídas e saldo', href: '/financeiro', module: 'financeiro', icon: 'cash-outline', tone: 'green' },
    { title: 'Estoque', detail: 'Ração, sal, remédios e vacinas', href: '/estoque', module: 'estoque', icon: 'cube-outline', tone: 'amber' },
    { title: 'Relatórios', detail: 'Leite, rebanho, vacinas, caixa, partos e estoque', href: '/relatorios', icon: 'document-text-outline', tone: 'blue' },
    { title: 'Ofertas', detail: 'Insumos dos seus fornecedores e da sua região', href: '/ofertas', icon: 'pricetag-outline', tone: 'purple' },
  ] },
  { label: 'Propriedade', items: [
    { title: 'Propriedades', detail: 'Cadastro e troca de propriedade', href: '/fazendas', module: 'fazendas', icon: 'home-outline', tone: 'green' },
    { title: 'Usuários', detail: 'Equipe e permissões por módulo', href: '/usuarios', module: 'usuarios', icon: 'people-outline', tone: 'blue' },
  ] },
  { label: 'Administração', items: [
    { title: 'Contas e senhas', href: '/admin/contas', adminOnly: true, icon: 'lock-closed-outline', tone: 'muted' },
    { title: 'Aprovar fornecedores', href: '/admin/fornecedores', adminOnly: true, icon: 'storefront-outline', tone: 'muted' },
    { title: 'Aprovar laticínios e associações', href: '/admin/organizacoes', adminOnly: true, icon: 'business-outline', tone: 'muted' },
  ] },
  { label: 'Ajuda', items: [
    { title: 'Ajuda e suporte', href: '/ajuda', icon: 'help-circle-outline', tone: 'green' },
    { title: 'Manual do usuário', detail: 'Passo a passo ilustrado e PDF', href: '/manual', icon: 'book-outline', tone: 'amber' },
  ] },
]

export default function Mais() {
  const { user, canAccess, logout } = useSession()
  const sync = useSyncState()
  const router = useRouter()
  const icon = (name: keyof typeof Ionicons.glyphMap, tone: Tone = 'green') => <IconCircle icon={name} tone={tone} size={36} />
  const chevron = <Ionicons name="chevron-forward" size={18} color={colors.muted} />
  const isAdmin = user?.role === 'admin'
  const t = useT()

  function sair() {
    const aviso = sync.pending > 0 ? t('Há {n} registro(s) ainda não enviados ao servidor. Se sair agora, eles serão perdidos.', { n: sync.pending }) + ' ' : ''
    Alert.alert(t('Sair da conta'), aviso + t('Os dados guardados neste aparelho serão apagados.'), [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Sair'), style: 'destructive', onPress: async () => { await logout(); router.replace('/login') } },
    ])
  }

  const groups = GROUPS.map(g => ({ ...g, items: g.items.filter(i => (!i.module || canAccess(i.module)) && (!i.adminOnly || isAdmin) && (!i.vetOnly || !!user?.vet) && !(i.vetHide && user?.vet)) })).filter(g => g.items.length)

  return (
    <Screen>
      {isDemo() ? <Notice tone="blue" text={t('Demonstração: dados fictícios, guardados só neste celular. Nada é enviado ao servidor. Para sair, use "Sair da conta" em Mais.')} /> : null}
      {/* Cartão do usuário: iniciais num círculo verde, nome, propriedade aberta e o atalho para o cadastro */}
      <Card onPress={() => router.push('/perfil')} style={{ backgroundColor: colors.greenSoft, borderColor: colors.green }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <Avatar name={user?.name ?? ''} src={user?.avatar} size={48} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontWeight: '700', fontSize: 18, color: colors.greenDark }}>{user?.name}</Text>
            <Muted>{user?.farmName ?? t('Sem propriedade aberta')}</Muted>
            <Text style={{ color: colors.green, fontWeight: '700', fontSize: font.sm, marginTop: space.xs }}>{t('Meu cadastro')} ›</Text>
          </View>
        </View>
      </Card>
      {groups.map(g => (
        <View key={g.label || 'inicio'}>
          {g.label ? <Text style={{ fontSize: font.sm, fontWeight: '700', color: colors.greenDark, textTransform: 'uppercase', marginBottom: space.xs, marginLeft: space.xs }}>{t(g.label)}</Text> : null}
          <Card style={{ paddingVertical: 4 }}>
            {g.items.map(i => <Row key={i.href} left={icon(i.icon, i.tone)} title={t(i.title)} detail={i.detail && t(i.detail)} right={chevron} onPress={() => router.push(i.href as never)} />)}
          </Card>
        </View>
      ))}
      <Card style={{ paddingVertical: 4 }}>
        <Row left={icon('sync-outline', sync.pending ? 'amber' : 'green')} title={t('Sincronização')} detail={sync.pending ? t('{n} para enviar', { n: sync.pending }) : t(sync.online ? 'Em dia' : 'Sem internet')} right={chevron} onPress={() => router.push('/sincronizacao')} />
        {(user?.farms.length ?? 0) > 1 || isAdmin ? <Row left={icon('swap-horizontal-outline', 'blue')} title={t('Trocar de propriedade')} right={chevron} onPress={() => router.push('/propriedade')} /> : null}
        <Row left={icon('log-out-outline', 'red')} title={t('Sair da conta')} right={chevron} onPress={sair} />
      </Card>
      <LanguagePicker />
      <View style={{ alignItems: 'center', marginTop: 8 }}><Muted>Anota Aí Agro · app Android</Muted></View>
    </Screen>
  )
}
