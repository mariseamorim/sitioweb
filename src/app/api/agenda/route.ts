import { NextResponse } from 'next/server'
import { canAccessModule, getSessionUser } from '@/lib/auth'
import { animalToday } from '@/lib/animalRules'
import { shiftDay, sortAgenda } from '@/lib/agenda'
import { AGENDA_DAYS, herdAgenda, visitAgenda } from '@/lib/agendaServer'

// GET: agenda da propriedade aberta — manejos do rebanho (pelos módulos que a pessoa vê) e as visitas do veterinário
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const today = animalToday()
  const farmId = user.effectiveFarmId
  if (!farmId) return NextResponse.json({ today, items: [] })
  const can = (m: string) => canAccessModule(user, m)
  const until = shiftDay(today, AGENDA_DAYS)
  const [herd, visits] = await Promise.all([
    herdAgenda([farmId], today, until, { vacinas: can('vacinacao'), reproducao: can('reproducao'), carencia: can('veterinario') || can('leite') }),
    visitAgenda({ farmId }, today, until),
  ])
  // Uma propriedade só: o nome dela não precisa aparecer em cada item
  return NextResponse.json({ today, items: sortAgenda([...herd, ...visits]).map((item) => ({ ...item, farmName: undefined })) })
}
