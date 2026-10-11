import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, setSessionCookie } from '@/lib/auth'

// POST: cadastro do Anota Aí Leite.
// profile "produtor" anota a própria produção (um sítio); "motorista" anota a rota (vários sítios e tanques).
export async function POST(request: NextRequest) {
  const { name, email, password, pointName, pointKind, profile } = await request.json()
  const isDriver = profile === 'motorista'

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 })
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  }
  if (!isDriver && !String(pointName ?? '').trim()) {
    return NextResponse.json({ error: 'Informe o nome do seu sítio' }, { status: 400 })
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
  }

  const firstPoint = String(pointName ?? '').trim()
  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email,
      password: await hashPassword(password),
      role: isDriver ? 'motorista' : 'lite',
      milkPoints: firstPoint
        ? { create: { name: firstPoint, kind: isDriver && pointKind === 'tanque' ? 'tanque' : 'sitio' } }
        : undefined,
    },
  })

  const response = NextResponse.json({ id: user.id }, { status: 201 })
  setSessionCookie(response, user.id)
  return response
}
