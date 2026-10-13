import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireOrganization } from '@/lib/auth'

// DELETE: apaga o comunicado
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrganization('associacao')
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!(await prisma.orgNotice.findFirst({ where: { id, organizationId: auth.organization.id }, select: { id: true } }))) return notFound('Comunicado não encontrado')
  await prisma.orgNotice.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
