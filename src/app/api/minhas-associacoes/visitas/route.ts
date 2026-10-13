import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, notFound } from '@/lib/auth'
import { canManageMembership, memberIdentity } from '@/lib/associacao'
import { cleanText } from '@/lib/laticinio'

// POST: { memberId, subject, description? } o associado pede uma visita técnica
export async function POST(request: NextRequest) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 })
  const identity = memberIdentity(user)
  if (!identity || !canManageMembership(user)) return NextResponse.json({ error: 'Você não tem permissão para esta ação' }, { status: 403 })

  const body = await request.json()
  const member = await prisma.orgMember.findFirst({ where: { id: String(body.memberId ?? ''), ...identity }, select: { id: true, organizationId: true, status: true } })
  if (!member) return notFound('Associação não encontrada')
  if (member.status !== 'ativo') return NextResponse.json({ error: 'Associado inativo. Fale com a associação.' }, { status: 403 })
  const subject = cleanText(body.subject, 120)
  if (!subject) return NextResponse.json({ error: 'Conte o motivo da visita' }, { status: 400 })

  const visit = await prisma.techVisit.create({
    data: { organizationId: member.organizationId, memberId: member.id, subject, description: cleanText(body.description, 1000) },
  })
  return NextResponse.json(visit, { status: 201 })
}
