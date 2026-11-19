import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { notFound, requireProducer } from '@/lib/auth'
import { addFarmMember } from '@/lib/farms'
import { isVet } from '@/lib/vets'

const VETS_ONLY_PRODUCER = 'Só o produtor pode liberar ou encerrar o acesso do veterinário'

// GET: veterinários que atendem a propriedade aberta
export async function GET() {
  const auth = await requireProducer(false)
  if ('error' in auth) return auth.error

  const links = await prisma.vetClient.findMany({
    where: { farmId: auth.farmId, status: 'ativo' },
    include: { vet: { select: { crmv: true, city: true, state: true, user: { select: { name: true, phone: true } } } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(links.map((l) => ({
    id: l.id, name: l.vet.user.name, phone: l.vet.user.phone, crmv: l.vet.crmv, city: l.vet.city, state: l.vet.state, since: l.createdAt,
  })))
}

// POST: { code } — o produtor libera a propriedade aberta para o veterinário dono do código.
export async function POST(request: NextRequest) {
  const auth = await requireProducer(true)
  if ('error' in auth) return auth.error
  if (await isVet(auth.user.id)) return NextResponse.json({ error: VETS_ONLY_PRODUCER }, { status: 403 })

  const { code } = await request.json()
  const vet = code ? await prisma.vetProfile.findUnique({ where: { inviteCode: String(code).trim().toUpperCase() }, include: { user: { select: { id: true, name: true, farmId: true, isDemo: true } } } }) : null
  // Código de uma conta de demonstração não libera propriedade de verdade
  if (!vet || vet.user.isDemo) return notFound('Código de veterinário não encontrado')
  const farm = await prisma.farm.findUnique({ where: { id: auth.farmId }, select: { name: true } })
  if (!farm) return notFound('Propriedade não encontrada')

  await prisma.$transaction(async (tx) => {
    await tx.vetClient.upsert({
      where: { vetId_farmId: { vetId: vet.id, farmId: auth.farmId } },
      create: { vetId: vet.id, farmId: auth.farmId, farmName: farm.name },
      // Vínculo retomado: volta a valer a propriedade ao vivo, no lugar da cópia guardada
      update: { status: 'ativo', endedAt: null, archive: Prisma.DbNull, farmName: farm.name },
    })
    await addFarmMember(tx, vet.user.id, auth.farmId)
    if (!vet.user.farmId) await tx.user.update({ where: { id: vet.user.id }, data: { farmId: auth.farmId } })
  })
  return NextResponse.json({ ok: true, name: vet.user.name }, { status: 201 })
}
