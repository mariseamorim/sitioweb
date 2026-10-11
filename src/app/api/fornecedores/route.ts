import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin, setSessionCookie } from '@/lib/auth'
import { registrationIdentity } from '@/lib/registration'
import { newInviteCode } from '@/lib/vendors'

// POST: cadastro público de fornecedor. Fica "pendente" até o admin aprovar.
export async function POST(request: NextRequest) {
  const { vendor, user } = await request.json()
  const auth = await registrationIdentity({ ...user, name: vendor?.contactName })
  if (auth.error) return auth.error
  const identity = auth.identity!

  if (!vendor?.companyName || !vendor?.contactName || !vendor?.phone) {
    return NextResponse.json({ error: 'Empresa, nome do contato e telefone são obrigatórios' }, { status: 400 })
  }
  try {
    const created = await prisma.$transaction(async (tx) => {
      if (identity.id) {
        const claimed = await tx.user.updateMany({ where: { id: identity.id, role: 'onboarding' }, data: { role: 'fornecedor' } })
        if (claimed.count !== 1) throw new Error('ALREADY_REGISTERED')
      }
      const v = await tx.vendor.create({
        data: {
          companyName: vendor.companyName,
          document: vendor.document || null,
          contactName: vendor.contactName,
          phone: vendor.phone,
          whatsapp: vendor.whatsapp || vendor.phone,
          email: identity.email,
          city: vendor.city || null,
          state: vendor.state ? String(vendor.state).trim().toUpperCase() : null,
          description: vendor.description || null,
          inviteCode: newInviteCode(),
        },
      })
      const data = { name: vendor.contactName, role: 'fornecedor', vendorId: v.id }
      return identity.id ? tx.user.update({ where: { id: identity.id }, data }) : tx.user.create({ data: { ...data, email: identity.email, password: identity.password! } })
    })

    const response = NextResponse.json({ id: created.id }, { status: 201 })
    setSessionCookie(response, created.id)
    return response
  } catch (err) {
    console.error('Vendor register error:', err)
    return NextResponse.json({ error: 'Erro ao criar cadastro' }, { status: 500 })
  }
}

// GET: lista para o admin aprovar
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const vendors = await prisma.vendor.findMany({
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: { _count: { select: { clients: true, promotions: true } } },
  })
  return NextResponse.json(vendors)
}
