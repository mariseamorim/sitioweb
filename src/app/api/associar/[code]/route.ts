import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { canManageMembership, memberIdentity } from '@/lib/associacao'

// GET: dados públicos da associação do convite e a situação de quem abriu o link
export async function GET(_: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const org = await prisma.organization.findUnique({
    where: { inviteCode: code.toUpperCase() },
    select: { id: true, type: true, name: true, contactName: true, city: true, state: true, status: true },
  })
  if (!org || org.type !== 'associacao' || org.status !== 'aprovado') return NextResponse.json({ error: 'Convite inválido' }, { status: 404 })

  const user = await getSessionUser()
  const identity = user ? memberIdentity(user) : null
  const member = identity ? await prisma.orgMember.findFirst({ where: { organizationId: org.id, ...identity }, select: { id: true } }) : null
  return NextResponse.json({
    name: org.name,
    contactName: org.contactName,
    city: org.city,
    state: org.state,
    loggedIn: !!user,
    canJoin: !!identity && !!user && canManageMembership(user),
    member: !!member,
  })
}
