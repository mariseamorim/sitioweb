import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { setSessionCookie } from '@/lib/auth'
import { registrationIdentity } from '@/lib/registration'

// POST: cadastro do Anota Aí Leite.
// profile "produtor" anota a própria produção (um sítio); "motorista" anota a rota (vários sítios e tanques).
export async function POST(request: NextRequest) {
  const { name, email, phone, password, pointName, pointKind, profile } = await request.json()
  const auth = await registrationIdentity({ name, email, phone, password })
  if (auth.error) return auth.error
  const identity = auth.identity!
  const isDriver = profile === 'motorista'

  if (!isDriver && !String(pointName ?? '').trim()) {
    return NextResponse.json({ error: 'Informe o nome do seu sítio' }, { status: 400 })
  }

  const firstPoint = String(pointName ?? '').trim()
  try {
  const user = await prisma.$transaction(async tx => {
    const data = {
      role: isDriver ? 'motorista' : 'lite',
      milkPoints: firstPoint
        ? { create: { name: firstPoint, kind: isDriver && pointKind === 'tanque' ? 'tanque' : 'sitio' } }
        : undefined,
    }
    if (identity.id) {
      const claimed = await tx.user.updateMany({ where: { id: identity.id, role: 'onboarding' }, data: { role: data.role } })
      if (claimed.count !== 1) throw new Error('ALREADY_REGISTERED')
      return tx.user.update({ where: { id: identity.id }, data })
    }
    return tx.user.create({ data: { ...data, name: identity.name, email: identity.email, phone: identity.phone, password: identity.password! } })
  })

  const response = NextResponse.json({ id: user.id }, { status: 201 })
  setSessionCookie(response, user.id)
  return response
  } catch {
    return NextResponse.json({ error: 'Não foi possível concluir o cadastro. Verifique se a conta já foi cadastrada.' }, { status: 409 })
  }
}
