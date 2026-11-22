// Primeiro de tudo: guarda o erro grave que acontecer na abertura (ver src/lib/crashLog.ts)
import { saveCrash, describeError } from '@/lib/crashLog'
import { Stack, type ErrorBoundaryProps } from 'expo-router'
import { ScrollView, Text, Pressable } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SessionProvider } from '@/auth/session'
import { initDb } from '@/db'
// Define a tarefa de envio em segundo plano na carga do JavaScript (em segundo plano nenhuma tela é montada)
import '@/sync/background'
import { colors } from '@/theme'
import { useT } from '@/lib/i18n'

initDb()

/** Erro em qualquer tela: mostra a mensagem (em vez de fechar ou ficar parado) e deixa tentar de novo. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  saveCrash(error)
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Algo deu errado / Algo salió mal</Text>
      <Text style={{ marginTop: 12, color: colors.muted }}>Tire um print desta tela e mande para o suporte.</Text>
      <Text selectable style={{ marginTop: 16, fontFamily: 'monospace', fontSize: 12, color: colors.text }}>{describeError(error)}</Text>
      <Pressable onPress={retry} style={{ marginTop: 24, backgroundColor: colors.green, borderRadius: 10, padding: 14, alignItems: 'center' }}>
        <Text style={{ color: colors.white, fontWeight: '700' }}>Tentar de novo</Text>
      </Pressable>
    </ScrollView>
  )
}

export default function RootLayout() {
  const t = useT()
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: colors.green }, headerTintColor: colors.white, headerTitleStyle: { fontWeight: '700' }, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="leite/[id]" options={{ title: t('Leite') }} />
          <Stack.Screen name="animais/[id]" options={{ title: t('Animal') }} />
          <Stack.Screen name="vacinas/[id]" options={{ title: t('Vacina') }} />
          <Stack.Screen name="tratamentos/index" options={{ title: t('Tratamentos') }} />
          <Stack.Screen name="tratamentos/[id]" options={{ title: t('Tratamento') }} />
          <Stack.Screen name="financeiro/index" options={{ title: t('Financeiro') }} />
          <Stack.Screen name="financeiro/novo" options={{ title: t('Anotar entrada ou saída') }} />
          <Stack.Screen name="estoque/index" options={{ title: t('Estoque') }} />
          <Stack.Screen name="estoque/[id]" options={{ title: t('Produto') }} />
          <Stack.Screen name="sincronizacao" options={{ title: t('Sincronização') }} />
          <Stack.Screen name="propriedade" options={{ title: t('Propriedade') }} />
          <Stack.Screen name="fazendas/index" options={{ title: t('Propriedades') }} />
          <Stack.Screen name="fazendas/[id]" options={{ title: t('Propriedade') }} />
          <Stack.Screen name="engorda/index" options={{ title: t('Recria e engorda') }} />
          <Stack.Screen name="engorda/novo" options={{ title: t('Novo lote') }} />
          <Stack.Screen name="engorda/[id]" options={{ title: t('Lote') }} />
          <Stack.Screen name="engorda/planos" options={{ title: t('Planos') }} />
          <Stack.Screen name="recria/[id]" options={{ title: t('Recria') }} />
          <Stack.Screen name="reproducao/index" options={{ title: t('Reprodução') }} />
          <Stack.Screen name="reproducao/[id]" options={{ title: t('Reprodução') }} />
          <Stack.Screen name="reproducao/diagnostico" options={{ title: t('Diagnóstico em lote') }} />
          <Stack.Screen name="reproducao/indicadores" options={{ title: t('Indicadores de reprodução') }} />
          <Stack.Screen name="consultoria" options={{ title: t('Consultoria') }} />
          <Stack.Screen name="relatorios/index" options={{ title: t('Relatórios') }} />
          <Stack.Screen name="usuarios/index" options={{ title: t('Usuários') }} />
          <Stack.Screen name="usuarios/[id]" options={{ title: t('Usuário') }} />
          <Stack.Screen name="perfil" options={{ title: t('Meu cadastro') }} />
          <Stack.Screen name="ofertas/index" options={{ title: t('Ofertas') }} />
          <Stack.Screen name="admin/contas" options={{ title: t('Contas e senhas') }} />
          <Stack.Screen name="admin/fornecedores" options={{ title: t('Fornecedores') }} />
          <Stack.Screen name="admin/organizacoes" options={{ title: t('Laticínios e associações') }} />
          <Stack.Screen name="ajuda" options={{ title: t('Ajuda e suporte') }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  )
}
