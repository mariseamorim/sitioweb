import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrganization } from '@/lib/auth'
import { routeInput } from '@/lib/laticinio'

// POST: { name, days, driverId?, pointIds } cria a rota com as paradas na ordem informada
export async function POST(request: NextRequest) {
  const auth = await requireOrganization('laticinio')
  if ('error' in auth) return auth.error

  const input = await routeInput(auth.organization.id, await request.json())
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 })
  const route = await prisma.route.create({
    data: {
      ...input.data,
      organizationId: auth.organization.id,
      stops: { create: input.pointIds.map((pointId, position) => ({ pointId, position })) },
    },
  })
  return NextResponse.json(route, { status: 201 })
}
