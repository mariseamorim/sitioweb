// Abrir uma conversa no WhatsApp (precisa de internet; a mensagem já vai pronta).
import { Alert, Linking } from 'react-native'

/** Só dígitos; número brasileiro sem o DDI (até 11 dígitos) ganha o 55. */
export function whatsappLink(phone: string, text: string): string {
  let digits = phone.replace(/\D/g, '')
  if (digits.length <= 11) digits = '55' + digits
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

export async function openWhatsApp(phone: string, text: string) {
  try {
    await Linking.openURL(whatsappLink(phone, text))
  } catch {
    Alert.alert('WhatsApp', 'Não foi possível abrir o WhatsApp neste aparelho.')
  }
}
