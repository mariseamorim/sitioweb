import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireOrganization } from '@/lib/auth'

// PATCH: { status: 'ativo' | 'inativo' } a associação marca a situação do associado
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrganization('associacao')
  if ('error' in auth) return auth.error
  const { id } = await params
  const { status } = await request.json()
  if (!['ativo', 'inativo'].includes(status)) return NextResponse.json({ error: 'Situação inválida' }, { status: 400 })
  if (!(await prisma.orgMember.findFirst({ where: { id, organizationId: auth.organization.id }, select: { id: true } }))) return notFound('Associado não encontrado')
  return NextResponse.json(await prisma.orgMember.update({ where: { id }, data: { status } }))
}
