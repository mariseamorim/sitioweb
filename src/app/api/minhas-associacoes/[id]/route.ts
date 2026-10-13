import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser, notFound } from '@/lib/auth'
import { canManageMembership, memberIdentity } from '@/lib/associacao'

async function findMine(id: string) {
  const user = await getSessionUser()
  if (!user) return { error: NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 }) } as const
  const identity = memberIdentity(user)
  if (!identity || !canManageMembership(user)) return { error: NextResponse.json({ error: 'Você não tem permissão para esta ação' }, { status: 403 }) } as const
  const member = await prisma.orgMember.findFirst({ where: { id, ...identity }, select: { id: true } })
  if (!member) return { error: notFound('Associação não encontrada') } as const
  return { member } as const
}

// PATCH: { shareProduction } o produtor liga ou desliga o compartilhamento do total de leite
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await findMine((await params).id)
  if ('error' in found) return found.error
  const { shareProduction } = await request.json()
  return NextResponse.json(await prisma.orgMember.update({ where: { id: found.member.id }, data: { shareProduction: !!shareProduction } }))
}

// DELETE: o produtor sai da associação (os pedidos dele saem junto)
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await findMine((await params).id)
  if ('error' in found) return found.error
  await prisma.orgMember.delete({ where: { id: found.member.id } })
  return NextResponse.json({ ok: true })
}
