import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, setSessionCookie } from '@/lib/auth'
import { registrationIdentity } from '@/lib/registration'
import { newInviteCode } from '@/lib/vendors'
import { isOrgType } from '@/lib/organizations'

// POST: cadastro público de laticínio ou associação. Fica "pendente" até o admin aprovar.
export async function POST(request: NextRequest) {
  const { organization: org, user } = await request.json()
  if (!isOrgType(org?.type)) return NextResponse.json({ error: 'Tipo de cadastro inválido' }, { status: 400 })
  const auth = await registrationIdentity({ ...user, name: org?.contactName })
  if (auth.error) return auth.error
  const identity = auth.identity!

  if (!org?.name || !org?.contactName || !org?.phone) {
    return NextResponse.json({ error: 'Nome, responsável e telefone são obrigatórios' }, { status: 400 })
  }
  try {
    const created = await prisma.$transaction(async (tx) => {
      if (identity.id) {
        const claimed = await tx.user.updateMany({ where: { id: identity.id, role: 'onboarding' }, data: { role: org.type } })
        if (claimed.count !== 1) throw new Error('ALREADY_REGISTERED')
      }
      const o = await tx.organization.create({
        data: {
          type: org.type,
          name: String(org.name).trim(),
          document: org.document || null,
          contactName: String(org.contactName).trim(),
          phone: String(org.phone).trim(),
          email: identity.email,
          city: org.city || null,
          state: org.state ? String(org.state).trim().toUpperCase() : null,
          inviteCode: newInviteCode(),
        },
      })
      const data = { name: o.contactName, role: org.type, organizationId: o.id, permissions: [] }
      return identity.id ? tx.user.update({ where: { id: identity.id }, data }) : tx.user.create({ data: { ...data, email: identity.email, password: identity.password! } })
    })

    const response = NextResponse.json({ id: created.id }, { status: 201 })
    setSessionCookie(response, created.id)
    return response
  } catch (err) {
    console.error('Organization register error:', err)
    return NextResponse.json({ error: 'Erro ao criar cadastro' }, { status: 500 })
  }
}

// GET: lista para o admin aprovar
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const organizations = await prisma.organization.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: { _count: { select: { points: true, routes: true, members: true } } },
  })
  return NextResponse.json(organizations)
}
