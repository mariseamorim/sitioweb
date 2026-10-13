import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { notFound, requireFarmAccess } from '@/lib/auth'
import { findValidMother } from '@/lib/calves'
import { animalCategory, animalRuleError } from '@/lib/animalRules'
import { cleanCustomCode, duplicateCodeMessage } from '@/lib/animalCode'

async function findOwned(id: string, farmId: string) {
  return prisma.animal.findFirst({ where: { id, farmId } })
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error

  const { id } = await params
  const existing = await findOwned(id, auth.farmId)
  if (!existing) return notFound('Animal não encontrado')

  const body = await request.json()
  const { code, name, species, gender, birthDate, status, gta, observations, lowDate, lowReason, imageUrl, motherId } = body
  const classification = {
    species: species ?? existing.species, gender: gender ?? existing.gender,
    birthDate: birthDate ?? existing.birthDate,
    isCastrated: body.isCastrated ?? existing.isCastrated,
    acquisitionType: body.acquisitionType ?? existing.acquisitionType,
  }
  if (typeof classification.species !== 'string' || typeof classification.gender !== 'string' || typeof classification.isCastrated !== 'boolean' || typeof classification.acquisitionType !== 'string') return NextResponse.json({ error: 'Dados do animal inválidos' }, { status: 400 })
  const ruleError = animalRuleError(classification)
  if (ruleError) return NextResponse.json({ error: ruleError }, { status: 400 })
  if (motherId && !(await findValidMother(String(motherId), auth.farmId, id))) {
    return NextResponse.json({ error: 'A mãe deve ser uma fêmea bovina da propriedade com pelo menos 2 anos e meio' }, { status: 400 })
  }

  try {
  const animal = await prisma.animal.update({
    where: { id },
    data: {
      code,
      // Só muda o outro código quando o formulário manda o campo
      ...(body.customCode !== undefined ? { customCode: cleanCustomCode(body.customCode) } : {}),
      name,
      species: animalCategory(classification),
      gender: classification.gender,
      birthDate: new Date(classification.birthDate),
      isCastrated: classification.isCastrated,
      acquisitionType: classification.acquisitionType,
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
  } catch (error: unknown) {
    const duplicate = duplicateCodeMessage(error)
    if (duplicate) return NextResponse.json({ error: duplicate }, { status: 409 })
    throw error
  }
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
