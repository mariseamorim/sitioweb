import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const { code, name, species, gender, birthDate, status, gta, observations, lowDate, lowReason, imageUrl } = body

  const animal = await prisma.animal.update({
    where: { id },
    data: {
      code,
      name,
      species,
      gender,
      birthDate: new Date(birthDate),
      status,
      gta: gta || null,
      observations: observations || null,
      imageUrl: imageUrl || null,
      lowDate: lowDate ? new Date(lowDate) : null,
      lowReason: lowReason || null,
    },
  })
  return NextResponse.json(animal)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  await prisma.animal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
