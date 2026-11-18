// Veterinário consultor: uma conta de edição (role "editor") com cadastro de veterinário (VetProfile) que atende
// várias propriedades. Enquanto o vínculo está ativo ele é membro da propriedade (FarmMember), então a troca de
// propriedade e as telas de animais, reprodução, vacinas, tratamentos e leite funcionam como para o produtor.
// Ao encerrar, ele sai da propriedade e fica com uma cópia do que ele mesmo lançou, que não muda mais.
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

/** Módulos que o veterinário usa nas propriedades que atende (sem financeiro, estoque, usuários e cadastro da propriedade). */
export const VET_MODULES = ['animais', 'reproducao', 'vacinacao', 'veterinario', 'leite'] as const

/** Situações que contam como "ficou prenha" na taxa de prenhez (a perdida estava prenha quando foi diagnosticada). */
const PREGNANT = ['Prenha', 'Parida', 'Perdida']
const DAY = 24 * 60 * 60 * 1000

export function vetProfileOf(userId: string) {
  return prisma.vetProfile.findUnique({ where: { userId } })
}

export async function isVet(userId: string) {
  return !!(await prisma.vetProfile.findUnique({ where: { userId }, select: { id: true } }))
}

/** Garante que quem chama é um veterinário consultor. */
export async function requireVet() {
  const user = await getSessionUser()
  if (!user) return { error: NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 }) } as const
  const vet = await vetProfileOf(user.id)
  if (!vet) return { error: NextResponse.json({ error: 'Acesso restrito a veterinários' }, { status: 403 }) } as const
  return { user, vet } as const
}

export interface FarmOverview {
  animals: number
  /** Coberturas ainda sem diagnóstico de gestação */
  awaitingDiagnosis: number
  /** Prenhas sobre as diagnosticadas nos últimos 12 meses, em %; null sem nenhum diagnóstico */
  pregnancyRate: number | null
  /** Partos previstos para os próximos 30 dias */
  birthsSoon: number
}

/** Números de cada propriedade para o painel do veterinário. */
export async function farmOverviews(farmIds: string[]): Promise<Map<string, FarmOverview>> {
  const result = new Map<string, FarmOverview>()
  if (!farmIds.length) return result
  const now = Date.now()
  const [animals, reproductions] = await Promise.all([
    prisma.animal.groupBy({ by: ['farmId'], where: { farmId: { in: farmIds }, status: { in: ['Vivo', 'Doente'] } }, _count: { _all: true } }),
    prisma.reproduction.findMany({
      where: { farmId: { in: farmIds }, coverageDate: { gte: new Date(now - 365 * DAY) } },
      select: { farmId: true, status: true, expectedBirthDate: true, actualBirthDate: true },
    }),
  ])
  for (const id of farmIds) {
    const own = reproductions.filter((r) => r.farmId === id)
    const diagnosed = own.filter((r) => r.status !== 'Coberta')
    const pregnant = diagnosed.filter((r) => PREGNANT.includes(r.status))
    result.set(id, {
      animals: animals.find((a) => a.farmId === id)?._count._all ?? 0,
      awaitingDiagnosis: own.filter((r) => r.status === 'Coberta').length,
      pregnancyRate: diagnosed.length ? Math.round((pregnant.length / diagnosed.length) * 100) : null,
      birthsSoon: own.filter((r) => (r.status === 'Coberta' || r.status === 'Prenha') && !r.actualBirthDate && !!r.expectedBirthDate
        && r.expectedBirthDate.getTime() >= now - DAY && r.expectedBirthDate.getTime() <= now + 30 * DAY).length,
    })
  }
  return result
}

export interface ArchivedRecord {
  animal: string
  code: string
  coverageDate: string
  method: string | null
  maleName: string | null
  status: string
  expectedBirthDate: string | null
  actualBirthDate: string | null
  /** O veterinário anotou a cobertura */
  covered: boolean
  /** O veterinário deu o diagnóstico de gestação */
  diagnosed: boolean
  diagnosedAt: string | null
  observations: string | null
}

type Db = Prisma.TransactionClient | typeof prisma

/** Cópia do que o veterinário lançou na propriedade (coberturas que anotou e diagnósticos que deu). */
async function buildArchive(db: Db, vetUserId: string, farmId: string): Promise<ArchivedRecord[]> {
  const rows = await db.reproduction.findMany({
    where: { farmId, OR: [{ createdById: vetUserId }, { diagnosedById: vetUserId }] },
    include: { female: { select: { name: true, code: true, customCode: true } } },
    orderBy: { coverageDate: 'desc' },
  })
  const iso = (d: Date | null) => (d ? d.toISOString() : null)
  return rows.map((r) => ({
    animal: r.female.name,
    code: r.female.customCode || r.female.code,
    coverageDate: r.coverageDate.toISOString(),
    method: r.method,
    maleName: r.maleName,
    status: r.status,
    expectedBirthDate: iso(r.expectedBirthDate),
    actualBirthDate: iso(r.actualBirthDate),
    covered: r.createdById === vetUserId,
    diagnosed: r.diagnosedById === vetUserId,
    diagnosedAt: iso(r.diagnosedAt),
    observations: r.observations,
  }))
}

/**
 * Encerra o vínculo: guarda a cópia dos lançamentos do veterinário, tira o acesso dele à propriedade e, se ela era a
 * que estava aberta, abre outra das que ele atende (ou nenhuma).
 */
export async function endVetLink(clientId: string) {
  return prisma.$transaction(async (tx) => {
    const link = await tx.vetClient.findUnique({ where: { id: clientId }, include: { vet: { select: { userId: true } } } })
    if (!link || link.status !== 'ativo') return null
    const userId = link.vet.userId
    const archive = link.farmId ? await buildArchive(tx, userId, link.farmId) : []
    await tx.vetClient.update({ where: { id: clientId }, data: { status: 'encerrado', endedAt: new Date(), archive: archive as unknown as Prisma.InputJsonValue } })
    if (link.farmId) {
      await tx.farmMember.deleteMany({ where: { userId, farmId: link.farmId } })
      const other = await tx.farmMember.findFirst({ where: { userId, farm: { isActive: true } }, select: { farmId: true }, orderBy: { createdAt: 'asc' } })
      await tx.user.updateMany({ where: { id: userId, farmId: link.farmId }, data: { farmId: other?.farmId ?? null } })
    }
    return link
  })
}
