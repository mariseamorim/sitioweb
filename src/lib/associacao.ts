import { prisma } from '@/lib/prisma'
import { canEdit, type SessionUser } from '@/lib/auth'

// Associação: quem pode se associar, como o associado é identificado e a produção que ele compartilha

/**
 * Como o usuário entra numa associação: produtor do Anota Aí Leite pela própria conta,
 * produtor da versão completa pela propriedade (só quem pode editar decide).
 */
export function memberIdentity(user: SessionUser): { farmId: string } | { userId: string } | null {
  if (user.role === 'lite') return { userId: user.id }
  if (user.effectiveFarmId && !['fornecedor', 'laticinio', 'associacao', 'motorista'].includes(user.role)) return { farmId: user.effectiveFarmId }
  return null
}

export interface AssociationAlert { title: string; detail?: string }

/**
 * Novidades da associação para o associado: comunicado da última semana, evento nos próximos 7 dias,
 * visita técnica agendada para os próximos 7 dias e mensalidade atrasada.
 */
export async function associationAlerts(identity: { farmId: string } | { userId: string }, today: Date): Promise<AssociationAlert[]> {
  const weekAgo = new Date(today.getTime() - 7 * 864e5)
  const inWeek = new Date(today.getTime() + 7 * 864e5)
  const members = await prisma.orgMember.findMany({
    where: identity,
    select: {
      organization: {
        select: {
          name: true,
          notices: { where: { OR: [{ createdAt: { gte: weekAgo } }, { eventDate: { gte: today, lte: inWeek } }] }, orderBy: { createdAt: 'desc' }, take: 3 },
        },
      },
      visits: { where: { status: 'agendada', scheduledFor: { gte: today, lte: inWeek } }, take: 3 },
      fees: { where: { paidAt: null, dueDate: { lt: today } }, take: 3 },
    },
  })
  const fmt = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  return members.flatMap((m) => [
    ...m.organization.notices.map((n) => ({ title: `${m.organization.name}: ${n.title}`, detail: n.eventDate ? `Dia ${fmt(n.eventDate)}` : 'Comunicado novo' })),
    ...m.visits.map((v) => ({ title: `Visita técnica: ${v.subject}`, detail: `Dia ${fmt(v.scheduledFor!)}${v.technician ? ` com ${v.technician}` : ''}` })),
    ...m.fees.map((f) => ({ title: `Mensalidade atrasada: ${m.organization.name}`, detail: `Venceu em ${fmt(f.dueDate)}` })),
  ])
}

export const canManageMembership =(user: SessionUser) => user.role === 'lite' || canEdit(user)

/** Litros produzidos no período por associado que autorizou compartilhar */
export async function sharedProduction(members: { id: string; farmId: string | null; userId: string | null; shareProduction: boolean }[], from: Date, to: Date) {
  const shared = members.filter((m) => m.shareProduction)
  const farmIds = shared.flatMap((m) => (m.farmId ? [m.farmId] : []))
  const userIds = shared.flatMap((m) => (m.userId ? [m.userId] : []))
  const [farms, lite] = await Promise.all([
    farmIds.length
      ? prisma.milkProduction.groupBy({ by: ['farmId'], where: { farmId: { in: farmIds }, date: { gte: from, lte: to } }, _sum: { quantity: true } })
      : [],
    userIds.length
      ? prisma.milkEntry.findMany({
          where: { point: { ownerId: { in: userIds }, organizationId: null }, date: { gte: from, lte: to } },
          select: { liters: true, point: { select: { ownerId: true } } },
        })
      : [],
  ])
  const byFarm = new Map(farms.map((f) => [f.farmId, f._sum.quantity ?? 0]))
  const byUser = new Map<string, number>()
  for (const e of lite) byUser.set(e.point.ownerId, (byUser.get(e.point.ownerId) ?? 0) + e.liters)
  return new Map(shared.map((m) => [m.id, Math.round(((m.farmId ? byFarm.get(m.farmId) : byUser.get(m.userId!)) ?? 0) * 10) / 10]))
}
