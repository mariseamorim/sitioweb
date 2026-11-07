import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Text } from 'react-native'
import { api, HttpError } from '@/api/client'
import { useFarmId, useSession } from '@/auth/session'
import { getCache, setCache } from '@/db'
import { useLive } from '@/db/events'
import { maskPhone, phoneDigits } from '@/lib/masks'
import { queueRequest } from '@/sync/local'
import { useSyncState } from '@/sync'
import { Button, Card, Field, Muted, Notice, Screen } from '@/ui'
import { colors, font, space } from '@/theme'

/** Resposta de /api/perfil, guardada pela sincronização em getCache('perfil') */
interface Profile {
  name: string
  email: string | null
  phone: string | null
  role: string
  hasPassword: boolean
  googleConnected: boolean
  vendor: Record<string, string | null> | null
  milkPoints: { id: string; name: string; kind: string }[]
}

// Meu cadastro: porte de src/components/ProfileForm.tsx do site (sem a parte do Google e das empresas fornecedoras).
export default function Perfil() {
  const farmId = useFarmId()
  const { user, refresh, logout } = useSession()
  const sync = useSyncState()
  const router = useRouter()
  const cached = useLive(() => getCache<Profile>('perfil'), [])
  const profile: Profile = cached ?? {
    name: user?.name ?? '', email: user?.email ?? null, phone: user?.phone ?? null, role: user?.role ?? '',
    hasPassword: true, googleConnected: false, vendor: null, milkPoints: [],
  }

  const [name, setName] = useState(profile.name)
  const [phone, setPhone] = useState(phoneDigits(profile.phone))
  const [email, setEmail] = useState(profile.email ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  async function save() {
    setError(''); setSuccess('')
    if (!name.trim()) { setError('Informe o nome'); return }
    if (!phone && !email.trim()) { setError('Informe o telefone ou o e-mail'); return }
    if (password !== confirmation) { setError('As senhas não coincidem'); return }
    if (password && password.length < 6) { setError('A nova senha deve ter pelo menos 6 caracteres'); return }
    const contact = { name: name.trim(), email: email.trim() || null, phone: phone || null }
    const updated: Profile = { ...profile, ...contact, hasPassword: profile.hasPassword || !!password }

    if (!sync.online) {
      // Sem internet só nome e contato entram na fila; a senha precisa ser conferida pelo servidor na hora
      if (password) { setError('Para trocar a senha é preciso internet. Tente de novo quando o sinal voltar.'); return }
      queueRequest({ farmId, module: 'perfil', method: 'PATCH', path: '/api/perfil', body: { ...contact, ...(currentPassword ? { currentPassword } : {}) } })
      setCache('perfil', updated)
      setCurrentPassword('')
      setSuccess('Sem internet: as alterações ficaram na fila e serão enviadas quando o sinal voltar.')
      return
    }

    setSaving(true)
    try {
      await api('/api/perfil', { method: 'PATCH', body: { ...contact, ...(password ? { password } : {}), ...(currentPassword ? { currentPassword } : {}) } })
      setCache('perfil', updated)
      await refresh()
      setPassword(''); setConfirmation(''); setCurrentPassword('')
      setSuccess('Cadastro atualizado com sucesso.')
    } catch (e) {
      setError(e instanceof HttpError ? e.message : 'Sem internet. Esta ação precisa de conexão; tente de novo quando o sinal voltar.')
    } finally {
      setSaving(false)
    }
  }

  function wipeAndLogout() {
    const aviso = sync.pending > 0 ? `Há ${sync.pending} registro(s) ainda não enviados ao servidor. Se sair agora, eles serão perdidos. ` : ''
    Alert.alert('Sair e apagar os dados deste aparelho?', aviso + 'Apaga as anotações guardadas e o que ainda não foi enviado. Só faça isso com internet e com tudo enviado.', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair e apagar', style: 'destructive', onPress: async () => { await logout(); router.replace('/login') } },
    ])
  }

  const section = (title: string) => <Text style={{ fontWeight: '700', fontSize: font.md, color: colors.text, marginBottom: space.sm }}>{title}</Text>

  return (
    <Screen>
      {!sync.online ? <Notice text="Sinal fraco ou sem internet: mostrando a última cópia guardada neste aparelho. Nome e contato podem ser alterados; a senha só com conexão." /> : null}
      <Card>
        {section('Dados da conta')}
        <Field label="Nome *" value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" />
        <Field label="Telefone" value={maskPhone(phone)} onChangeText={t => setPhone(phoneDigits(t))} keyboardType="phone-pad" placeholder="(35) 99999-0000" textContentType="telephoneNumber" />
        <Field label="E-mail (opcional)" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress"
          hint="Você entra com o telefone ou com o e-mail. Informe pelo menos um." />
      </Card>
      <Card>
        {section('Segurança')}
        <Muted style={{ marginBottom: space.md }}>
          {profile.hasPassword
            ? 'Para alterar o e-mail ou a senha, informe sua senha atual. Deixe a nova senha vazia para manter a atual.'
            : 'Você usa o Google para entrar. Pode criar uma senha para também entrar com e-mail e senha.'}
        </Muted>
        {profile.hasPassword ? <Field label="Senha atual" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry textContentType="password" /> : null}
        <Field label="Nova senha" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" hint="Pelo menos 6 caracteres" />
        <Field label="Confirmar nova senha" value={confirmation} onChangeText={setConfirmation} secureTextEntry textContentType="newPassword" />
        {profile.googleConnected ? <Muted style={{ color: colors.green, marginBottom: space.md }}>Conta Google conectada.</Muted> : null}
        {error ? <Notice tone="red" text={error} /> : null}
        {success ? <Notice tone={success.startsWith('Sem internet') ? 'amber' : 'green'} text={success} /> : null}
        <Button label="Salvar alterações" onPress={() => void save()} loading={saving} />
      </Card>
      <Card>
        {section('Este aparelho')}
        <Muted style={{ marginBottom: space.md }}>
          O que você anota fica guardado no aparelho até o sinal voltar. “Sair da conta” no menu Mais também apaga tudo. Num aparelho emprestado, saia por aqui.
        </Muted>
        <Button label="Sair e apagar os dados deste aparelho" variant="danger" onPress={wipeAndLogout} />
      </Card>
    </Screen>
  )
}
