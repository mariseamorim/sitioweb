// Lado do servidor da Cloud API do WhatsApp (Meta): configuração, assinatura do webhook e envio da resposta.
// Variáveis (só no servidor, nunca NEXT_PUBLIC_):
//   WHATSAPP_VERIFY_TOKEN  palavra que você escolhe e repete no painel da Meta ao cadastrar o webhook
//   WHATSAPP_APP_SECRET    "Chave secreta do aplicativo" (confere a assinatura de cada chamada)
//   WHATSAPP_TOKEN         token de acesso (temporário no teste; de usuário do sistema em produção)
//   WHATSAPP_PHONE_ID      "Identificação do número de telefone" do número que envia
//   WHATSAPP_TEST_NUMBERS  opcional: só estes telefones (com DDD, separados por vírgula) são atendidos
import { createHmac, timingSafeEqual } from 'node:crypto'
import { normalizePhone } from './identity'

const GRAPH = 'https://graph.facebook.com/v21.0'

export const whatsappConfig = () => ({
  verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ?? '',
  appSecret: process.env.WHATSAPP_APP_SECRET ?? '',
  token: process.env.WHATSAPP_TOKEN ?? '',
  phoneId: process.env.WHATSAPP_PHONE_ID ?? '',
  testNumbers: (process.env.WHATSAPP_TEST_NUMBERS ?? '').split(',').map((v) => normalizePhone(v)).filter((v): v is string => !!v),
})

export const whatsappEnabled = () => {
  const c = whatsappConfig()
  return !!(c.verifyToken && c.token && c.phoneId)
}

/** Confere X-Hub-Signature-256 = sha256=HMAC(chave secreta, corpo bruto). Sem chave configurada, não confere. */
export function validSignature(rawBody: string, header: string | null, appSecret = whatsappConfig().appSecret): boolean {
  if (!appSecret) return false
  if (!header?.startsWith('sha256=')) return false
  const expected = Buffer.from(createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex'), 'utf8')
  const received = Buffer.from(header.slice(7), 'utf8')
  return expected.length === received.length && timingSafeEqual(expected, received)
}

/** Durante os testes só os números da lista são atendidos; sem lista, todos */
export function allowedSender(waId: string, testNumbers = whatsappConfig().testNumbers): boolean {
  if (!testNumbers.length) return true
  const phone = normalizePhone(waId)
  return !!phone && testNumbers.some((t) => t === phone || t.replace(/^(\d\d)9/, '$1') === phone.replace(/^(\d\d)9/, '$1'))
}

/** Manda um texto para o wa_id (55 + DDD + número) */
export async function sendText(to: string, body: string): Promise<boolean> {
  const { token, phoneId } = whatsappConfig()
  if (!token || !phoneId) return false
  try {
    const res = await fetch(`${GRAPH}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'text', text: { preview_url: false, body } }),
    })
    if (!res.ok) console.error('[whatsapp] envio recusado', res.status, await res.text().catch(() => ''))
    return res.ok
  } catch (err) {
    console.error('[whatsapp] envio falhou', err)
    return false
  }
}

/** Marca a mensagem como lida (os dois tracinhos azuis) */
export async function markRead(messageId: string) {
  const { token, phoneId } = whatsappConfig()
  if (!token || !phoneId) return
  await fetch(`${GRAPH}/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', status: 'read', message_id: messageId }),
  }).catch(() => {})
}
