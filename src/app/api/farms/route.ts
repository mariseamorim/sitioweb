import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

async function getMe() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value
  if (!userId) return null
  return prisma.user.findUnique({ where: { id: userId }, select: { id: true, farmId: true, role: true } })
}

export async function GET() {
  const me = await getMe()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (me.role === 'admin') {
    // Admin sees all farms
    const farms = await prisma.farm.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(farms)
  }

  // Regular users see only their own farm
  if (!me.farmId) return NextResponse.json([])
  const farm = await prisma.farm.findUnique({ where: { id: me.farmId } })
  return NextResponse.json(farm ? [farm] : [])
}

export async function POST(request: NextRequest) {
  const me = await getMe()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const { name, propertyType, documentType, documentNumber, owner, email, phone, address, city, state } = await request.json()

  if (!name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })

  try {
    const farm = await prisma.farm.create({
      data: {
        name,
        propertyType: propertyType || 'Fazenda',
        documentType: documentType || null,
        documentNumber: documentNumber || null,
        owner: owner || null,
        email: email || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
      },
    })
    return NextResponse.json(farm, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Documento já cadastrado' }, { status: 409 })
  }
}
