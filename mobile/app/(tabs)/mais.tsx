import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { Alert, Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { useSyncState } from '@/sync'
import { Card, Muted, Row, Screen } from '@/ui'
import { colors } from '@/theme'

export default function Mais() {
  const { user, canAccess, logout } = useSession()
  const sync = useSyncState()
  const router = useRouter()
  const icon = (name: keyof typeof Ionicons.glyphMap) => <Ionicons name={name} size={22} color={colors.muted} />

  function sair() {
    const aviso = sync.pending > 0 ? `Há ${sync.pending} registro(s) ainda não enviados ao servidor. Se sair agora, eles serão perdidos. ` : ''
    Alert.alert('Sair da conta', aviso + 'Os dados guardados neste aparelho serão apagados.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: async () => { await logout(); router.replace('/login') } },
    ])
  }

  return (
    <Screen>
      <Card>
        <Text style={{ fontWeight: '700', fontSize: 18, color: colors.text }}>{user?.name}</Text>
        <Muted>{user?.farmName ?? 'Sem propriedade aberta'}</Muted>
      </Card>
      <Card style={{ paddingVertical: 4 }}>
        {canAccess('veterinario') ? <Row title="Tratamentos" detail="Remédios e carência do leite" right={icon('chevron-forward')} onPress={() => router.push('/tratamentos')} /> : null}
        {canAccess('financeiro') ? <Row title="Financeiro" detail="Entradas, saídas e saldo" right={icon('chevron-forward')} onPress={() => router.push('/financeiro')} /> : null}
        {canAccess('estoque') ? <Row title="Estoque" detail="Ração, sal, remédios e vacinas" right={icon('chevron-forward')} onPress={() => router.push('/estoque')} /> : null}
      </Card>
      <Card style={{ paddingVertical: 4 }}>
        <Row title="Sincronização" detail={sync.pending ? `${sync.pending} para enviar` : sync.online ? 'Em dia' : 'Sem internet'} right={icon('sync-outline')} onPress={() => router.push('/sincronizacao')} />
        {(user?.farms.length ?? 0) > 1 || user?.role === 'admin' ? <Row title="Trocar de propriedade" right={icon('home-outline')} onPress={() => router.push('/propriedade')} /> : null}
        <Row title="Sair da conta" right={icon('log-out-outline')} onPress={sair} />
      </Card>
      <View style={{ alignItems: 'center', marginTop: 8 }}><Muted>Anota Aí Agro · app Android</Muted></View>
    </Screen>
  )
}
