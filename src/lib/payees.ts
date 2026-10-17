import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/lib/auth'
import { FARM_POINT_ID, type LitePayee, type LiteSplit, isDriverRole, usesFarmMode } from '@/lib/lite'

// Nomes da nota: no Anota Aí Leite ficam no local do produtor; na versão completa, na propriedade.
// O motorista não tem nomes (anota a rota do laticínio).

export const MAX_PAYEES = 10

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

/** Onde os nomes do usuário ficam: propriedade (versão completa) ou os locais dele (lite) */
export async function payeeScope(user: SessionUser): Promise<{ farmId: string } | { pointIds: string[] } | null> {
  if (isDriverRole(user.role)) return null
  if (usesFarmMode(user)) return { farmId: user.effectiveFarmId! }
  const points = await prisma.milkPoint.findMany({ where: { ownerId: user.id, organizationId: null }, select: { id: true } })
  return { pointIds: points.map((p) => p.id) }
}

export const scopeWhere = (scope: { farmId: string } | { pointIds: string[] }) =>
  'farmId' in scope ? { farmId: scope.farmId } : { pointId: { in: scope.pointIds } }

export function toLitePayee(p: { id: string; pointId: string | null; farmId: string | null; name: string; producerCode: string | null; sequence: string | null; active: boolean; position: number }): LitePayee {
  return { id: p.id, pointId: p.pointId ?? FARM_POINT_ID, name: p.name, producerCode: p.producerCode, sequence: p.sequence, active: p.active, position: p.position }
}

/** Nomes e divisões do usuário desde uma data (para a tela carregar tudo de uma vez) */
export async function loadPayees(user: SessionUser, since: Date): Promise<{ payees: LitePayee[]; splits: LiteSplit[] }> {
  const scope = await payeeScope(user)
  if (!scope) return { payees: [], splits: [] }
  const payees = await prisma.milkPayee.findMany({ where: scopeWhere(scope), orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })
  const splits = payees.length
    ? await prisma.milkSplit.findMany({ where: { payeeId: { in: payees.map((p) => p.id) }, date: { gte: since } }, select: { payeeId: true, date: true, liters: true } })
    : []
  return { payees: payees.map(toLitePayee), splits: splits.map((s) => ({ payeeId: s.payeeId, date: isoDay(s.date), liters: s.liters })) }
}

export const cleanName = (v: unknown) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, 80)
export const cleanCode = (v: unknown) => { const s = String(v ?? '').trim().slice(0, 20); return s || null }
