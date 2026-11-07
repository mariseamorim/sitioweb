// Contas e senhas: o administrador vê todas as contas, corrige nome, telefone e e-mail e define uma senha nova
// para quem esqueceu a sua (porte de src/app/admin/usuarios/page.tsx). A lista é a cópia local de /api/admin/usuarios.
import { useMemo, useState } from 'react'
import { Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { api, NetworkError } from '@/api/client'
import { useFarmId } from '@/auth/session'
import { useLive } from '@/db/events'
import { brDate } from '@/lib/format'
import { contactLabel, maskPhone } from '@/lib/masks'
import { ROLE_LABELS, roleLabel } from '@/lib/roles'
import { CACHE, normalize, patchCache, plural, readCache, suggestPassword, type Account } from '@/repos/admin'
import { useSyncState } from '@/sync'
import { queueRequest } from '@/sync/local'
import { AdminOnly } from '@/ui/AdminOnly'
import { TextButton } from '@/ui/TextButton'
import { Badge, Button, Card, Chips, Empty, Field, Muted, Notice, Screen, Search, styles, Title } from '@/ui'
import { colors, font, space } from '@/theme'

const ROLE_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'muted'> = {
  admin: 'blue', editor: 'blue', viewer: 'muted', fornecedor: 'amber', laticinio: 'blue', associacao: 'green', lite: 'green', motorista: 'green', onboarding: 'red',
}

export default function AdminContas() {
  return <AdminOnly><Contas /></AdminOnly>
}

function Contas() {
  const accounts = useLive(() => readCache<Account>(CACHE.accounts), [])
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [editing, setEditing] = useState<Account | null>(null)
  const [done, setDone] = useState<{ name: string; password: string } | null>(null)

  const roles = useMemo(() => Object.keys(ROLE_LABELS).filter(r => accounts.some(a => a.role === r)), [accounts])
  const visible = useMemo(() => {
    const q = normalize(query.trim())
    const digits = query.replace(/\D/g, '')
    return accounts.filter(a => {
      if (role && a.role !== role) return false
      if (!q) return true
      return normalize(a.name).includes(q) || (a.email ?? '').toLowerCase().includes(q) || (!!digits && (a.phone ?? '').includes(digits)) || normalize(a.place ?? '').includes(q)
    })
  }, [accounts, query, role])

  return (
    <Screen>
      <Title sub="Todas as contas do sistema. Corrija nome, telefone e e-mail ou defina uma senha nova para quem esqueceu a sua.">Contas e senhas</Title>
      {done ? (
        <View style={[styles.notice, { backgroundColor: colors.greenSoft }]}>
          <Text style={{ color: colors.greenDark, fontWeight: '700' }}>Senha de {done.name} redefinida.</Text>
          <Text style={{ color: colors.greenDark, fontSize: font.sm, marginTop: 4 }}>
            Nova senha: <Text selectable style={{ fontWeight: '700', fontSize: font.md, fontFamily: 'monospace' }}>{done.password}</Text>. Envie para a pessoa; ela pode trocar depois em Meu cadastro. A senha não fica visível de novo.
          </Text>
          <TextButton label="Entendi" onPress={() => setDone(null)} />
        </View>
      ) : null}
      <Search value={query} onChange={setQuery} placeholder="Buscar por nome, telefone, e-mail, propriedade ou empresa" />
      {roles.length > 1 ? <Chips options={[{ value: '', label: 'Todos os perfis' }, ...roles.map(r => ({ value: r, label: roleLabel(r) }))]} value={role} onChange={setRole} /> : null}
      {accounts.length === 0 ? (
        <Empty title="Nenhuma conta guardada neste aparelho" text="Sincronize com internet para baixar a lista de contas." />
      ) : visible.length === 0 ? (
        <Empty title="Nenhuma conta encontrada." />
      ) : (
        <>
          <Muted style={{ marginBottom: space.sm }}>{plural(visible.length, 'conta', 'contas')}</Muted>
          {visible.map(a => (
            <Card key={a.id}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: font.md, fontWeight: '600', color: colors.text }}>{a.name}</Text>
                <Badge label={roleLabel(a.role)} tone={ROLE_TONE[a.role] ?? 'muted'} />
                {a.googleConnected ? <Badge label="Entra com Google" /> : null}
                {!a.hasPassword ? <Badge label="Sem senha" tone="amber" /> : null}
              </View>
              <Muted>{[a.phone ? maskPhone(a.phone) : null, a.email].filter(Boolean).join(' · ') || contactLabel(a) || 'Sem telefone nem e-mail'}</Muted>
              <Muted>{a.place ? `${a.place} · ` : ''}conta criada em {brDate(a.createdAt)}</Muted>
              <Button label="Editar e senha" variant="secondary" onPress={() => setEditing(a)} style={{ marginTop: space.md, minHeight: 44 }} />
            </Card>
          ))}
        </>
      )}
      {editing ? <EditAccount account={editing} onClose={() => setEditing(null)} onPassword={setDone} /> : null}
    </Screen>
  )
}

/** Formulário "Editar conta": manda só os campos alterados. Online grava na hora; offline entra na fila (sem senha). */
function EditAccount({ account, onClose, onPassword }: { account: Account; onClose: () => void; onPassword: (d: { name: string; password: string }) => void }) {
  const farmId = useFarmId()
  const { online } = useSyncState()
  const [name, setName] = useState(account.name)
  const [phone, setPhone] = useState(account.phone ? maskPhone(account.phone) : '')
  const [email, setEmail] = useState(account.email ?? '')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setError('')
    const body: Record<string, string> = {}
    if (name.trim() !== account.name) body.name = name.trim()
    const digits = phone.replace(/\D/g, '')
    if (digits !== (account.phone ?? '')) body.phone = digits
    if (email.trim().toLowerCase() !== (account.email ?? '')) body.email = email.trim()
    if (password) body.password = password
    if (!body.name && body.name !== undefined) { setError('Informe o nome'); return }
    if (!Object.keys(body).length) { setError('Nada foi alterado'); return }
    if (password && password.length < 6) { setError('A nova senha deve ter pelo menos 6 caracteres'); return }

    const localPatch: Partial<Account> = {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.phone !== undefined ? { phone: body.phone || null } : {}),
      ...(body.email !== undefined ? { email: body.email.toLowerCase() || null } : {}),
    }
    if (!online) {
      if (password) { setError('Sem internet. A troca de senha precisa de conexão; os outros dados podem ser salvos agora e enviados depois.'); return }
      queueRequest({ farmId, module: 'admin', method: 'PATCH', path: `/api/admin/usuarios/${account.id}`, body })
      patchCache<Account>(CACHE.accounts, account.id, localPatch)
      onClose()
      return
    }
    setSaving(true)
    try {
      const data = await api<Account & { passwordChanged?: boolean }>(`/api/admin/usuarios/${account.id}`, { method: 'PATCH', body })
      patchCache<Account>(CACHE.accounts, account.id, { ...localPatch, ...data, ...(data.passwordChanged ? { hasPassword: true } : {}) })
      if (password) onPassword({ name: data.name ?? name.trim(), password })
      onClose()
    } catch (e) {
      setError(e instanceof NetworkError ? 'Sem internet. Esta ação precisa de conexão; tente de novo quando o sinal voltar.' : e instanceof Error ? e.message : 'Verifique sua conexão e tente novamente')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.modal}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Editar conta</Text>
          <Pressable onPress={onClose} hitSlop={12} disabled={saving}><Text style={styles.link}>Fechar</Text></Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: space.lg, paddingTop: 0 }}>
          <Muted style={{ marginBottom: space.md }}>{roleLabel(account.role)}{account.place ? ` · ${account.place}` : ''}</Muted>
          <Field label="Nome *" value={name} onChangeText={setName} editable={!saving} />
          <Field label="Telefone" value={phone} onChangeText={t => setPhone(maskPhone(t))} keyboardType="phone-pad" placeholder="(35) 99999-0000" editable={!saving} />
          <Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" editable={!saving}
            hint="A pessoa entra com o telefone ou com o e-mail. Pelo menos um precisa ficar." />
          <View style={{ backgroundColor: colors.amberSoft, borderRadius: 12, padding: space.md, marginBottom: space.md }}>
            <Field label="Nova senha (deixe vazio para manter a atual)" value={password} onChangeText={setPassword} secureTextEntry={!showPassword} autoCapitalize="none" autoCorrect={false} editable={!saving} style={{ marginBottom: 0 }} />
            <View style={{ flexDirection: 'row', gap: space.md }}>
              <TextButton label="Gerar senha" onPress={() => { setPassword(suggestPassword()); setShowPassword(true) }} />
              <TextButton label={showPassword ? 'Ocultar' : 'Mostrar'} tone="muted" onPress={() => setShowPassword(v => !v)} />
            </View>
            <Muted>Mínimo de 6 caracteres. A pessoa entra com esta senha e pode trocar depois em Meu cadastro.</Muted>
            {!online ? <Notice tone="amber" text="Sem internet: a troca de senha só funciona com conexão." /> : null}
          </View>
          {error ? <Notice tone="red" text={error} /> : null}
          <Button label="Salvar" onPress={() => void save()} loading={saving} />
          <Button label="Cancelar" variant="ghost" onPress={onClose} disabled={saving} style={{ marginTop: space.sm }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  )
}
