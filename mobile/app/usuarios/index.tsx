import { useRouter } from 'expo-router'
import { FlatList, View } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { useLive } from '@/db/events'
import { contactLabel } from '@/lib/masks'
import { ROLE_LABEL } from '@/lib/modules'
import { listUsers, modulesLabel, type TeamUser } from '@/repos/users'
import { Badge, Empty, Fab, Muted, Row } from '@/ui'
import { colors, space } from '@/theme'

// Equipe da propriedade: a mesma lista do site (src/app/usuarios/page.tsx), lida da cópia local.
export default function Usuarios() {
  const farmId = useFarmId()
  const { user: me, canAccess } = useSession()
  const router = useRouter()
  const users = useLive(() => listUsers(farmId), [farmId])

  // O admin e o dono da propriedade (editor com o módulo Usuários) gerenciam a equipe
  const canManage = me?.role === 'admin' || (me?.role === 'editor' && !!me?.permissions?.includes('usuarios'))
  const canTouch = (u: TeamUser) => canManage && u.role !== 'admin'
  const roleTone = (role: string) => (role === 'admin' ? 'blue' : role === 'editor' ? 'green' : 'muted')

  if (!canAccess('usuarios')) return <Empty title="Sem permissão" text="Você não tem permissão para ver a equipe." />

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={users}
        keyExtractor={u => u.id}
        contentContainerStyle={{ padding: space.lg, paddingBottom: 96 }}
        ListHeaderComponent={<Muted style={{ marginBottom: space.sm }}>Gerencie acesso e permissões por módulo</Muted>}
        renderItem={({ item }) => (
          <Row title={item.name}
            detail={[contactLabel(item), modulesLabel(item)].filter(Boolean).join(' · ')}
            badge={<Badge label={ROLE_LABEL[item.role] || item.role} tone={roleTone(item.role)} />}
            right={canTouch(item) ? <Muted>Editar ›</Muted> : undefined}
            onPress={canTouch(item) ? () => router.push(`/usuarios/${item.id}`) : undefined} />
        )}
        ListEmptyComponent={<Empty title="Nenhum usuário cadastrado" text={canManage ? 'Toque em “Novo Usuário” para cadastrar alguém da equipe.' : undefined} />}
      />
      {canManage ? <Fab label="+ Novo Usuário" onPress={() => router.push('/usuarios/novo')} /> : null}
    </View>
  )
}
