import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export const runtime = 'nodejs'
const recipient = 'anotaaiagro@gmail.com'
// Limite por processo: protege a caixa de entrada mesmo com cabeçalhos de IP falsos.
let windowStart = 0
let attempts = 0
const failure = (error: string, status: number) => NextResponse.json({ error }, { status })

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin || origin !== new URL(request.url).origin) return failure('Solicitação inválida.', 403)
  if (!request.headers.get('content-type')?.includes('application/json')) return failure('Solicitação inválida.', 415)
  if (Number(request.headers.get('content-length')) > 20000) return failure('Mensagem muito longa.', 413)
  let data: Record<string, unknown>
  try {
    const text = await request.text()
    if (text.length > 10000) return failure('Mensagem muito longa.', 413)
    const parsed = JSON.parse(text)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return failure('Revise os campos do formulário.', 400)
    data = parsed
  } catch { return failure('Revise os campos do formulário.', 400) }
  if (data.website) return failure('Não foi possível enviar esta solicitação.', 400)
  const field = (key: string) => typeof data[key] === 'string' ? (data[key] as string).trim() : ''
  const name = field('name'), email = field('email'), phone = field('phone'), farm = field('farm'), message = field('message'), purpose = field('purpose')
  if (!name || name.length > 100 || /[\r\n]/.test(name) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || phone.length > 30 || farm.length > 150 || message.length < 10 || message.length > 3000 || !['demo', 'question'].includes(purpose)) return failure('Preencha seu nome, um e-mail válido e uma mensagem de 10 a 3.000 caracteres.', 400)
  const user = process.env.CONTACT_GMAIL_USER
  const pass = process.env.CONTACT_GMAIL_APP_PASSWORD?.replace(/\s/g, '')
  if (!user || !pass) return failure('O envio está temporariamente indisponível. Tente novamente mais tarde.', 503)
  if (Date.now() - windowStart > 600000) { windowStart = Date.now(); attempts = 0 }
  if (attempts >= 20) return failure('Recebemos muitas mensagens agora. Tente novamente em alguns minutos.', 429)
  attempts++
  const transport = nodemailer.createTransport({
    service: 'gmail', auth: { user, pass }, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
  })
  try {
    const result = await transport.sendMail({
      from: { name: 'Anota Aí Agro', address: user }, to: recipient,
      replyTo: { name, address: email },
      subject: purpose === 'demo' ? 'Pedido de demonstração — Anota Aí Agro' : 'Fale conosco — Anota Aí Agro',
      text: ['Nome: ' + name, 'E-mail: ' + email, 'Telefone / WhatsApp: ' + (phone || 'Não informado'), 'Propriedade: ' + (farm || 'Não informada'), '', 'Mensagem:', message].join('\n'),
      disableFileAccess: true, disableUrlAccess: true,
    })
    if (!result.accepted?.length) return failure('Não foi possível enviar. Tente novamente em alguns minutos.', 502)
    return NextResponse.json({ ok: true })
  } catch {
    return failure('Não foi possível enviar. Tente novamente em alguns minutos.', 502)
  } finally { transport.close() }
}
