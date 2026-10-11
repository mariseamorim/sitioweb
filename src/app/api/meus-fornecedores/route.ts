import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireProducer } from '@/lib/auth'

export async function GET() {
  const auth = await requireProducer(false)
  if ('error' in auth) return auth.error

  const links = await prisma.vendorClient.findMany({
    where: { farmId: auth.farmId, vendor: { status: { not: 'bloqueado' } } },
    include: { vendor: { select: { id: true, companyName: true, contactName: true, city: true, state: true, whatsapp: true, phone: true, status: true } } },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(links.map((l) => ({ ...l.vendor, muted: l.muted, since: l.createdAt })))
}

// POST: { code } (link de convite) ou { vendorId } (busca). O vínculo é sempre criado pelo produtor.
export async function POST(request: NextRequest) {
  const auth = await requireProducer(true)
  if ('error' in auth) return auth.error

  const { code, vendorId } = await request.json()
  const vendor = code
    ? await prisma.vendor.findUnique({ where: { inviteCode: String(code).toUpperCase() } })
    : vendorId ? await prisma.vendor.findUnique({ where: { id: String(vendorId) } }) : null
  // Pela busca só aparecem aprovados; pelo convite o vínculo vale mesmo antes da aprovação
  if (!vendor || vendor.status === 'bloqueado' || (!code && vendor.status !== 'aprovado')) {
    return notFound('Fornecedor não encontrado')
  }

  await prisma.vendorClient.upsert({
    where: { vendorId_farmId: { vendorId: vendor.id, farmId: auth.farmId } },
    create: { vendorId: vendor.id, farmId: auth.farmId },
    update: {},
  })
  return NextResponse.json({ ok: true, companyName: vendor.companyName }, { status: 201 })
}
