import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireOrganization } from '@/lib/auth'

async function findFee(id: string) {
  const auth = await requireOrganization('associacao')
  if ('error' in auth) return { error: auth.error } as const
  const fee = await prisma.memberFee.findFirst({ where: { id, organizationId: auth.organization.id }, select: { id: true } })
  if (!fee) return { error: notFound('Mensalidade não encontrada') } as const
  return { fee } as const
}

// PATCH: { paid } marca como paga (hoje) ou desfaz
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await findFee((await params).id)
  if ('error' in found) return found.error
  const { paid } = await request.json()
  return NextResponse.json(await prisma.memberFee.update({ where: { id: found.fee.id }, data: { paidAt: paid ? new Date() : null } }))
}

// DELETE: apaga a mensalidade (ex.: gerada por engano)
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await findFee((await params).id)
  if ('error' in found) return found.error
  await prisma.memberFee.delete({ where: { id: found.fee.id } })
  return NextResponse.json({ ok: true })
}
