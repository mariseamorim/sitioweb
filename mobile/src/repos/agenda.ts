import { all } from '@/db'
import { buildAgenda, shiftDay, type AgendaItem, type AgendaReproduction, type AgendaTreatment, type AgendaVaccination } from '@/lib/agenda'
import { getFarm } from '@/repos/farms'

// Agenda da propriedade aberta montada com o que está guardado no celular (funciona sem internet).
// Regra em src/lib/agenda.ts; o servidor faz o mesmo em src/lib/agendaServer.ts do site.

/** Quantos dias a agenda mostra para a frente (como no site) */
export const AGENDA_DAYS = 62

export function localAgenda(farmId: string, today: string, can: (module: string) => boolean): AgendaItem[] {
  const farm = getFarm(farmId)
  // Sem segmento definido, a propriedade conta como de leite (como no servidor)
  const dairy = !farm?.segments.length || farm.segments.includes('leite')
  const animals = all<{ id: string; name: string | null; code: string | null; customCode: string | null; species: string; motherId: string | null }>(
    "SELECT id, name, code, customCode, species, motherId FROM animals WHERE farmId = ? AND (status IS NULL OR status NOT IN ('Morto', 'Vendido'))", [farmId],
  ).map(a => ({ id: a.id, name: a.name, code: a.customCode ?? a.code, species: a.species, motherId: a.motherId }))
  return buildAgenda({
    today,
    until: shiftDay(today, AGENDA_DAYS),
    dairy,
    animals,
    reproductions: can('reproducao')
      ? all<AgendaReproduction>("SELECT id, femaleId, coverageDate, status, expectedBirthDate, actualBirthDate FROM reproductions WHERE farmId = ? AND actualBirthDate IS NULL AND status IN ('Coberta', 'Prenha')", [farmId])
      : [],
    vaccinations: can('vacinacao')
      ? all<AgendaVaccination>('SELECT id, animalId, vaccineName, scheduledDate, appliedDate FROM vaccinations WHERE farmId = ? AND appliedDate IS NULL', [farmId])
      : [],
    treatments: can('veterinario') || can('leite')
      ? all<AgendaTreatment>('SELECT id, animalId, medicine, startDate, endDate, milkWithdrawalDays, meatWithdrawalDays FROM treatments WHERE farmId = ? AND (milkWithdrawalDays IS NOT NULL OR meatWithdrawalDays IS NOT NULL)', [farmId])
      : [],
  })
}
