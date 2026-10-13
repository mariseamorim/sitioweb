import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrganization } from '@/lib/auth'
import { cleanText } from '@/lib/laticinio'

const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(v) : null)

// POST: { memberId, subject, description?, scheduledFor?, technician? } a associação agenda uma visita a um associado
export async function POST(request: NextRequest) {
  const auth = await requireOrganization('associacao')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const subject = cleanText(body.subject, 120)
  if (!subject) return NextResponse.json({ error: 'Informe o assunto da visita' }, { status: 400 })
  const member = await prisma.orgMember.findFirst({ where: { id: String(body.memberId ?? ''), organizationId: auth.organization.id }, select: { id: true } })
  if (!member) return NextResponse.json({ error: 'Escolha o associado' }, { status: 400 })
  const scheduledFor = day(body.scheduledFor)

  const visit = await prisma.techVisit.create({
    data: {
      organizationId: auth.organization.id,
      memberId: member.id,
      subject,
      description: cleanText(body.description, 1000),
      scheduledFor,
      technician: cleanText(body.technician, 80),
      status: scheduledFor ? 'agendada' : 'solicitada',
    },
  })
  return NextResponse.json(visit, { status: 201 })
}
