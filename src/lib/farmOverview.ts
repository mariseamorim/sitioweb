import { prisma } from '@/lib/prisma'
import { getTodayTasks, type Task } from '@/lib/tasks'

// Resumo de todas as propriedades de quem tem mais de uma: cabeças, saldo do mês e os avisos do sino de cada uma

export interface FarmOverview {
  id: string
  name: string
  segments: string[]
  /** Animais cadastrados e vivos */
  alive: number
  /** Cabeças nos lotes abertos de recria/engorda (pela última pesagem) */
  lotHeads: number
  openLots: number
  /** Receitas menos despesas do mês; null sem acesso ao financeiro */
  monthBalance: number | null
  tasks: Task[]
}

export async function farmsOverview(
  farms: { id: string; name: string; segments: string[] }[],
  can: (module: string) => boolean,
  offersSeenAt: Date | null,
  month: { start: Date; end: Date },
): Promise<FarmOverview[]> {
  return Promise.all(farms.map(async (farm) => {
    const [alive, lots, transactions, tasks] = await Promise.all([
      can('animais') ? prisma.animal.count({ where: { farmId: farm.id, status: 'Vivo' } }) : 0,
      can('animais')
        ? prisma.lot.findMany({ where: { farmId: farm.id, endDate: null }, select: { weighings: { select: { headCount: true }, orderBy: { date: 'desc' }, take: 1 } } })
        : [],
      can('financeiro')
        ? prisma.transaction.findMany({ where: { farmId: farm.id, date: { gte: month.start, lte: month.end } }, select: { type: true, amount: true } })
        : null,
      getTodayTasks(farm.id, can, offersSeenAt),
    ])
    return {
      ...farm,
      alive,
      lotHeads: lots.reduce((sum, l) => sum + (l.weighings[0]?.headCount ?? 0), 0),
      openLots: lots.length,
      monthBalance: transactions ? transactions.reduce((sum, t) => sum + (t.type === 'Receita' ? t.amount : -t.amount), 0) : null,
      tasks,
    }
  }))
}
