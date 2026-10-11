import { randomBytes } from 'crypto'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { todayUTC } from '@/lib/utils'

/** Ofertas novas que cada fornecedor pode publicar por semana (evita excesso de avisos) */
export const WEEKLY_OFFER_LIMIT = 3

const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0/O e 1/I, fáceis de confundir

export function newInviteCode(): string {
  return Array.from(randomBytes(8), (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('')
}

export async function lowStockCategories(farmId: string): Promise<string[]> {
  const supplies = await prisma.supply.findMany({
    where: { farmId },
    select: { category: true, currentQuantity: true, minimumQuantity: true },
  })
  return [...new Set(supplies.filter((s) => s.currentQuantity <= s.minimumQuantity).map((s) => s.category))]
}

/**
 * Ofertas que o produtor pode ver: as dos fornecedores dele (não silenciados) e as
 * regionais de fornecedores do mesmo estado. Sempre de fornecedor aprovado e dentro da validade.
 */
export async function visibleOffersWhere(farmId: string): Promise<Prisma.PromotionWhereInput> {
  const [farm, links] = await Promise.all([
    prisma.farm.findUnique({ where: { id: farmId }, select: { state: true } }),
    prisma.vendorClient.findMany({ where: { farmId }, select: { vendorId: true, muted: true } }),
  ])
  const linked = links.filter((l) => !l.muted).map((l) => l.vendorId)
  const muted = links.filter((l) => l.muted).map((l) => l.vendorId)

  const reach: Prisma.PromotionWhereInput[] = [{ vendorId: { in: linked } }]
  if (farm?.state) {
    reach.push({
      reach: 'regiao',
      vendorId: { notIn: muted },
      vendor: { state: { equals: farm.state.trim(), mode: 'insensitive' } },
    })
  }

  return {
    isActive: true,
    validUntil: { gte: todayUTC() },
    vendor: { status: 'aprovado' },
    OR: reach,
  }
}
