// Veterinário consultor: uma conta de edição (role "editor") com cadastro de veterinário (VetProfile) que atende
// várias propriedades. Enquanto o vínculo está ativo ele é membro da propriedade (FarmMember), então a troca de
// propriedade e as telas de animais, reprodução, vacinas, tratamentos e leite funcionam como para o produtor.
// Ao encerrar, ele sai da propriedade e fica com uma cópia do que ele mesmo lançou, que não muda mais.
import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { regionOrNull } from '@/lib/identity'
import { addFarmMember } from '@/lib/farms'
import { getSessionUser } from '@/lib/auth'
import { animalToday } from '@/lib/animalRules'
import { pregnancyChecks } from '@/lib/calving'
import { prepRange, prepSteps } from '@/lib/calvingPrep'
import { addMonths } from '@/lib/reproInsights'

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
  /** Vacas prenhes agora (diagnóstico Prenha, sem parto anotado) */
  pregnant: number
  /** Partos previstos por mês ("AAAA-MM"): o mês atual e os 5 seguintes, para o gráfico do painel */
  birthsByMonth: { month: string; count: number }[]
}

/** Números de cada propriedade para o painel do veterinário. */
/** `rateMonths`: janela da taxa de concepção (meses de cobertura, contando o atual); o resto usa os últimos 12 meses. */
export async function farmOverviews(farmIds: string[], rateMonths = 12): Promise<Map<string, FarmOverview>> {
  const result = new Map<string, FarmOverview>()
  if (!farmIds.length) return result
  const now = Date.now()
  const current = new Date(now).toISOString().slice(0, 7)
  const months = Array.from({ length: 6 }, (_, i) => addMonths(current, i))
  const [animals, reproductions] = await Promise.all([
    prisma.animal.groupBy({ by: ['farmId'], where: { farmId: { in: farmIds }, status: { in: ['Vivo', 'Doente'] } }, _count: { _all: true } }),
    prisma.reproduction.findMany({
      where: { farmId: { in: farmIds }, coverageDate: { gte: new Date(now - 365 * DAY) } },
      select: { farmId: true, status: true, coverageDate: true, expectedBirthDate: true, actualBirthDate: true },
    }),
  ])
  const rateFrom = Math.max(now - 365 * DAY, new Date(`${addMonths(current, 1 - rateMonths)}-01T00:00:00.000Z`).getTime())
  for (const id of farmIds) {
    const own = reproductions.filter((r) => r.farmId === id)
    const diagnosed = own.filter((r) => r.status !== 'Coberta' && r.coverageDate.getTime() >= rateFrom)
    const pregnant = diagnosed.filter((r) => PREGNANT.includes(r.status))
    const open = own.filter((r) => (r.status === 'Coberta' || r.status === 'Prenha') && !r.actualBirthDate && !!r.expectedBirthDate)
    result.set(id, {
      animals: animals.find((a) => a.farmId === id)?._count._all ?? 0,
      awaitingDiagnosis: own.filter((r) => r.status === 'Coberta').length,
      pregnancyRate: diagnosed.length ? Math.round((pregnant.length / diagnosed.length) * 100) : null,
      birthsSoon: own.filter((r) => (r.status === 'Coberta' || r.status === 'Prenha') && !r.actualBirthDate && !!r.expectedBirthDate
        && r.expectedBirthDate.getTime() >= now - DAY && r.expectedBirthDate.getTime() <= now + 30 * DAY).length,
      pregnant: own.filter((r) => r.status === 'Prenha' && !r.actualBirthDate).length,
      birthsByMonth: months.map((month) => ({ month, count: open.filter((r) => r.expectedBirthDate!.toISOString().startsWith(month)).length })),
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

/** Dias depois da cobertura a partir dos quais já dá para diagnosticar a gestação (como em /reproducao/diagnostico) */
const DIAGNOSIS_DAYS = 28

export interface VetTask {
  farmId: string
  /** Texto em português com {n}; a tela traduz com t(title, { n }) */
  title: string
  detail?: string
  n: number
  /** Quantos já passaram da data (vai no detalhe) */
  late?: number
  /** Tela da propriedade que resolve a tarefa */
  href: string
  tone: 'red' | 'amber' | 'blue'
}

/**
 * O que o veterinário tem a fazer nas propriedades que atende: gestações a diagnosticar, partos e vacinas da semana,
 * vacas paridas sem diagnóstico e tratamentos em andamento. Uma linha por assunto e por propriedade.
 */
export async function vetTasks(farmIds: string[]): Promise<VetTask[]> {
  if (!farmIds.length) return []
  const todayStr = animalToday()
  const today = new Date(`${todayStr}T00:00:00.000Z`)
  const in7 = new Date(today.getTime() + 7 * DAY)
  const diagnosable = new Date(today.getTime() - DIAGNOSIS_DAYS * DAY)
  const farms = { farmId: { in: farmIds } }
  const range = prepRange(todayStr)
  const [covered, births, vaccines, treatments, herd, reproductions, upcoming, farmSegments] = await Promise.all([
    prisma.reproduction.groupBy({ by: ['farmId'], where: { ...farms, status: 'Coberta', coverageDate: { lte: diagnosable } }, _count: { _all: true } }),
    prisma.reproduction.findMany({ where: { ...farms, actualBirthDate: null, status: { in: ['Coberta', 'Prenha'] }, expectedBirthDate: { lte: in7 } }, select: { farmId: true, expectedBirthDate: true } }),
    prisma.vaccination.findMany({ where: { animal: farms, appliedDate: null, scheduledDate: { lte: in7 } }, select: { scheduledDate: true, animal: { select: { farmId: true } } } }),
    prisma.veterinaryTreatment.findMany({ where: { animal: farms, startDate: { lte: today }, endDate: { gte: today } }, select: { animal: { select: { farmId: true } } } }),
    prisma.animal.findMany({ where: farms, select: { id: true, farmId: true, code: true, name: true, species: true, gender: true, status: true, birthDate: true, motherId: true } }),
    prisma.reproduction.findMany({ where: farms, select: { id: true, farmId: true, femaleId: true, coverageDate: true, status: true } }),
    // Partos previstos que podem pedir secagem ou pré-parto hoje
    prisma.reproduction.findMany({
      where: { ...farms, actualBirthDate: null, status: { in: ['Coberta', 'Prenha'] }, expectedBirthDate: { gte: new Date(`${range.from}T00:00:00.000Z`), lte: new Date(`${range.to}T00:00:00.000Z`) } },
      select: { farmId: true, femaleId: true, expectedBirthDate: true },
    }),
    prisma.farm.findMany({ where: { id: { in: farmIds } }, select: { id: true, segments: true } }),
  ])
  // Secagem só para quem já pariu (vaca em lactação), em propriedade de leite (ou sem segmento definido)
  const mothers = new Set(herd.map((a) => a.motherId).filter(Boolean))
  const speciesOf = new Map(herd.map((a) => [a.id, a.species]))
  const dairy = new Set(farmSegments.filter((f) => !f.segments.length || f.segments.includes('leite')).map((f) => f.id))

  const tasks: VetTask[] = []
  for (const farmId of farmIds) {
    const diagnose = covered.find((c) => c.farmId === farmId)?._count._all ?? 0
    if (diagnose) tasks.push({ farmId, n: diagnose, title: diagnose === 1 ? '{n} vaca para diagnosticar' : '{n} vacas para diagnosticar', detail: 'Cobertas há mais de 28 dias', href: '/reproducao/diagnostico', tone: 'amber' })

    const own = births.filter((b) => b.farmId === farmId)
    const lateBirths = own.filter((b) => b.expectedBirthDate! < today).length
    if (own.length) tasks.push({ farmId, n: own.length, late: lateBirths, title: own.length === 1 ? '{n} parto previsto até a semana que vem' : '{n} partos previstos até a semana que vem', href: '/reproducao?filtro=partos', tone: lateBirths ? 'red' : 'amber' })

    const steps = upcoming.filter((r) => r.farmId === farmId).flatMap((r) => prepSteps(r.expectedBirthDate!.toISOString(), todayStr,
      dairy.has(farmId) && (mothers.has(r.femaleId) || speciesOf.get(r.femaleId) === 'Vaca')))
    const dry = steps.filter((s) => s.kind === 'secagem')
    const lateDry = dry.filter((s) => s.late).length
    if (dry.length) tasks.push({ farmId, n: dry.length, late: lateDry, title: dry.length === 1 ? '{n} vaca para secar' : '{n} vacas para secar', detail: '60 dias antes do parto previsto', href: '/reproducao?filtro=partos', tone: lateDry ? 'red' : 'amber' })
    const pre = steps.filter((s) => s.kind === 'preparto')
    const latePre = pre.filter((s) => s.late).length
    if (pre.length) tasks.push({ farmId, n: pre.length, late: latePre, title: pre.length === 1 ? '{n} vaca para o pré-parto' : '{n} vacas para o pré-parto', detail: '21 dias antes do parto previsto', href: '/reproducao?filtro=partos', tone: latePre ? 'red' : 'amber' })

    const shots = vaccines.filter((v) => v.animal.farmId === farmId)
    const lateShots = shots.filter((v) => v.scheduledDate! < today).length
    if (shots.length) tasks.push({ farmId, n: shots.length, late: lateShots, title: shots.length === 1 ? '{n} vacina para aplicar' : '{n} vacinas para aplicar', href: '/vacinacao?filtro=pendentes', tone: lateShots ? 'red' : 'amber' })

    // Paridas há mais de 2 meses sem cobertura nem diagnóstico (as cobertas já entram em "para diagnosticar")
    const checks = pregnancyChecks(herd.filter((a) => a.farmId === farmId), reproductions.filter((r) => r.farmId === farmId)).filter((c) => !c.openCoverage)
    if (checks.length) tasks.push({ farmId, n: checks.length, title: checks.length === 1 ? '{n} vaca parida sem diagnóstico' : '{n} vacas paridas sem diagnóstico', detail: 'Pariram há mais de 2 meses', href: '/reproducao#confirmar-prenhez', tone: 'amber' })

    const care = treatments.filter((t) => t.animal.farmId === farmId).length
    if (care) tasks.push({ farmId, n: care, title: care === 1 ? '{n} tratamento em andamento' : '{n} tratamentos em andamento', href: '/veterinary-treatment', tone: 'blue' })
  }
  return tasks
}

/**
 * Propriedade de um cliente que ainda não usa o sistema, cadastrada pelo veterinário (ele passa a atendê-la;
 * o produtor pode receber o acesso depois). Usada no cadastro de propriedade e no de animal ("fazenda não cadastrada").
 */
export async function createClientFarm(user: { id: string; farmId: string | null; isDemo: boolean }, vetId: string, data: { name: string; owner?: unknown; phone?: unknown; city?: unknown; state?: unknown }) {
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  return prisma.$transaction(async (tx) => {
    const farm = await tx.farm.create({
      data: { name: data.name.trim(), owner: text(data.owner), phone: text(data.phone), city: text(data.city), state: regionOrNull(data.state), isDemo: user.isDemo },
    })
    await addFarmMember(tx, user.id, farm.id)
    // Sem nenhuma propriedade aberta, esta já fica aberta
    if (!user.farmId) await tx.user.update({ where: { id: user.id }, data: { farmId: farm.id } })
    return tx.vetClient.create({ data: { vetId, farmId: farm.id, farmName: farm.name, createdByVet: true } })
  })
}
