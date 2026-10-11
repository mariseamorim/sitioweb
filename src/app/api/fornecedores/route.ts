import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, requireAdmin, setSessionCookie } from '@/lib/auth'
import { newInviteCode } from '@/lib/vendors'

// POST: cadastro público de fornecedor. Fica "pendente" até o admin aprovar.
export async function POST(request: NextRequest) {
  const { vendor, user } = await request.json()

  if (!vendor?.companyName || !vendor?.contactName || !vendor?.phone) {
    return NextResponse.json({ error: 'Empresa, nome do contato e telefone são obrigatórios' }, { status: 400 })
  }
  if (!user?.email || !user?.password) {
    return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 })
  }
  if (user.password.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  }
  if (await prisma.user.findUnique({ where: { email: user.email } })) {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
  }

  const passwordHash = await hashPassword(user.password)
  try {
    const created = await prisma.$transaction(async (tx) => {
      const v = await tx.vendor.create({
        data: {
          companyName: vendor.companyName,
          document: vendor.document || null,
          contactName: vendor.contactName,
          phone: vendor.phone,
          whatsapp: vendor.whatsapp || vendor.phone,
          email: user.email,
          city: vendor.city || null,
          state: vendor.state ? String(vendor.state).trim().toUpperCase() : null,
          description: vendor.description || null,
          inviteCode: newInviteCode(),
        },
      })
      return tx.user.create({
        data: { name: vendor.contactName, email: user.email, password: passwordHash, role: 'fornecedor', vendorId: v.id },
      })
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
