// Sessão guardada no aparelho (SecureStore), lida sem React: serve à tela (auth/session.tsx) e ao envio em
// segundo plano (sync/background.ts), que roda sem nenhuma tela montada.
import * as SecureStore from 'expo-secure-store'

export const KEY_TOKEN = 'anotaai_token'
export const KEY_USER = 'anotaai_user'

/** Token e propriedade aberta de quem está logado; null se ninguém entrou ou não há propriedade escolhida. */
export async function readStoredSession(): Promise<{ token: string; farmId: string } | null> {
  const token = await SecureStore.getItemAsync(KEY_TOKEN)
  const raw = await SecureStore.getItemAsync(KEY_USER)
  if (!token || !raw) return null
  try {
    const farmId = (JSON.parse(raw) as { farmId?: string | null }).farmId
    return farmId ? { token, farmId } : null
  } catch {
    return null
  }
}
