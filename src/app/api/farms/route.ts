import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { canEdit, getSessionUser } from '@/lib/auth'
import { addFarmMember, parseSegments } from '@/lib/farms'

export async function GET() {
  const me = await getSessionUser()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  if (me.role === 'admin') {
    // Admin sees all farms
    const farms = await prisma.farm.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(farms)
  }

  // Produtor: as propriedades a que tem acesso
  const farms = await prisma.farm.findMany({ where: { members: { some: { userId: me.id } } }, orderBy: { name: 'asc' } })
  return NextResponse.json(farms)
}

// POST: cadastra uma propriedade. O produtor passa a ter acesso a ela e ela já fica aberta.
export async function POST(request: NextRequest) {
  const me = await getSessionUser()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (me.role !== 'admin' && !(me.permissions?.includes('fazendas') && canEdit(me))) {
    return NextResponse.json({ error: 'Você não tem permissão para esta ação' }, { status: 403 })
  }

  const { name, propertyType, documentType, documentNumber, owner, phone, address, city, state, segments } = await request.json()

  if (!name) return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 })
  const parsedSegments = segments === undefined ? [] : parseSegments(segments)
  if (!parsedSegments) return NextResponse.json({ error: 'Segmento inválido' }, { status: 400 })

  const farm = await prisma.$transaction(async (tx) => {
    const created = await tx.farm.create({
      data: {
        name,
        propertyType: propertyType || 'Fazenda',
        documentType: documentType || null,
        documentNumber: documentNumber || null,
        owner: owner || null,
        phone: phone || null,
        address: address || null,
        city: city || null,
        state: state || null,
        segments: parsedSegments,
      },
    })
    if (me.role !== 'admin') {
      await addFarmMember(tx, me.id, created.id)
      await tx.user.update({ where: { id: me.id }, data: { farmId: created.id } })
    }
    return created
  })
  return NextResponse.json(farm, { status: 201 })
}
