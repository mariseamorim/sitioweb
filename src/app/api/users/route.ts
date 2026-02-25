import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, farmId: true, farm: { select: { name: true } }, createdAt: true },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(users)
}

export async function POST(request: NextRequest) {
  const { name, email, password, role, farmId } = await request.json()

  if (!name || !email || !password || !farmId) {
    return NextResponse.json({ error: 'Nome, e-mail, senha e fazenda são obrigatórios' }, { status: 400 })
  }

  try {
    const user = await prisma.user.create({
      data: { name, email, password, role: role || 'viewer', farmId },
      select: { id: true, name: true, email: true, role: true, farmId: true },
    })
    return NextResponse.json(user, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
  }
}
