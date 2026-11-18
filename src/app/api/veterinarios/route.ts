import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { setSessionCookie } from '@/lib/auth'
import { registrationIdentity } from '@/lib/registration'
import { newInviteCode } from '@/lib/vendors'
import { VET_MODULES } from '@/lib/vets'

// POST: cadastro público de veterinário consultor. Body: { user: { name, phone, email, password }, vet: { crmv, city, state } }
// A conta é de edição, com os módulos de manejo; as propriedades entram depois, por vínculo com o produtor.
export async function POST(request: NextRequest) {
  const { user, vet } = await request.json()
  const auth = await registrationIdentity(user)
  if (auth.error) return auth.error
  const identity = auth.identity!

  try {
    const created = await prisma.$transaction(async (tx) => {
      const data = { role: 'editor', permissions: [...VET_MODULES] }
      if (identity.id) {
        const claimed = await tx.user.updateMany({ where: { id: identity.id, role: 'onboarding' }, data })
        if (claimed.count !== 1) throw new Error('ALREADY_REGISTERED')
      }
      const account = identity.id
        ? await tx.user.findUniqueOrThrow({ where: { id: identity.id } })
        : await tx.user.create({ data: { ...data, name: identity.name, email: identity.email, phone: identity.phone, password: identity.password! } })
      await tx.vetProfile.create({
        data: {
          userId: account.id,
          crmv: vet?.crmv ? String(vet.crmv).trim() : null,
          city: vet?.city ? String(vet.city).trim() : null,
          state: vet?.state ? String(vet.state).trim().toUpperCase() : null,
          inviteCode: newInviteCode(),
        },
      })
      return account
    })

    const response = NextResponse.json({ id: created.id }, { status: 201 })
    setSessionCookie(response, created.id)
    return response
  } catch (err) {
    console.error('Vet register error:', err)
    return NextResponse.json({ error: 'Erro ao criar cadastro' }, { status: 500 })
  }
}
