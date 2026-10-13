import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrganization } from '@/lib/auth'
import { cleanText } from '@/lib/laticinio'
import { NOTICE_KINDS } from '@/lib/organizations'

// POST: { kind, title, body?, eventDate? } comunicado para todos os associados
export async function POST(request: NextRequest) {
  const auth = await requireOrganization('associacao')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const title = cleanText(body.title, 120)
  if (!title) return NextResponse.json({ error: 'Escreva o título do comunicado' }, { status: 400 })
  const eventDate = typeof body.eventDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.eventDate) ? new Date(body.eventDate) : null

  const notice = await prisma.orgNotice.create({
    data: {
      organizationId: auth.organization.id,
      kind: body.kind in NOTICE_KINDS ? body.kind : 'aviso',
      title,
      body: cleanText(body.body, 1000),
      eventDate,
    },
  })
  return NextResponse.json(notice, { status: 201 })
}
