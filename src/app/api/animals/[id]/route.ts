import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'
import { findValidMother } from '@/lib/calves'

async function findOwned(id: string, farmId: string) {
  return prisma.animal.findFirst({ where: { id, farmId }, select: { id: true } })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error

  const { id } = await params
  if (!(await findOwned(id, auth.farmId))) return notFound('Animal não encontrado')

  const body = await request.json()
  const { code, name, species, gender, birthDate, status, gta, observations, lowDate, lowReason, imageUrl, motherId } = body
  if (motherId && !(await findValidMother(String(motherId), auth.farmId, id))) {
    return NextResponse.json({ error: 'Mãe inválida para este animal' }, { status: 400 })
  }

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
      // Só muda a mãe quando o formulário manda o campo
      ...(motherId !== undefined ? { motherId: motherId || null } : {}),
    },
  })
  return NextResponse.json(animal)
}

// PATCH: { motherId } liga (ou desliga, com null) uma cria já cadastrada à mãe
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error

  const { id } = await params
  if (!(await findOwned(id, auth.farmId))) return notFound('Animal não encontrado')

  const { motherId } = await request.json()
  if (motherId && !(await findValidMother(String(motherId), auth.farmId, id))) {
    return NextResponse.json({ error: 'Mãe inválida para este animal' }, { status: 400 })
  }
  const animal = await prisma.animal.update({ where: { id }, data: { motherId: motherId || null } })
  return NextResponse.json(animal)
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error

  const { id } = await params
  if (!(await findOwned(id, auth.farmId))) return notFound('Animal não encontrado')

  await prisma.animal.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
