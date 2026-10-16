import { prisma } from '@/lib/prisma'
import { visibleOffersWhere } from '@/lib/vendors'
import { BOVINE_CATEGORIES, canAddCalf } from '@/lib/animalRules'
import { monthsLabel, pregnancyChecks } from '@/lib/calving'
import { associationAlerts } from '@/lib/associacao'
import { supplyDailyUse, withDailyUse } from '@/lib/lotUsage'
import { STOCK_WARNING_DAYS } from '@/lib/lots'
import { activeWithdrawals } from '@/lib/withdrawal'

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
      ? prisma.animal.findMany({ where: { farmId, species: { in: BOVINE_CATEGORIES }, gender: 'Fêmea', status: { notIn: ['Morto', 'Vendido'] } }, select: { species: true, gender: true, birthDate: true } }).then(animals => animals.filter(a => canAddCalf(a, todayStr)).length)
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
          where: { farmId, actualBirthDate: null, status: { in: ['Coberta', 'Prenha'] }, expectedBirthDate: { lte: in7 } },
          include: { female: { select: { name: true } } },
          orderBy: { expectedBirthDate: 'asc' },
          take: 5,
        })
      : [],
    can('estoque') ? prisma.supply.findMany({ where: { farmId }, select: { id: true, name: true, category: true, currentQuantity: true, minimumQuantity: true, unit: true, packageKg: true } }) : [],
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
  // Confirmar prenhez: a partir da 1ª cria, 2 meses depois do parto, enquanto não houver prenha/vazia anotada
  if (can('reproducao')) {
    const [herd, reproductions] = await Promise.all([
      prisma.animal.findMany({
        where: { farmId },
        select: { id: true, code: true, name: true, species: true, gender: true, status: true, birthDate: true, motherId: true },
      }),
      prisma.reproduction.findMany({ where: { farmId }, select: { id: true, femaleId: true, coverageDate: true, status: true } }),
    ])
    const checks = pregnancyChecks(herd, reproductions)
    for (const c of checks.slice(0, 3)) {
      tasks.push({
        title: `Confirmar prenhez: ${c.cow.name}`,
        detail: `Pariu em ${fmtDay(new Date(c.lastCalving))}, há ${monthsLabel(Math.floor(c.daysSince / 30.44))}`,
        href: '/reproducao#confirmar-prenhez',
        tone: 'amber',
      })
    }
    if (checks.length > 3) {
      tasks.push({ title: `Confirmar prenhez de mais ${checks.length - 3} vaca${checks.length - 3 > 1 ? 's' : ''}`, href: '/reproducao#confirmar-prenhez', tone: 'amber' })
    }
  }
  // Associação: comunicados, eventos, visitas agendadas e mensalidade atrasada
  for (const a of await associationAlerts({ farmId }, today)) {
    tasks.push({ title: a.title, detail: a.detail, href: '/lite/associacao', tone: a.title.startsWith('Mensalidade') ? 'red' : 'blue' })
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
  // Carência de medicamento: leite fora do tanque (vermelho) e animal fora do abate
  if (can('leite') || can('veterinario') || can('animais')) {
    for (const w of await activeWithdrawals(farmId, today)) {
      const until = (iso: string) => fmtDay(new Date(iso))
      if (w.milkUntil && (can('leite') || can('veterinario'))) {
        tasks.push({ title: `Leite de ${w.animalName} fora do tanque até ${until(w.milkUntil)}`, detail: `Carência de ${w.medicine}`, href: '/veterinary-treatment', tone: 'red' })
      }
      if (w.meatUntil && (can('animais') || can('veterinario'))) {
        tasks.push({ title: `${w.animalName} não pode ir para o abate até ${until(w.meatUntil)}`, detail: `Carência de ${w.medicine}`, href: '/veterinary-treatment', tone: 'amber' })
      }
    }
  }
  // Suplemento dos lotes que acaba logo (ainda acima do mínimo; abaixo dele já entra em "Repor estoque")
  if (supplies.length) {
    const use = await supplyDailyUse(farmId)
    const ending = supplies.filter((s) => s.currentQuantity > s.minimumQuantity).map((s) => withDailyUse(s, use))
      .filter((s) => s.daysLeft !== null && s.daysLeft <= STOCK_WARNING_DAYS)
      .sort((a, b) => a.daysLeft! - b.daysLeft!)
    for (const s of ending.slice(0, 3)) {
      tasks.push({ title: `${s.name} acaba em ${s.daysLeft} dia${s.daysLeft === 1 ? '' : 's'}`, detail: `Os lotes consomem ${s.dailyUseKg} kg por dia`, href: '/estoque', tone: 'amber' })
    }
  }
  // Pedidos de orçamento respondidos e ainda não encerrados pelo produtor
  const answered = can('estoque')
    ? await prisma.supplyRequest.findMany({
        where: { farmId, status: 'respondido' },
        select: { itemName: true, vendor: { select: { companyName: true } } },
        orderBy: { repliedAt: 'desc' },
        take: 3,
      })
    : []
  for (const r of answered) {
    tasks.push({ title: `${r.vendor.companyName} respondeu: ${r.itemName}`, detail: 'Veja o orçamento', href: '/ofertas#pedidos', tone: 'blue' })
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
