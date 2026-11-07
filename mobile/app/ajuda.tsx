// Ajuda e suporte (porte de src/app/ajuda/AjudaView.tsx do site, para quem está logado).
// O WhatsApp do suporte abre pela rota /api/suporte do servidor, que monta a mensagem e redireciona; o número não fica no app.
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { useState, type ReactNode } from 'react'
import { Alert, Linking, Pressable, Text, View } from 'react-native'
import { API_BASE } from '@/api/client'
import { useSession } from '@/auth/session'
import { visibleHelp, type HelpItem } from '@/lib/pageHelp'
import { useSyncState } from '@/sync'
import { Button, Card, Muted, Screen, Title } from '@/ui'
import { TextButton } from '@/ui/TextButton'
import { colors, font, radius, space } from '@/theme'

const CONTACT_EMAIL = 'anotaaiagro@gmail.com'
const OFFLINE = 'Sem internet não dá para abrir o WhatsApp. Tente quando tiver sinal.'

async function open(url: string) {
  try { await Linking.openURL(url) } catch { Alert.alert('Não foi possível abrir', url) }
}

/** Rota do servidor que abre o WhatsApp do suporte com a mensagem pronta */
const supportUrl = (kind: 'ajuda' | 'configurar') => `${API_BASE}/api/suporte?kind=${kind}${kind === 'ajuda' ? '&screen=Ajuda' : ''}`
const mailto = (subject: string) => `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}`

export default function Ajuda() {
  const { user, canAccess } = useSession()
  const { online } = useSyncState()
  const screens = visibleHelp(user, canAccess)

  return (
    <Screen>
      <Title sub="Dúvida, erro ou ajuda para começar: fale com a gente.">Ajuda e suporte</Title>

      <Card>
        <IconBox><Ionicons name="logo-whatsapp" size={22} color={colors.green} /></IconBox>
        <Text style={cardTitle}>Falar com o suporte</Text>
        <Text style={cardText}>Abre o WhatsApp com a mensagem pronta, já com o seu nome e a propriedade. Conte o que aconteceu e em qual tela.</Text>
        <Button label="Chamar no WhatsApp" onPress={() => void open(supportUrl('ajuda'))} disabled={!online || user?.support === false} style={{ marginTop: space.md }} />
        {!online ? <Muted style={{ marginTop: space.xs }}>{OFFLINE}</Muted> : null}
        <TextButton label="Enviar e-mail para o suporte" onPress={() => void open(mailto('Ajuda com o Anota Aí Agro'))} />
      </Card>

      <Card>
        <IconBox><Text style={{ fontSize: font.lg, fontWeight: '700', color: colors.green }}>1</Text></IconBox>
        <Text style={cardTitle}>Configuração inicial</Text>
        <Text style={cardText}>A gente configura com você: propriedade, animais, leite e quem vai usar. O resumo do seu cadastro vai junto na mensagem, para o atendimento já saber por onde começar.</Text>
        <Button label="Pedir configuração inicial" onPress={() => void open(supportUrl('configurar'))} disabled={!online || user?.support === false} style={{ marginTop: space.md }} />
        {!online ? <Muted style={{ marginTop: space.xs }}>{OFFLINE}</Muted> : null}
        <TextButton label="Pedir por e-mail" onPress={() => void open(mailto('Configuração inicial do Anota Aí Agro'))} />
      </Card>

      {user && screens.length > 0 ? (
        <Card>
          <Text style={cardTitle}>Como usar cada tela</Text>
          <Text style={[cardText, { marginBottom: space.md }]}>O mesmo passo a passo que aparece em “Como usar esta tela” dentro de cada módulo.</Text>
          {screens.map(item => <HelpRow key={item.title} item={item} />)}
        </Card>
      ) : null}

      <Muted>Também atendemos por e-mail: <Text style={{ color: colors.green, fontWeight: '600' }} onPress={() => void open(`mailto:${CONTACT_EMAIL}`)}>{CONTACT_EMAIL}</Text>.</Muted>
    </Screen>
  )
}

const cardTitle = { fontSize: font.lg, fontWeight: '700' as const, color: colors.text }
const cardText = { fontSize: font.sm, color: colors.muted, marginTop: 4, lineHeight: 20 }

function IconBox({ children }: { children: ReactNode }) {
  return <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center', marginBottom: space.md }}>{children}</View>
}

/** Item expansível da lista de telas, com o link "Abrir {título}" para a rota do app */
function HelpRow({ item }: { item: HelpItem }) {
  const router = useRouter()
  const [openRow, setOpenRow] = useState(false)
  return (
    <View style={{ borderRadius: radius.md, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.md, marginBottom: space.sm }}>
      <Pressable onPress={() => setOpenRow(v => !v)} accessibilityRole="button" style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: font.md, fontWeight: '600', color: colors.text, flex: 1 }}>{item.title}</Text>
        <Ionicons name={openRow ? 'chevron-up' : 'chevron-down'} size={18} color={colors.muted} />
      </Pressable>
      {openRow ? (
        <View style={{ paddingBottom: space.md }}>
          {item.steps.map((step, i) => (
            <View key={step} style={{ flexDirection: 'row', gap: space.sm, marginBottom: space.sm }}>
              <Text style={{ fontSize: font.sm, color: colors.muted, width: 18 }}>{i + 1}.</Text>
              <Text style={{ fontSize: font.sm, color: colors.text, lineHeight: 20, flex: 1 }}>{step}</Text>
            </View>
          ))}
          {item.href ? <TextButton label={`Abrir ${item.title}`} onPress={() => router.push(item.href as never)} /> : null}
        </View>
      ) : null}
    </View>
  )
}
