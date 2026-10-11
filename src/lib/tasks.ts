import { prisma } from '@/lib/prisma'
import { visibleOffersWhere } from '@/lib/vendors'

// Tarefas do dia mostradas no sino de notificações da barra do topo

export type TaskTone = 'red' | 'amber' | 'blue'

export interface Task {
  title: string
  detail?: string
  href: string
  tone: TaskTone
}

const fmtDay = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })

export async function getTodayTasks(
  farmId: string,
  can: (module: string) => boolean,
  offersSeenAt: Date | null = null,
): Promise<Task[]> {
  // As datas são gravadas como meia-noite UTC do dia escolhido; "hoje" é o dia no horário de Brasília
  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
  const today = new Date(todayStr)
  const in7 = new Date(today); in7.setUTCDate(in7.getUTCDate() + 7)

  const [cows, milkToday, vaccines, births, supplies, treatments] = await Promise.all([
    can('leite')
      ? prisma.animal.count({ where: { farmId, species: 'Vaca', gender: 'Fêmea', status: { notIn: ['Morto', 'Vendido'] } } })
      : 0,
    can('leite') ? prisma.milkProduction.count({ where: { date: today, farmId } }) : 0,
    can('vacinacao')
      ? prisma.vaccination.findMany({
          where: { animal: { farmId }, appliedDate: null, scheduledDate: { lte: in7 } },
          include: { animal: { select: { name: true } } },
          orderBy: { scheduledDate: 'asc' },
          take: 5,
        })
      : [],
    can('reproducao')
      ? prisma.reproduction.findMany({
          where: { farmId, actualBirthDate: null, expectedBirthDate: { lte: in7 } },
          include: { female: { select: { name: true } } },
          orderBy: { expectedBirthDate: 'asc' },
          take: 5,
        })
      : [],
    can('estoque') ? prisma.supply.findMany({ where: { farmId }, select: { name: true, category: true, currentQuantity: true, minimumQuantity: true, unit: true } }) : [],
    can('veterinario')
      ? prisma.veterinaryTreatment.findMany({
          where: { animal: { farmId }, startDate: { lte: today }, endDate: { gte: today } },
          include: { animal: { select: { name: true } } },
          take: 5,
        })
      : [],
  ])

  const tasks: Task[] = []

  if (cows > 0 && milkToday === 0) {
    tasks.push({ title: 'Lançar a ordenha de hoje', detail: `${cows} vaca${cows > 1 ? 's' : ''} ativa${cows > 1 ? 's' : ''}`, href: '/milk-production', tone: 'blue' })
  }
  for (const v of vaccines) {
    const late = v.scheduledDate < today
    tasks.push({
      title: `Vacinar ${v.animal.name}: ${v.vaccineName}`,
      detail: late ? `Atrasada desde ${fmtDay(v.scheduledDate)}` : `Prevista para ${fmtDay(v.scheduledDate)}`,
      href: '/vacinacao',
      tone: late ? 'red' : 'amber',
    })
  }
  for (const b of births) {
    const date = b.expectedBirthDate!
    tasks.push({
      title: `Parto previsto: ${b.female.name}`,
      detail: date < today ? `Previsão era ${fmtDay(date)}. Registre o parto quando ocorrer` : `Previsto para ${fmtDay(date)}`,
      href: '/reproducao',
      tone: date < today ? 'red' : 'amber',
    })
  }
  for (const t of treatments) {
    tasks.push({ title: `Tratamento de ${t.animal.name}: ${t.medicine}`, detail: `Até ${fmtDay(t.endDate!)}`, href: '/veterinary-treatment', tone: 'blue' })
  }
  // Ofertas de fornecedores: as novas dos meus fornecedores e as que combinam com o estoque baixo
  const low = supplies.filter((s) => s.currentQuantity <= s.minimumQuantity)
  const offersWhere = await visibleOffersWhere(farmId)
  const lowCategories = [...new Set(low.map((s) => s.category))]
  const [newOffers, matchingOffers] = await Promise.all([
    prisma.promotion.count({
      where: { ...offersWhere, vendor: { status: 'aprovado', clients: { some: { farmId, muted: false } } }, ...(offersSeenAt ? { createdAt: { gt: offersSeenAt } } : {}) },
    }),
    lowCategories.length ? prisma.promotion.count({ where: { ...offersWhere, category: { in: lowCategories } } }) : 0,
  ])

  if (low.length > 0) {
    const items = low.slice(0, 3).map((s) => `${s.name} (${s.currentQuantity} ${s.unit})`).join(', ')
    tasks.push({
      title: low.length === 1 ? `Repor estoque: ${low[0].name}` : `Repor ${low.length} itens do estoque`,
      detail: matchingOffers ? `${items} · ${matchingOffers} oferta${matchingOffers > 1 ? 's' : ''} disponíve${matchingOffers > 1 ? 'is' : 'l'}` : items,
      href: matchingOffers ? '/ofertas' : '/estoque',
      tone: 'amber',
    })
  }
  if (newOffers > 0) {
    tasks.push({
      title: `${newOffers} oferta${newOffers > 1 ? 's' : ''} nova${newOffers > 1 ? 's' : ''} dos seus fornecedores`,
      href: '/ofertas',
      tone: 'blue',
    })
  }

  return tasks
}
