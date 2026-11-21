import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { api, HttpError } from '@/api/client'
import { useFarmId, useSession } from '@/auth/session'
import { getCache, setCache } from '@/db'
import { useLive } from '@/db/events'
import { maskPhone, phoneDigits } from '@/lib/masks'
import { queueRequest } from '@/sync/local'
import { useSyncState } from '@/sync'
import { Badge, Button, Card, Field, IconCircle, Muted, Notice, Screen, type Tone } from '@/ui'
import { colors, font, space } from '@/theme'
import { useT } from '@/lib/i18n'
import { LanguagePicker } from '@/ui/LanguagePicker'

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
  const t = useT()
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
    if (!name.trim()) { setError(t('Informe o nome')); return }
    if (!phone && !email.trim()) { setError(t('Informe o telefone ou o e-mail')); return }
    if (password !== confirmation) { setError(t('As senhas não coincidem')); return }
    if (password && password.length < 6) { setError(t('A nova senha deve ter pelo menos 6 caracteres')); return }
    const contact = { name: name.trim(), email: email.trim() || null, phone: phone || null }
    const updated: Profile = { ...profile, ...contact, hasPassword: profile.hasPassword || !!password }

    if (!sync.online) {
      // Sem internet só nome e contato entram na fila; a senha precisa ser conferida pelo servidor na hora
      if (password) { setError(t('Para trocar a senha é preciso internet. Tente de novo quando o sinal voltar.')); return }
      queueRequest({ farmId, module: 'perfil', method: 'PATCH', path: '/api/perfil', body: { ...contact, ...(currentPassword ? { currentPassword } : {}) } })
      setCache('perfil', updated)
      setCurrentPassword('')
      setSuccess(t('Sem internet: as alterações ficaram na fila e serão enviadas quando o sinal voltar.'))
      return
    }

    setSaving(true)
    try {
      await api('/api/perfil', { method: 'PATCH', body: { ...contact, ...(password ? { password } : {}), ...(currentPassword ? { currentPassword } : {}) } })
      setCache('perfil', updated)
      await refresh()
      setPassword(''); setConfirmation(''); setCurrentPassword('')
      setSuccess(t('Cadastro atualizado com sucesso.'))
    } catch (e) {
      setError(e instanceof HttpError ? t(e.message) : t('Sem internet. Esta ação precisa de conexão; tente de novo quando o sinal voltar.'))
    } finally {
      setSaving(false)
    }
  }

  function wipeAndLogout() {
    const aviso = sync.pending > 0 ? t('Há {n} registro(s) ainda não enviados ao servidor. Se sair agora, eles serão perdidos.', { n: sync.pending }) + ' ' : ''
    Alert.alert(t('Sair e apagar os dados deste aparelho?'), aviso + t('Apaga as anotações guardadas e o que ainda não foi enviado. Só faça isso com internet e com tudo enviado.'), [
      { text: t('Cancelar'), style: 'cancel' },
      { text: t('Sair e apagar'), style: 'destructive', onPress: async () => { await logout(); router.replace('/login') } },
    ])
  }

  // Título de cada cartão com ícone colorido num círculo (novo visual)
  const section = (title: string, icon: keyof typeof Ionicons.glyphMap, tone: Tone) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md }}>
      <IconCircle icon={icon} tone={tone} size={36} />
      <Text style={{ flex: 1, fontWeight: '700', fontSize: font.md, color: colors.text }}>{t(title)}</Text>
    </View>
  )

  return (
    <Screen>
      {!sync.online ? <Notice text={t('Sinal fraco ou sem internet: mostrando a última cópia guardada neste aparelho. Nome e contato podem ser alterados; a senha só com conexão.')} /> : null}
      {/* Cabeçalho: nome, contato e a situação do cadastro em selos */}
      <Card style={{ backgroundColor: colors.greenSoft, borderColor: colors.green }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <IconCircle icon="person" tone="green" size={48} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontWeight: '800', fontSize: font.lg, color: colors.greenDark }}>{profile.name || user?.name}</Text>
            {profile.phone || profile.email ? <Muted>{[profile.phone ? maskPhone(phoneDigits(profile.phone)) : '', profile.email ?? ''].filter(Boolean).join(' · ')}</Muted> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xs }}>
              {profile.hasPassword ? <Badge label="Com senha" tone="green" /> : null}
              {profile.googleConnected ? <Badge label="Conta Google conectada." tone="blue" /> : null}
              {sync.pending ? <Badge label={t('{n} para enviar', { n: sync.pending })} tone="amber" /> : null}
            </View>
          </View>
        </View>
      </Card>
      <Card>
        {section('Dados da conta', 'person-outline', 'green')}
        <Field label={t('Nome *')} value={name} onChangeText={setName} autoCapitalize="words" textContentType="name" />
        <Field label={t('Telefone')} value={maskPhone(phone)} onChangeText={v => setPhone(phoneDigits(v))} keyboardType="phone-pad" placeholder="(35) 99999-0000" textContentType="telephoneNumber" />
        <Field label={t('E-mail (opcional)')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress"
          hint={t('Você entra com o telefone ou com o e-mail. Informe pelo menos um.')} />
      </Card>
      <Card>
        {section('Segurança', 'lock-closed-outline', 'blue')}
        <Muted style={{ marginBottom: space.md }}>
          {profile.hasPassword
            ? t('Para alterar o e-mail ou a senha, informe sua senha atual. Deixe a nova senha vazia para manter a atual.')
            : t('Você usa o Google para entrar. Pode criar uma senha para também entrar com e-mail e senha.')}
        </Muted>
        {profile.hasPassword ? <Field label={t('Senha atual')} value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry textContentType="password" /> : null}
        <Field label={t('Nova senha')} value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" hint={t('Pelo menos 6 caracteres')} />
        <Field label={t('Confirmar nova senha')} value={confirmation} onChangeText={setConfirmation} secureTextEntry textContentType="newPassword" />
        {profile.googleConnected ? <Muted style={{ color: colors.green, marginBottom: space.md }}>{t('Conta Google conectada.')}</Muted> : null}
        {error ? <Notice tone="red" text={error} /> : null}
        {success ? <Notice tone={!sync.online ? 'amber' : 'green'} text={success} /> : null}
        <Button label={t('Salvar alterações')} onPress={() => void save()} loading={saving} />
      </Card>
      <Card>
        {section('Este aparelho', 'phone-portrait-outline', 'red')}
        <Muted style={{ marginBottom: space.md }}>
          {t('O que você anota fica guardado no aparelho até o sinal voltar. “Sair da conta” no menu Mais também apaga tudo. Num aparelho emprestado, saia por aqui.')}
        </Muted>
        <Button label={t('Sair e apagar os dados deste aparelho')} variant="danger" onPress={wipeAndLogout} />
      </Card>
      <Card>
        {section('Idioma', 'language-outline', 'purple')}
        <LanguagePicker />
      </Card>
    </Screen>
  )
}
