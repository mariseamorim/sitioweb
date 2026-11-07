// Telas da administração da plataforma: só o administrador entra; os outros veem o aviso do site.
import { Ionicons } from '@expo/vector-icons'
import type { ReactNode } from 'react'
import { Text, View } from 'react-native'
import { useSession } from '@/auth/session'
import { colors, font, space } from '@/theme'

export function AdminOnly({ children }: { children: ReactNode }) {
  const { user } = useSession()
  if (user?.role === 'admin') return <>{children}</>
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, backgroundColor: colors.bg }}>
      <Ionicons name="lock-closed-outline" size={48} color={colors.border} style={{ marginBottom: space.lg }} />
      <Text style={{ fontSize: font.md, color: colors.muted }}>Área do administrador.</Text>
    </View>
  )
}
