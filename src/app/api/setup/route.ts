import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET: check if admin already exists (for the setup page to know whether to show the form)
export async function GET() {
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'admin' } })
  return NextResponse.json({ adminExists: !!existingAdmin })
}

// POST: create the one-time super admin account
export async function POST(request: NextRequest) {
  const existingAdmin = await prisma.user.findFirst({ where: { role: 'admin' } })
  if (existingAdmin) {
    return NextResponse.json({ error: 'Admin já configurado. Acesso negado.' }, { status: 403 })
  }

  const { name, email, password } = await request.json()
  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  }

  const existingUser = await prisma.user.findUnique({ where: { email } })
  if (existingUser) {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
  }

  try {
    const admin = await prisma.user.create({
      data: { name, email, password, role: 'admin', farmId: null },
    })

    const response = NextResponse.json({ id: admin.id, name: admin.name }, { status: 201 })
    response.cookies.set('userId', admin.id, {
      httpOnly: true,
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    return response
  } catch (err) {
    console.error('Setup error:', err)
    return NextResponse.json({ error: 'Erro ao criar admin' }, { status: 500 })
  }
}
