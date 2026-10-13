import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

// GET: dados públicos do fornecedor que mandou o convite
export async function GET(_: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const vendor = await prisma.vendor.findUnique({
    where: { inviteCode: code.toUpperCase() },
    select: { id: true, companyName: true, contactName: true, city: true, state: true, description: true, status: true },
  })
  if (!vendor || vendor.status === 'bloqueado') {
    return NextResponse.json({ error: 'Convite inválido' }, { status: 404 })
  }

  const user = await getSessionUser()
  const linked = user?.effectiveFarmId
    ? !!(await prisma.vendorClient.findUnique({ where: { vendorId_farmId: { vendorId: vendor.id, farmId: user.effectiveFarmId } } }))
    : false

  return NextResponse.json({
    companyName: vendor.companyName,
    contactName: vendor.contactName,
    city: vendor.city,
    state: vendor.state,
    description: vendor.description,
    loggedIn: !!user,
    isVendor: user?.role === 'fornecedor',
    canLink: !!user?.effectiveFarmId && user.role !== 'fornecedor',
    linked,
  })
}
