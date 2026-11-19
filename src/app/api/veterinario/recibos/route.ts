import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVet } from '@/lib/vets'
import { day, positive, text } from '@/lib/vetInput'

// GET: recibos emitidos pelo veterinário, do mais novo para o mais antigo, com os dados dele para o cabeçalho
export async function GET() {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const receipts = await prisma.vetReceipt.findMany({ where: { vetId: auth.vet.id }, orderBy: { number: 'desc' }, take: 200 })
  return NextResponse.json({
    vet: { name: auth.user.name, crmv: auth.vet.crmv, city: auth.vet.city, state: auth.vet.state, phone: auth.user.phone },
    receipts,
  })
}

// POST: emite um recibo com o próximo número. Body: { payer, payerDoc?, farmName?, date, description, amount }
export async function POST(request: NextRequest) {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const body = await request.json()
  const payer = text(body.payer, 120)
  const description = text(body.description, 1000)
  const date = day(body.date)
  const amount = positive(body.amount)
  if (!payer) return NextResponse.json({ error: 'Informe de quem você recebeu' }, { status: 400 })
  if (!description) return NextResponse.json({ error: 'Descreva o serviço' }, { status: 400 })
  if (!date) return NextResponse.json({ error: 'Informe a data' }, { status: 400 })
  if (!amount) return NextResponse.json({ error: 'Informe o valor' }, { status: 400 })

  // O número é único por veterinário: se dois recibos saírem ao mesmo tempo, o segundo tenta de novo com o seguinte
  for (let attempt = 0; attempt < 3; attempt++) {
    const last = await prisma.vetReceipt.findFirst({ where: { vetId: auth.vet.id }, orderBy: { number: 'desc' }, select: { number: true } })
    try {
      const receipt = await prisma.vetReceipt.create({
        data: { vetId: auth.vet.id, number: (last?.number ?? 0) + 1, payer, payerDoc: text(body.payerDoc, 30), farmName: text(body.farmName, 120), date, description, amount: Math.round(amount * 100) / 100 },
      })
      return NextResponse.json(receipt, { status: 201 })
    } catch (err) {
      if ((err as { code?: string }).code !== 'P2002') throw err
    }
  }
  return NextResponse.json({ error: 'Não foi possível numerar o recibo. Tente de novo.' }, { status: 409 })
}
