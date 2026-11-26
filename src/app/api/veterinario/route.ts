import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { farmOverviews, requireVet, vetTasks } from '@/lib/vets'
import { animalToday } from '@/lib/animalRules'

// GET: painel do veterinário — o cadastro dele, as propriedades que atende (com os números de cada uma)
// as que já encerraram (com a cópia do que ele lançou), as próximas visitas da agenda e as tarefas de cada propriedade.
export async function GET() {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const { user, vet } = auth

  const links = await prisma.vetClient.findMany({
    where: { vetId: vet.id },
    include: { farm: { select: { id: true, name: true, owner: true, city: true, state: true, phone: true, isActive: true, segments: true } } },
    orderBy: { createdAt: 'desc' },
  })
  const active = links.filter((l) => l.status === 'ativo' && l.farm?.isActive)
  const farmIds = active.map((l) => l.farmId!)
  const [overviews, tasks, visits] = await Promise.all([
    farmOverviews(farmIds),
    vetTasks(farmIds),
    prisma.vetVisit.findMany({
      where: { vetId: vet.id, status: 'agendada', date: { gte: new Date(`${animalToday()}T00:00:00.000Z`) } },
      select: { id: true, clientId: true, farmName: true, date: true, time: true, purpose: true },
      orderBy: [{ date: 'asc' }, { time: 'asc' }],
      take: 10,
    }),
  ])

  return NextResponse.json({
    vet: { name: user.name, crmv: vet.crmv, city: vet.city, state: vet.state, inviteCode: vet.inviteCode },
    openFarmId: user.farmId,
    clients: active.map((l) => ({
      id: l.id,
      farmId: l.farmId,
      name: l.farm!.name,
      owner: l.farm!.owner,
      city: l.farm!.city,
      state: l.farm!.state,
      phone: l.farm!.phone,
      /** O que a propriedade faz (leite, cria, recria, engorda): o app mostra se é de leite ou de corte */
      segments: l.farm!.segments,
      createdByVet: l.createdByVet,
      since: l.createdAt,
      ...overviews.get(l.farmId!)!,
    })),
    visits,
    // O que fazer em cada propriedade (diagnósticos, partos, vacinas, tratamentos)
    tasks,
    ended: links.filter((l) => l.status === 'encerrado').map((l) => ({
      id: l.id,
      name: l.farmName,
      since: l.createdAt,
      endedAt: l.endedAt,
      records: Array.isArray(l.archive) ? l.archive.length : 0,
    })),
  })
}
