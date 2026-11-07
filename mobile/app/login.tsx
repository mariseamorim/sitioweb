import { useRouter } from 'expo-router'
import { useState } from 'react'
import { Image, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSession } from '@/auth/session'
import { Button, Field, Screen } from '@/ui'
import { colors, font, space } from '@/theme'

export default function Login() {
  const { login } = useSession()
  const router = useRouter()
  const [user, setUser] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function enter() {
    setError('')
    if (!user.trim() || !password) { setError('Informe o e-mail ou o telefone e a senha'); return }
    setLoading(true)
    try {
      await login(user.trim(), password)
      router.replace('/(tabs)')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.greenDark }}>
      <Screen style={{ backgroundColor: colors.greenDark, justifyContent: 'center' }}>
        <View style={{ alignItems: 'center', marginBottom: space.xl }}>
          <Image source={require('../assets/splash-icon.png')} style={{ width: 220, height: 64 }} resizeMode="contain" />
          <Text style={{ color: colors.cream, marginTop: space.sm, fontSize: font.md }}>Anote o dia a dia da sua propriedade</Text>
        </View>
        <View style={{ backgroundColor: colors.white, borderRadius: 16, padding: space.lg }}>
          <Field label="E-mail ou telefone" value={user} onChangeText={setUser} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" />
          <Field label="Senha" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" onSubmitEditing={enter} error={error} />
          <Button label="Entrar" onPress={enter} loading={loading} />
          <Text style={{ color: colors.muted, fontSize: font.sm, marginTop: space.md, textAlign: 'center' }}>
            Use a mesma conta do site www.anotaaiagro.com.br. Para criar uma conta ou entrar com Google, use o site.
          </Text>
        </View>
      </Screen>
    </SafeAreaView>
  )
}
