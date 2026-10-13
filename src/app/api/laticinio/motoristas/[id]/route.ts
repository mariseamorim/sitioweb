import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireOrganization } from '@/lib/auth'
import { cleanText } from '@/lib/laticinio'

async function findDriver(id: string) {
  const auth = await requireOrganization('laticinio')
  if ('error' in auth) return { error: auth.error } as const
  const driver = await prisma.user.findFirst({ where: { id, organizationId: auth.organization.id, role: 'motorista' }, select: { id: true } })
  if (!driver) return { error: notFound('Motorista não encontrado') } as const
  return { driver, organization: auth.organization } as const
}

// PATCH: atualiza nome, telefone e veículo
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await findDriver((await params).id)
  if ('error' in found) return found.error
  const body = await request.json()
  const data: Record<string, string | null> = {}
  if (body.name !== undefined) {
    const name = cleanText(body.name, 80)
    if (!name) return NextResponse.json({ error: 'Informe o nome' }, { status: 400 })
    data.name = name
  }
  if (body.phone !== undefined) data.phone = cleanText(body.phone, 30)
  if (body.vehicle !== undefined) data.vehicle = cleanText(body.vehicle, 60)
  const driver = await prisma.user.update({ where: { id: found.driver.id }, data, select: { id: true, name: true, email: true, phone: true, vehicle: true } })
  return NextResponse.json(driver)
}

// DELETE: desliga o motorista do laticínio (a conta continua, sem as rotas). As coletas ficam no histórico.
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await findDriver((await params).id)
  if ('error' in found) return found.error
  await prisma.$transaction([
    prisma.route.updateMany({ where: { organizationId: found.organization.id, driverId: found.driver.id }, data: { driverId: null } }),
    prisma.user.update({ where: { id: found.driver.id }, data: { organizationId: null } }),
  ])
  return NextResponse.json({ ok: true })
}
