import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { canManageMembership, memberIdentity } from '@/lib/associacao'

async function identify() {
  const user = await getSessionUser()
  if (!user) return { error: NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 }) } as const
  const identity = memberIdentity(user)
  if (!identity) return { error: NextResponse.json({ error: 'Só produtores podem se associar' }, { status: 403 }) } as const
  return { user, identity } as const
}

// GET: associações do produtor, com as compras coletivas e o pedido dele em cada uma
export async function GET() {
  const auth = await identify()
  if ('error' in auth) return auth.error
  const members = await prisma.orgMember.findMany({
    where: auth.identity,
    include: {
      organization: {
        select: {
          name: true, contactName: true, phone: true, status: true,
          purchases: { orderBy: [{ status: 'asc' }, { createdAt: 'desc' }], take: 30, include: { orders: { select: { memberId: true, quantity: true, note: true } } } },
          notices: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      },
      visits: { orderBy: { createdAt: 'desc' }, take: 20 },
      fees: { orderBy: { reference: 'desc' }, take: 12 },
    },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json({
    canManage: canManageMembership(auth.user),
    associations: members.map((m) => ({
      id: m.id,
      name: m.organization.name,
      contactName: m.organization.contactName,
      phone: m.organization.phone,
      status: m.status,
      shareProduction: m.shareProduction,
      purchases: m.organization.purchases.map(({ orders, ...p }) => {
        const mine = orders.find((o) => o.memberId === m.id)
        return { ...p, myQuantity: mine?.quantity ?? null, myNote: mine?.note ?? null, total: orders.reduce((s, o) => s + o.quantity, 0) }
      }),
      notices: m.organization.notices,
      visits: m.visits,
      fees: m.fees.map((f) => ({ ...f, dueDate: f.dueDate.toISOString().slice(0, 10) })),
    })),
  })
}

// POST: { code, shareProduction } associa o produtor pelo link de convite (ele escolhe se compartilha o leite)
export async function POST(request: NextRequest) {
  const auth = await identify()
  if ('error' in auth) return auth.error
  if (!canManageMembership(auth.user)) return NextResponse.json({ error: 'Peça a quem administra a propriedade para associar' }, { status: 403 })

  const { code, shareProduction } = await request.json()
  const org = await prisma.organization.findUnique({ where: { inviteCode: String(code ?? '').toUpperCase() }, select: { id: true, type: true, status: true } })
  if (!org || org.type !== 'associacao' || org.status !== 'aprovado') return NextResponse.json({ error: 'Convite inválido' }, { status: 404 })

  const existing = await prisma.orgMember.findFirst({ where: { organizationId: org.id, ...auth.identity }, select: { id: true } })
  const member = existing
    ? await prisma.orgMember.update({ where: { id: existing.id }, data: { shareProduction: shareProduction !== false } })
    : await prisma.orgMember.create({ data: { organizationId: org.id, ...auth.identity, shareProduction: shareProduction !== false } })
  return NextResponse.json(member, { status: existing ? 200 : 201 })
}
