import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireOrganization } from '@/lib/auth'
import { routeInput } from '@/lib/laticinio'

async function findRoute(id: string) {
  const auth = await requireOrganization('laticinio')
  if ('error' in auth) return { error: auth.error } as const
  const route = await prisma.route.findFirst({ where: { id, organizationId: auth.organization.id }, select: { id: true } })
  if (!route) return { error: notFound('Rota não encontrada') } as const
  return { route, organization: auth.organization } as const
}

// PUT: troca nome, dias, motorista e paradas (na ordem enviada)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await findRoute((await params).id)
  if ('error' in found) return found.error
  const input = await routeInput(found.organization.id, await request.json())
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 })

  const route = await prisma.$transaction(async (tx) => {
    await tx.routeStop.deleteMany({ where: { routeId: found.route.id } })
    return tx.route.update({
      where: { id: found.route.id },
      data: { ...input.data, stops: { create: input.pointIds.map((pointId, position) => ({ pointId, position })) } },
    })
  })
  return NextResponse.json(route)
}

// DELETE: apaga a rota (as coletas ficam no histórico dos pontos)
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await findRoute((await params).id)
  if ('error' in found) return found.error
  await prisma.route.delete({ where: { id: found.route.id } })
  return NextResponse.json({ ok: true })
}
