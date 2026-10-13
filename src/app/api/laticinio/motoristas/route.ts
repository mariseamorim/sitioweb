import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, requireOrganization } from '@/lib/auth'
import { COLLECTION_ORGS, cleanText } from '@/lib/laticinio'

// POST: o laticínio cria o acesso do motorista (ele entra no Anota Aí Leite e vê as rotas atribuídas)
export async function POST(request: NextRequest) {
  const auth = await requireOrganization(COLLECTION_ORGS)
  if ('error' in auth) return auth.error

  const body = await request.json()
  const name = cleanText(body.name, 80)
  const email = cleanText(body.email, 120)?.toLowerCase()
  const password = typeof body.password === 'string' ? body.password : ''
  if (!name || !email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: 'Informe nome e e-mail válidos' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  if (await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })) {
    return NextResponse.json({ error: 'Já existe uma conta com esse e-mail' }, { status: 409 })
  }

  const driver = await prisma.user.create({
    data: {
      name, email, password: await hashPassword(password), role: 'motorista', permissions: [],
      organizationId: auth.organization.id, phone: cleanText(body.phone, 30), vehicle: cleanText(body.vehicle, 60),
    },
    select: { id: true, name: true, email: true, phone: true, vehicle: true },
  })
  return NextResponse.json(driver, { status: 201 })
}
