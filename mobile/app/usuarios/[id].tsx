import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert } from 'react-native'
import { useFarmId, useSession } from '@/auth/session'
import { contactLabel, maskPhone } from '@/lib/masks'
import { MODULES, TEAM_ROLES } from '@/lib/modules'
import { createUser, getUser, removeUser, updateUser } from '@/repos/users'
import { Button, Field, Muted, Notice, Screen, SelectField } from '@/ui'
import { CheckGroup } from '@/ui/checks'
import { space } from '@/theme'

const MODULE_OPTIONS = MODULES.map(m => ({ key: m.key, label: m.label }))

// Novo usuário (id = 'novo') ou edição de alguém da equipe, como os formulários do site.
export default function UsuarioForm() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const farmId = useFarmId()
  const { user: me } = useSession()
  const router = useRouter()
  const editing = id && id !== 'novo' ? getUser(id) : null
  const self = !!editing && editing.id === me?.id

  const canManage = me?.role === 'admin' || (me?.role === 'editor' && !!me?.permissions?.includes('usuarios'))
  // O admin libera qualquer módulo; o dono só os que ele mesmo tem
  const grantable = me?.role === 'admin' ? undefined : me?.permissions ?? []

  const [name, setName] = useState(editing?.name ?? '')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState(editing?.role ?? 'viewer')
  const [permissions, setPermissions] = useState<string[]>(editing?.permissions ?? [])
  const [error, setError] = useState('')

  function save() {
    if (!name.trim()) { setError('Informe o nome'); return }
    if (editing) {
      updateUser(farmId, editing.id, { name, role, permissions }, self)
    } else {
      if (!password) { setError('Nome, senha e um telefone ou e-mail são obrigatórios'); return }
      if (password.length < 6) { setError('A senha deve ter pelo menos 6 caracteres'); return }
      if (!phone.replace(/\D/g, '') && !email.trim()) { setError('Informe o telefone ou o e-mail da pessoa'); return }
      createUser(farmId, { name, email, phone, password, role, permissions })
    }
    router.back()
  }

  function remove() {
    if (!editing) return
    Alert.alert(`Excluir o usuário ${editing.name}?`, 'Ele não vai mais conseguir entrar no sistema.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Excluir', style: 'destructive', onPress: () => { removeUser(farmId, editing.id); router.back() } },
    ])
  }

  if (!canManage || (editing && editing.role === 'admin')) {
    return <Screen><Notice tone="red" text={editing?.role === 'admin' ? 'Administradores não podem ser alterados por aqui.' : 'Você não tem permissão para gerenciar a equipe.'} /></Screen>
  }
  if (id !== 'novo' && !editing) return <Screen><Notice tone="red" text="Usuário não encontrado." /></Screen>

  return (
    <Screen>
      <Stack.Screen options={{ title: editing ? 'Editar Usuário' : 'Novo Usuário' }} />
      {editing ? <Muted style={{ marginBottom: space.md }}>{contactLabel(editing)}</Muted> : null}
      <Field label={editing ? 'Nome' : 'Nome *'} value={name} onChangeText={setName} autoCapitalize="words" />
      {!editing ? (
        <>
          <Field label="Telefone" value={phone} onChangeText={t => setPhone(maskPhone(t))} keyboardType="phone-pad" placeholder="(35) 99999-0000" />
          <Field label="E-mail (opcional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
            hint="A pessoa entra com o telefone ou com o e-mail. Informe pelo menos um." />
          <Field label="Senha *" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" />
        </>
      ) : null}
      <SelectField label="Perfil" value={role} options={TEAM_ROLES} onChange={v => { setRole(v ?? 'viewer'); setPermissions([]) }} />
      {self ? <Muted style={{ marginTop: -space.sm, marginBottom: space.md }}>Você não pode alterar seu próprio perfil.</Muted> : null}
      <CheckGroup label="Módulos permitidos" options={MODULE_OPTIONS} value={permissions} onChange={setPermissions} disabled={self} allowed={grantable}
        hint={self ? 'Você não pode alterar seus próprios módulos.' : undefined} />
      {!editing ? <Notice tone="blue" text="A conta só passa a existir quando o pedido for enviado ao servidor. Sem internet, ele fica na fila e a pessoa só consegue entrar depois do envio." /> : null}
      {error ? <Notice tone="red" text={error} /> : null}
      <Button label="Salvar" onPress={save} />
      {editing && !self ? <Button label="Excluir" variant="ghost" onPress={remove} style={{ marginTop: space.sm }} /> : null}
    </Screen>
  )
}
