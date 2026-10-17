import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, requireOrganization } from '@/lib/auth'
import { COLLECTION_ORGS, cleanText } from '@/lib/laticinio'
import { validateContact } from '@/lib/identity'
import { contactInUse } from '@/lib/registration'

// POST: o laticínio cria o acesso do motorista (ele entra no Anota Aí Leite e vê as rotas atribuídas)
export async function POST(request: NextRequest) {
  const auth = await requireOrganization(COLLECTION_ORGS)
  if ('error' in auth) return auth.error

  const body = await request.json()
  const name = cleanText(body.name, 80)
  const password = typeof body.password === 'string' ? body.password : ''
  if (!name) return NextResponse.json({ error: 'Informe o nome do motorista' }, { status: 400 })
  // O motorista entra com o telefone (ou e-mail, se preferir) e a senha
  const contact = validateContact({ email: body.email, phone: body.phone })
  if ('error' in contact) return NextResponse.json({ error: contact.error }, { status: 400 })
  const { email, phone } = contact
  if (password.length < 6) return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  const inUse = await contactInUse(email, phone)
  if (inUse) return NextResponse.json({ error: inUse.replace(' Entre para continuar seu cadastro.', '') }, { status: 409 })

  const driver = await prisma.user.create({
    data: {
      name, email, password: await hashPassword(password), role: 'motorista', permissions: [],
      organizationId: auth.organization.id, phone, vehicle: cleanText(body.vehicle, 60),
    },
    select: { id: true, name: true, email: true, phone: true, vehicle: true },
  })
  return NextResponse.json(driver, { status: 201 })
}
