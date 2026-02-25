import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const farms = await prisma.farm.findMany({ orderBy: { name: 'asc' } })
  return NextResponse.json(farms)
}

export async function POST(request: NextRequest) {
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
  } catch (err) {
    return NextResponse.json({ error: 'Documento já cadastrado' }, { status: 409 })
  }
}
