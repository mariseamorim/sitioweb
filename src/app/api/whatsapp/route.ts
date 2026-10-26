import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { animalToday } from '@/lib/animalRules'
import { milkDay } from '@/lib/milkValidation'
import {
  ERROR_REPLY, HELP_REPLY, NO_ACCOUNT_REPLY, NO_FARM_REPLY, UNKNOWN_REPLY, type IncomingText, type MatchableAnimal,
  canNoteMilk, incomingTexts, matchAnimal, notFoundReply, parseMessage, phoneCandidates, savedReply,
} from '@/lib/whatsapp'
import { allowedSender, markRead, sendText, validSignature, whatsappConfig, whatsappEnabled } from '@/lib/whatsappServer'

// Webhook da Cloud API do WhatsApp (Meta). A pessoa manda "120 litros" e o app anota o leite da propriedade dela.
// A Meta chama GET uma vez, para confirmar o endereço, e POST a cada mensagem. Responder 200 rápido evita reenvio.

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams
  const { verifyToken } = whatsappConfig()
  if (verifyToken && q.get('hub.mode') === 'subscribe' && q.get('hub.verify_token') === verifyToken) {
    return new NextResponse(q.get('hub.challenge') ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
  return NextResponse.json({ error: 'Token de verificação inválido' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  if (!whatsappEnabled()) return NextResponse.json({ error: 'WhatsApp não configurado' }, { status: 503 })
  const raw = await request.text()
  if (!validSignature(raw, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Assinatura inválida' }, { status: 401 })
  }
  let payload: unknown
  try { payload = JSON.parse(raw) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const messages = incomingTexts(payload)
  // Uma de cada vez, para a resposta chegar na ordem; erros não derrubam as outras
  for (const message of messages) {
    try {
      await handle(message)
    } catch (err) {
      console.error('[whatsapp] falha ao tratar mensagem', message.id, err)
      await sendText(message.from, ERROR_REPLY)
    }
  }
  return NextResponse.json({ ok: true, handled: messages.length })
}

async function handle(message: IncomingText) {
  if (!allowedSender(message.from)) return // fora da lista de teste: silêncio
  void markRead(message.id)
  const reply = (text: string) => sendText(message.from, text)

  const user = await prisma.user.findFirst({
    where: { phone: { in: phoneCandidates(message.from) } },
    select: { id: true, name: true, role: true, permissions: true, farmId: true, farm: { select: { id: true, name: true, milkPrice: true } } },
  })
  if (!user) return reply(NO_ACCOUNT_REPLY)

  const today = animalToday()
  const parsed = parseMessage(message.text, today)
  if (parsed.kind === 'ajuda') return reply(HELP_REPLY)
  if (parsed.kind === 'desconhecido') return reply(UNKNOWN_REPLY)
  if (!canNoteMilk(user) || !user.farm) return reply(NO_FARM_REPLY)

  let animal: MatchableAnimal | null = null
  if (parsed.animalRef) {
    const herd = await prisma.animal.findMany({ where: { farmId: user.farm.id, status: 'Vivo' }, select: { id: true, code: true, customCode: true, name: true, status: true }, orderBy: { code: 'asc' } })
    const match = matchAnimal(herd, parsed.animalRef)
    if (!('animal' in match)) return reply(notFoundReply(parsed.animalRef, match.candidates))
    animal = match.animal
  }

  const day = milkDay(parsed.date)
  if (!day) return reply(UNKNOWN_REPLY)
  await prisma.milkProduction.create({
    data: {
      farmId: user.farm.id,
      animalId: animal?.id ?? null,
      date: day,
      quantity: parsed.liters,
      pricePerLiter: user.farm.milkPrice ?? null,
      cowsMilked: animal ? null : parsed.cowsMilked,
      observations: `Pelo WhatsApp (${user.name})`,
    },
  })
  return reply(savedReply(parsed, user.farm.name, animal, today))
}
