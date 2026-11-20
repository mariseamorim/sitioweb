import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAccessModule, requireFarmAccess } from '@/lib/auth'
import { animalToday, isBovine, validAnimalDate } from '@/lib/animalRules'
import { vetProfileOf } from '@/lib/vets'
import { text } from '@/lib/vetInput'

const DAY = 24 * 60 * 60 * 1000
/** A vaca seca 60 dias antes do parto e entra no lote de pré-parto 21 dias antes */
const DRY_DAYS = 60
const PRE_CALVING_DAYS = 21
/** Até quantos dias à frente os manejos entram no relatório */
const AHEAD_DAYS = 45
/** Antes disso o toque ou o ultrassom ainda não confirmam a gestação */
const MIN_DIAGNOSIS_DAYS = 28

const label = (a: { name: string; code: string; customCode: string | null }) => ({ animal: a.name, code: a.customCode || a.code })

// GET ?data=AAAA-MM-DD: relatório de visita da propriedade aberta — o que foi feito no dia (diagnósticos, coberturas,
// vacinas e tratamentos) e o que vem pela frente (secagens, pré-partos, partos, diagnósticos e vacinas).
// Traz também a visita do dia, com as recomendações que o veterinário deixou.
export async function GET(request: NextRequest) {
  const auth = await requireFarmAccess('reproducao', 'view')
  if (auth.error) return auth.error
  const date = validAnimalDate(request.nextUrl.searchParams.get('data')) ?? animalToday()
  const start = new Date(`${date}T00:00:00.000Z`)
  const end = new Date(start.getTime() + DAY)
  // "No dia" para o que tem hora (diagnóstico): o dia no horário de Brasília
  const localStart = new Date(start.getTime() + 3 * 60 * 60 * 1000)
  const localEnd = new Date(localStart.getTime() + DAY)
  const ahead = new Date(start.getTime() + AHEAD_DAYS * DAY)
  const female = { select: { name: true, code: true, customCode: true, species: true } }
  const animal = { select: { name: true, code: true, customCode: true } }
  const farmId = auth.farmId
  const vet = await vetProfileOf(auth.user.id)

  const [farm, diagnosed, covered, open, vaccinesDone, treatments, vaccinesDue, visit] = await Promise.all([
    prisma.farm.findUnique({ where: { id: farmId }, select: { name: true, owner: true, city: true, state: true } }),
    prisma.reproduction.findMany({ where: { farmId, diagnosedAt: { gte: localStart, lt: localEnd }, status: { in: ['Prenha', 'Vazia'] } }, include: { female }, orderBy: { diagnosedAt: 'asc' } }),
    prisma.reproduction.findMany({ where: { farmId, coverageDate: { gte: start, lt: end } }, include: { female } }),
    prisma.reproduction.findMany({ where: { farmId, status: { in: ['Coberta', 'Prenha'] }, actualBirthDate: null }, include: { female }, orderBy: { coverageDate: 'asc' } }),
    canAccessModule(auth.user, 'vacinacao') ? prisma.vaccination.findMany({ where: { animal: { farmId }, appliedDate: { gte: start, lt: end } }, include: { animal } }) : [],
    canAccessModule(auth.user, 'veterinario') ? prisma.veterinaryTreatment.findMany({ where: { animal: { farmId }, startDate: { gte: start, lt: end } }, include: { animal } }) : [],
    canAccessModule(auth.user, 'vacinacao') ? prisma.vaccination.findMany({ where: { animal: { farmId }, appliedDate: null, scheduledDate: { lte: ahead } }, include: { animal }, orderBy: { scheduledDate: 'asc' }, take: 60 }) : [],
    // Veterinário: a visita dele. Produtor: a visita que algum veterinário fez na propriedade nesse dia
    prisma.vetVisit.findFirst({
      where: { ...(vet ? { vetId: vet.id } : {}), client: { farmId }, date: start, status: { not: 'cancelada' } },
      include: { vet: { select: { crmv: true, user: { select: { name: true, phone: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
  ])

  // Manejos que vêm: cada prenhez em aberto gera secagem, pré-parto e parto; entram os que caem até AHEAD_DAYS
  const upcoming: { type: 'secagem' | 'pre-parto' | 'parto'; date: string; animal: string; code: string }[] = []
  for (const r of open) {
    if (!r.expectedBirthDate) continue
    const birth = r.expectedBirthDate.getTime()
    const events = [
      ...(isBovine(r.female.species) ? [['secagem', birth - DRY_DAYS * DAY], ['pre-parto', birth - PRE_CALVING_DAYS * DAY]] as const : []),
      ['parto', birth] as const,
    ]
    for (const [type, when] of events) {
      if (when >= start.getTime() && when <= ahead.getTime()) upcoming.push({ type, date: new Date(when).toISOString(), ...label(r.female) })
    }
  }
  upcoming.sort((a, b) => a.date.localeCompare(b.date))

  return NextResponse.json({
    date,
    farm,
    vet: vet ? { name: auth.user.name, crmv: vet.crmv, phone: auth.user.phone } : visit ? { name: visit.vet.user.name, crmv: visit.vet.crmv, phone: visit.vet.user.phone } : null,
    visit: visit ? { id: visit.id, purpose: visit.purpose, notes: visit.notes } : null,
    done: {
      diagnoses: diagnosed.map((r) => ({ ...label(r.female), result: r.status, expectedBirthDate: r.status === 'Prenha' ? r.expectedBirthDate : null })),
      coverages: covered.map((r) => ({ ...label(r.female), method: r.method, maleName: r.maleName })),
      vaccines: vaccinesDone.map((v) => ({ ...label(v.animal), vaccine: v.vaccineName })),
      treatments: treatments.map((t) => ({ ...label(t.animal), medicine: t.medicine, milkWithdrawalDays: t.milkWithdrawalDays })),
    },
    upcoming,
    toDiagnose: open.filter((r) => r.status === 'Coberta' && (start.getTime() - r.coverageDate.getTime()) / DAY >= MIN_DIAGNOSIS_DAYS)
      .map((r) => ({ ...label(r.female), coverageDate: r.coverageDate, days: Math.floor((start.getTime() - r.coverageDate.getTime()) / DAY) })),
    vaccinesDue: vaccinesDue.map((v) => ({ ...label(v.animal), vaccine: v.vaccineName, date: v.scheduledDate, late: v.scheduledDate < start })),
  })
}

// PUT { date, notes }: o veterinário guarda as recomendações da visita do dia. Se a visita estava na agenda, fica como
// realizada; se não estava, é criada já realizada.
export async function PUT(request: NextRequest) {
  const auth = await requireFarmAccess('reproducao', 'edit')
  if (auth.error) return auth.error
  const vet = await vetProfileOf(auth.user.id)
  if (!vet) return NextResponse.json({ error: 'Só o veterinário anota as recomendações da visita' }, { status: 403 })
  const body = await request.json()
  const iso = validAnimalDate(body.date)
  if (!iso) return NextResponse.json({ error: 'Informe o dia da visita' }, { status: 400 })
  const date = new Date(`${iso}T00:00:00.000Z`)
  const client = await prisma.vetClient.findFirst({ where: { vetId: vet.id, farmId: auth.farmId, status: 'ativo' }, include: { farm: { select: { name: true } } } })
  if (!client) return NextResponse.json({ error: 'Você não atende esta propriedade' }, { status: 403 })

  const notes = text(body.notes, 4000)
  const existing = await prisma.vetVisit.findFirst({ where: { vetId: vet.id, clientId: client.id, date, status: { not: 'cancelada' } }, orderBy: { createdAt: 'desc' } })
  const visit = existing
    ? await prisma.vetVisit.update({ where: { id: existing.id }, data: { notes, status: 'realizada' } })
    : await prisma.vetVisit.create({ data: { vetId: vet.id, clientId: client.id, farmName: client.farm?.name ?? client.farmName, date, status: 'realizada', notes } })
  return NextResponse.json({ id: visit.id, purpose: visit.purpose, notes: visit.notes })
}
