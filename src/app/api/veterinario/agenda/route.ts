import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireVet } from '@/lib/vets'
import { animalToday } from '@/lib/animalRules'
import { shiftDay, sortAgenda } from '@/lib/agenda'
import { AGENDA_DAYS, herdAgenda, visitAgenda } from '@/lib/agendaServer'

// GET: agenda do veterinário — as visitas dele e os manejos de todas as propriedades que atende
export async function GET() {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const today = animalToday()
  const until = shiftDay(today, AGENDA_DAYS)
  const links = await prisma.vetClient.findMany({
    where: { vetId: auth.vet.id, status: 'ativo', farm: { isActive: true } },
    select: { farmId: true },
  })
  const farmIds = links.map((l) => l.farmId!).filter(Boolean)
  const [herd, visits] = await Promise.all([herdAgenda(farmIds, today, until), visitAgenda({ vetId: auth.vet.id }, today, until)])
  return NextResponse.json({ today, items: sortAgenda([...herd, ...visits]) })
}
