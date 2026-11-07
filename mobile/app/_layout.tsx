import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { SessionProvider } from '@/auth/session'
import { initDb } from '@/db'
import { colors } from '@/theme'

initDb()

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerStyle: { backgroundColor: colors.green }, headerTintColor: colors.white, headerTitleStyle: { fontWeight: '700' }, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="leite/[id]" options={{ title: 'Leite' }} />
          <Stack.Screen name="animais/[id]" options={{ title: 'Animal' }} />
          <Stack.Screen name="vacinas/[id]" options={{ title: 'Vacina' }} />
          <Stack.Screen name="tratamentos/index" options={{ title: 'Tratamentos' }} />
          <Stack.Screen name="tratamentos/[id]" options={{ title: 'Tratamento' }} />
          <Stack.Screen name="financeiro/index" options={{ title: 'Financeiro' }} />
          <Stack.Screen name="financeiro/novo" options={{ title: 'Anotar entrada ou saída' }} />
          <Stack.Screen name="estoque/index" options={{ title: 'Estoque' }} />
          <Stack.Screen name="estoque/[id]" options={{ title: 'Produto' }} />
          <Stack.Screen name="sincronizacao" options={{ title: 'Sincronização' }} />
          <Stack.Screen name="propriedade" options={{ title: 'Propriedade' }} />
          <Stack.Screen name="fazendas/index" options={{ title: 'Propriedades' }} />
          <Stack.Screen name="fazendas/[id]" options={{ title: 'Propriedade' }} />
          <Stack.Screen name="engorda/index" options={{ title: 'Recria e engorda' }} />
          <Stack.Screen name="engorda/novo" options={{ title: 'Novo lote' }} />
          <Stack.Screen name="engorda/[id]" options={{ title: 'Lote' }} />
          <Stack.Screen name="recria/[id]" options={{ title: 'Recria' }} />
          <Stack.Screen name="reproducao/index" options={{ title: 'Reprodução' }} />
          <Stack.Screen name="reproducao/[id]" options={{ title: 'Reprodução' }} />
          <Stack.Screen name="relatorios/index" options={{ title: 'Relatórios' }} />
          <Stack.Screen name="usuarios/index" options={{ title: 'Usuários' }} />
          <Stack.Screen name="usuarios/[id]" options={{ title: 'Usuário' }} />
          <Stack.Screen name="perfil" options={{ title: 'Meu cadastro' }} />
          <Stack.Screen name="ofertas/index" options={{ title: 'Ofertas' }} />
          <Stack.Screen name="admin/contas" options={{ title: 'Contas e senhas' }} />
          <Stack.Screen name="admin/fornecedores" options={{ title: 'Fornecedores' }} />
          <Stack.Screen name="admin/organizacoes" options={{ title: 'Laticínios e associações' }} />
          <Stack.Screen name="ajuda" options={{ title: 'Ajuda e suporte' }} />
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  )
}
