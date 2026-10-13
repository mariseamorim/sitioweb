import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrganization } from '@/lib/auth'
import { COLLECTION_ORGS, cleanText, pointData } from '@/lib/laticinio'

// POST: o laticínio cadastra um ponto de coleta (sítio ou tanque comunitário)
export async function POST(request: NextRequest) {
  const auth = await requireOrganization(COLLECTION_ORGS)
  if ('error' in auth) return auth.error

  const body = await request.json()
  const name = cleanText(body.name, 80)
  if (!name) return NextResponse.json({ error: 'Informe o nome do sítio ou tanque' }, { status: 400 })
  const point = await prisma.milkPoint.create({
    data: { ...pointData(body), name, ownerId: auth.user.id, organizationId: auth.organization.id },
  })
  return NextResponse.json(point, { status: 201 })
}
