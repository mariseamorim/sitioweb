import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, setSessionCookie } from '@/lib/auth'

// POST: cadastro do Anota Aí Leite. Só nome, acesso e o primeiro local.
export async function POST(request: NextRequest) {
  const { name, email, password, pointName, pointKind } = await request.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 })
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  }
  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
  }

  const user = await prisma.user.create({
    data: {
      name: String(name).trim(),
      email,
      password: await hashPassword(password),
      role: 'lite',
      milkPoints: pointName
        ? { create: { name: String(pointName).trim(), kind: pointKind === 'tanque' ? 'tanque' : 'sitio' } }
        : undefined,
    },
  })

  const response = NextResponse.json({ id: user.id }, { status: 201 })
  setSessionCookie(response, user.id)
  return response
}
