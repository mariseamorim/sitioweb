import { Redirect } from 'expo-router'
import { ActivityIndicator, View } from 'react-native'
import { useSession } from '@/auth/session'
import { colors } from '@/theme'

// Porta de entrada: com sessão guardada vai para as abas; sem sessão, para o login.
export default function Index() {
  const { user, loading } = useSession()
  if (loading) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.greenDark }}><ActivityIndicator color={colors.white} /></View>
  return <Redirect href={user ? '/(tabs)' : '/login'} />
}
