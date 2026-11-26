import { Ionicons } from '@expo/vector-icons'
import { Redirect, Tabs } from 'expo-router'
import { useEffect } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useSession } from '@/auth/session'
import { startAutoSync } from '@/sync'
import { enableBackgroundSync } from '@/sync/background'
import { colors } from '@/theme'
import { useT } from '@/lib/i18n'

export default function TabsLayout() {
  const { user, canAccess } = useSession()
  const farmId = user?.farmId ?? null
  const insets = useSafeAreaInsets()
  const t = useT()

  // Sincronização automática enquanto há uma propriedade aberta
  useEffect(() => {
    if (!farmId) return
    void enableBackgroundSync()
    return startAutoSync(farmId, canAccess)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [farmId])

  // Espaço entre a barra de abas e os botões de navegação do Android (recuo do sistema + uma folga)
  const tabGap = insets.bottom + 12

  if (!user) return <Redirect href="/login" />
  // Veterinário ainda sem propriedade: o painel de consultoria mostra o código para o produtor liberar
  if (!farmId) return <Redirect href={user.vet ? '/consultoria' : '/propriedade'} />

  const icon = (name: keyof typeof Ionicons.glyphMap) => ({ color, size }: { color?: unknown; size: number }) => <Ionicons name={name} color={color as string} size={size} />
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: colors.green }, headerTintColor: colors.white, headerTitleStyle: { fontWeight: '700' },
      tabBarActiveTintColor: colors.green, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontSize: 12, fontWeight: '600' }, tabBarStyle: { height: 62 + tabGap, paddingBottom: tabGap, paddingTop: 6 }, tabBarItemStyle: { paddingVertical: 4 },
    }}>
      <Tabs.Screen name="index" options={{ title: t('Painel'), tabBarIcon: icon('grid-outline') }} />
      <Tabs.Screen name="leite" options={{ title: t('Leite'), tabBarIcon: icon('water-outline'), href: canAccess('leite') && !user.vet ? undefined : null }} />
      <Tabs.Screen name="animais" options={{ title: t('Animais'), tabBarIcon: icon('paw-outline'), href: canAccess('animais') ? undefined : null }} />
      {/* Veterinário: Agenda no lugar de Vacinas (a vacinação continua em Mais) */}
      <Tabs.Screen name="vacinas" options={{ title: t('Vacinas'), tabBarIcon: icon('medkit-outline'), href: canAccess('vacinacao') && !user.vet ? undefined : null }} />
      <Tabs.Screen name="minha-agenda" options={{ title: t('Agenda'), tabBarIcon: icon('calendar-outline'), href: user.vet ? undefined : null }} />
      <Tabs.Screen name="mais" options={{ title: t('Mais'), tabBarIcon: icon('menu-outline') }} />
    </Tabs>
  )
}
