import { prisma } from '@/lib/prisma'
import { buildAgenda, shiftDay, sortAgenda, type AgendaItem } from '@/lib/agenda'

// Agenda montada no servidor: os registros das propriedades viram itens com data (regra em src/lib/agenda.ts)

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null)
const midnight = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

export interface AgendaAccess { vacinas: boolean; reproducao: boolean; carencia: boolean }
export const FULL_ACCESS: AgendaAccess = { vacinas: true, reproducao: true, carencia: true }

/** Manejos das propriedades entre os atrasados e `until` */
export async function herdAgenda(farmIds: string[], today: string, until: string, access: AgendaAccess = FULL_ACCESS): Promise<AgendaItem[]> {
  if (!farmIds.length) return []
  const farms = { farmId: { in: farmIds } }
  const [farmRows, animals, reproductions, vaccinations, treatments, doneRows] = await Promise.all([
    prisma.farm.findMany({ where: { id: { in: farmIds } }, select: { id: true, name: true, segments: true } }),
    prisma.animal.findMany({ where: { ...farms, status: { notIn: ['Morto', 'Vendido'] } }, select: { id: true, farmId: true, name: true, code: true, customCode: true, species: true, motherId: true } }),
    access.reproducao
      ? prisma.reproduction.findMany({ where: { ...farms, actualBirthDate: null, status: { in: ['Coberta', 'Prenha'] } }, select: { id: true, farmId: true, femaleId: true, coverageDate: true, status: true, expectedBirthDate: true, actualBirthDate: true } })
      : [],
    access.vacinas
      ? prisma.vaccination.findMany({ where: { animal: farms, appliedDate: null, scheduledDate: { lte: midnight(until) } }, select: { id: true, animalId: true, vaccineName: true, scheduledDate: true, appliedDate: true, animal: { select: { farmId: true } } } })
      : [],
    access.carencia
      ? prisma.veterinaryTreatment.findMany({
          where: { animal: farms, OR: [{ milkWithdrawalDays: { not: null } }, { meatWithdrawalDays: { not: null } }], startDate: { gte: midnight(shiftDay(today, -365)) } },
          select: { id: true, animalId: true, medicine: true, startDate: true, endDate: true, milkWithdrawalDays: true, meatWithdrawalDays: true, animal: { select: { farmId: true } } },
        })
      : [],
    prisma.agendaDone.findMany({ where: farms, select: { farmId: true, key: true } }),
  ])
  // Sem segmento definido, a propriedade conta como de leite (como nas tarefas do dia)
  return sortAgenda(farmRows.flatMap((farm) => buildAgenda({
    today, until,
    dairy: !farm.segments.length || farm.segments.includes('leite'),
    farmId: farm.id, farmName: farm.name,
    done: doneRows.filter((d) => d.farmId === farm.id).map((d) => d.key),
    animals: animals.filter((a) => a.farmId === farm.id).map((a) => ({ id: a.id, name: a.name, code: a.customCode ?? a.code, species: a.species, motherId: a.motherId })),
    reproductions: reproductions.filter((r) => r.farmId === farm.id).map((r) => ({ ...r, coverageDate: day(r.coverageDate)!, expectedBirthDate: day(r.expectedBirthDate), actualBirthDate: day(r.actualBirthDate) })),
    vaccinations: vaccinations.filter((v) => v.animal.farmId === farm.id).map((v) => ({ ...v, scheduledDate: day(v.scheduledDate)!, appliedDate: day(v.appliedDate) })),
    treatments: treatments.filter((t) => t.animal.farmId === farm.id).map((t) => ({ ...t, startDate: day(t.startDate)!, endDate: day(t.endDate) })),
  })))
}

/** Visitas marcadas (atrasadas há até 30 dias e as próximas até `until`), como itens da agenda */
export async function visitAgenda(where: { vetId: string } | { farmId: string }, today: string, until: string): Promise<AgendaItem[]> {
  const visits = await prisma.vetVisit.findMany({
    where: {
      status: 'agendada',
      date: { gte: midnight(shiftDay(today, -30)), lte: midnight(until) },
      ...('vetId' in where ? { vetId: where.vetId } : { client: { farmId: where.farmId, status: 'ativo' } }),
    },
    select: { id: true, date: true, time: true, purpose: true, farmName: true, client: { select: { id: true, farmId: true } }, vet: { select: { user: { select: { name: true } } } } },
  })
  const forVet = 'vetId' in where
  return visits.map((v): AgendaItem => {
    const date = day(v.date)!
    return {
      key: `visita:${v.id}`,
      kind: 'visita' as const,
      date,
      late: date < today,
      time: v.time,
      label: forVet ? 'Visita: {farm}' : 'Visita do veterinário {vet}',
      vars: (forVet ? { farm: v.farmName } : { vet: v.vet.user.name }) as Record<string, string>,
      ...(v.purpose ? { detail: v.purpose } : {}),
      refId: v.id,
      farmId: v.client?.farmId ?? undefined,
      farmName: v.farmName,
    }
  })
}

/** Quantos dias a agenda mostra para a frente */
export const AGENDA_DAYS = 62
