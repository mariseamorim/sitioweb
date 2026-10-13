import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrganization } from '@/lib/auth'
import { sharedProduction } from '@/lib/associacao'
import { todayUTC } from '@/lib/utils'

const isDay = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)

// GET ?from&to: associados (com a produção compartilhada no período) e compras coletivas
export async function GET(request: NextRequest) {
  const auth = await requireOrganization('associacao')
  if ('error' in auth) return auth.error
  const { organization } = auth

  const params = request.nextUrl.searchParams
  const to = isDay(params.get('to')) ? new Date(params.get('to')!) : todayUTC()
  const from = isDay(params.get('from')) ? new Date(params.get('from')!) : new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1))

  const yearAgo = new Date(Date.UTC(to.getUTCFullYear() - 1, to.getUTCMonth(), 1))
  const [members, purchases, notices, visits, fees] = await Promise.all([
    prisma.orgMember.findMany({
      where: { organizationId: organization.id },
      include: {
        farm: { select: { name: true, owner: true, phone: true, city: true, state: true } },
        user: { select: { name: true, email: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.groupPurchase.findMany({
      where: { organizationId: organization.id },
      include: { orders: { select: { id: true, memberId: true, quantity: true, note: true, updatedAt: true } } },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.orgNotice.findMany({ where: { organizationId: organization.id }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.techVisit.findMany({ where: { organizationId: organization.id, OR: [{ status: { in: ['solicitada', 'agendada'] } }, { updatedAt: { gte: yearAgo } }] }, orderBy: { createdAt: 'desc' } }),
    prisma.memberFee.findMany({ where: { organizationId: organization.id, dueDate: { gte: yearAgo } }, orderBy: [{ reference: 'desc' }] }),
  ])
  const production = await sharedProduction(members, from, to)

  return NextResponse.json({
    organization: { id: organization.id, name: organization.name, status: organization.status, inviteCode: organization.inviteCode },
    period: { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) },
    members: members.map((m) => ({
      id: m.id,
      // Associado da versão completa: nome da propriedade; do Anota Aí Leite: nome da pessoa
      name: m.farm?.name ?? m.user?.name ?? '—',
      contact: m.farm?.owner ?? m.user?.name ?? null,
      phone: m.farm?.phone ?? m.user?.phone ?? null,
      place: m.farm ? [m.farm.city, m.farm.state].filter(Boolean).join('/') || null : null,
      kind: m.farmId ? 'completa' : 'leite',
      status: m.status,
      shareProduction: m.shareProduction,
      liters: m.shareProduction ? production.get(m.id) ?? 0 : null,
      since: m.createdAt,
    })),
    purchases: purchases.map((p) => ({
      ...p,
      total: p.orders.reduce((s, o) => s + o.quantity, 0),
    })),
    notices,
    visits,
    fees: fees.map((f) => ({ ...f, dueDate: f.dueDate.toISOString().slice(0, 10) })),
  })
}
