import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { canEdit, getSessionUser } from '@/lib/auth'

export async function GET() {
  const me = await getSessionUser()
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
  const me = await getSessionUser()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (me.role !== 'admin' && !(me.permissions?.includes('fazendas') && canEdit(me))) {
    return NextResponse.json({ error: 'Você não tem permissão para esta ação' }, { status: 403 })
  }

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
