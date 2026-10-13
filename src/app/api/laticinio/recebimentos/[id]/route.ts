import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { COLLECTION_ORGS } from '@/lib/laticinio'
import { notFound, requireOrganization } from '@/lib/auth'

// DELETE: apaga um recebimento lançado errado
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrganization(COLLECTION_ORGS)
  if ('error' in auth) return auth.error
  const { id } = await params
  const found = await prisma.milkReception.findFirst({ where: { id, organizationId: auth.organization.id }, select: { id: true } })
  if (!found) return notFound('Recebimento não encontrado')
  await prisma.milkReception.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
