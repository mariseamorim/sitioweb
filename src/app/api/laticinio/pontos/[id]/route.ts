import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireOrganization } from '@/lib/auth'
import { COLLECTION_ORGS, cleanText, pointData } from '@/lib/laticinio'

// PATCH: edita o ponto ou arquiva/reativa ({ active }). Arquivar mantém o histórico de coletas.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrganization(COLLECTION_ORGS)
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!(await prisma.milkPoint.findFirst({ where: { id, organizationId: auth.organization.id }, select: { id: true } }))) return notFound('Ponto de coleta não encontrado')

  const body = await request.json()
  if (typeof body.active === 'boolean' && Object.keys(body).length === 1) {
    return NextResponse.json(await prisma.milkPoint.update({ where: { id }, data: { active: body.active } }))
  }
  const name = cleanText(body.name, 80)
  if (!name) return NextResponse.json({ error: 'Informe o nome do sítio ou tanque' }, { status: 400 })
  return NextResponse.json(await prisma.milkPoint.update({ where: { id }, data: { ...pointData(body), name } }))
}
