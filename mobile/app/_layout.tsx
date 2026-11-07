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
        </Stack>
      </SessionProvider>
    </SafeAreaProvider>
  )
}
