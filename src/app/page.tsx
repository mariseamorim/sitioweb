import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import Link from 'next/link'
import { FarmPicker } from '@/components/FarmPicker'
import { AdminFarmBanner } from '@/components/AdminFarmBanner'
import {
  AnimalIcon, CheckIcon, LeiteIcon, TratamentoIcon, VacinaIcon,
  ReproducaoIcon, FinanceiroIcon, EstoqueIcon,
} from '@/components/ModuleIcons'

export default async function Home() {
  const user = await getSessionUser()
  if (!user) redirect('/inicio')
  if (user.role === 'fornecedor') redirect('/fornecedor')
  if (user.role === 'lite' || user.role === 'motorista') redirect('/lite')

  const effectiveFarmId = user.effectiveFarmId

  // Admin with no farm selected → show farm picker
  if (user.role === 'admin' && !effectiveFarmId) {
    const farms = await prisma.farm.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, propertyType: true, owner: true, city: true, state: true },
    })
    return <FarmPicker farms={farms} />
  }

  // Load farm name for display
  const farm = await prisma.farm.findUnique({
    where: { id: effectiveFarmId! },
    select: { name: true },
  })

  const now = new Date()
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7)
  const in30 = new Date(now); in30.setDate(in30.getDate() + 30)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [totalAnimals, aliveAnimals, milkCount, vetCount, vaccinePending, upcomingBirths, monthTransactions, supplies] = await Promise.all([
    prisma.animal.count({ where: { farmId: effectiveFarmId! } }),
    prisma.animal.count({ where: { farmId: effectiveFarmId!, status: 'Vivo' } }),
    prisma.milkProduction.count({ where: { farmId: effectiveFarmId! } }),
    prisma.veterinaryTreatment.count({ where: { animal: { farmId: effectiveFarmId! } } }),
    prisma.vaccination.count({
      where: {
        animal: { farmId: effectiveFarmId! },
        appliedDate: null,
        scheduledDate: { lte: in7 },
      },
    }),
    prisma.reproduction.count({
      where: {
        farmId: effectiveFarmId!,
        actualBirthDate: null,
        expectedBirthDate: { lte: in30 },
      },
    }),
    prisma.transaction.findMany({
      where: {
        farmId: effectiveFarmId!,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { type: true, amount: true },
    }),
    prisma.supply.findMany({
      where: { farmId: effectiveFarmId! },
      select: { currentQuantity: true, minimumQuantity: true },
    }),
  ])

  const monthBalance = monthTransactions.reduce(
    (sum, t) => sum + (t.type === 'Receita' ? t.amount : -t.amount),
    0,
  )
  const lowStockCount = supplies.filter(s => s.currentQuantity <= s.minimumQuantity).length
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const stats: { href: string; label: string; value: number | string; Icon: (p: { className?: string }) => React.ReactNode; tone: StatTone }[] = [
    { href: '/animais', label: 'Total de animais', value: totalAnimals, Icon: AnimalIcon, tone: 'neutral' },
    { href: '/animais', label: 'Animais vivos', value: aliveAnimals, Icon: CheckIcon, tone: 'neutral' },
    { href: '/milk-production', label: 'Registros de leite', value: milkCount, Icon: LeiteIcon, tone: 'neutral' },
    { href: '/veterinary-treatment', label: 'Tratamentos', value: vetCount, Icon: TratamentoIcon, tone: 'neutral' },
    { href: '/vacinacao', label: 'Vacinas pendentes', value: vaccinePending, Icon: VacinaIcon, tone: vaccinePending > 0 ? 'warn' : 'muted' },
    { href: '/reproducao', label: 'Partos esperados', value: upcomingBirths, Icon: ReproducaoIcon, tone: upcomingBirths > 0 ? 'warn' : 'muted' },
    { href: '/financeiro', label: 'Saldo do mês', value: fmtBRL(monthBalance), Icon: FinanceiroIcon, tone: monthBalance >= 0 ? 'good' : 'bad' },
    { href: '/estoque', label: 'Itens em alerta', value: lowStockCount, Icon: EstoqueIcon, tone: lowStockCount > 0 ? 'warn' : 'muted' },
  ]


  const quickActions = [
    { href: '/milk-production', module: 'leite', title: 'Anotar leite', detail: 'Total do dia ou quantidade por vaca', Icon: LeiteIcon },
    { href: '/animais', module: 'animais', title: 'Cuidar do rebanho', detail: 'Consultar e cadastrar animais', Icon: AnimalIcon },
    { href: '/financeiro', module: 'financeiro', title: 'Anotar dinheiro', detail: 'Entradas e saídas da propriedade', Icon: FinanceiroIcon },
    { href: '/estoque', module: 'estoque', title: 'Conferir estoque', detail: 'Ração, sal e outros produtos', Icon: EstoqueIcon },
  ].filter(action => user.role === 'admin' || user.permissions?.includes(action.module))

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Painel</h1>
            <p className="text-gray-500 text-sm mt-1">
              Bem-vindo de volta, <span className="font-medium text-gray-700">{user.name}</span>
              <span className="mx-1.5 text-gray-300">·</span>
              {farm?.name}
            </p>
          </div>
          {user.role === 'admin' && (
            <AdminFarmBanner />
          )}
        </div>
      </div>

      {quickActions.length > 0 && <section aria-labelledby="daily-actions" className="mb-8">
        <h2 id="daily-actions" className="text-lg font-bold text-gray-900">O que você quer fazer?</h2>
        <p className="mt-1 mb-4 text-sm text-gray-600">Escolha uma tarefa para abrir a tela correspondente.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{quickActions.map(({ href, title, detail, Icon }) => <Link key={href} href={href} className="flex items-start gap-3 rounded-xl border border-green-200 bg-white p-4 hover:bg-green-50">
          <span aria-hidden="true" className="rounded-lg bg-green-50 p-2 text-green-700"><Icon className="h-6 w-6" /></span>
          <span><span className="block text-base font-semibold text-green-900">{title}</span><span className="mt-1 block text-sm text-gray-600">{detail}</span></span>
        </Link>)}</div>
      </section>}
      <h2 className="mb-4 text-lg font-bold text-gray-900">Resumo da propriedade</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(({ href, label, value, Icon, tone }) => (
          <Link
            key={label}
            href={href}
            className="bg-white rounded-xl border border-gray-200 p-4 sm:p-5 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center gap-2 text-gray-500">
              <Icon className="w-5 h-5 shrink-0 text-gray-400" />
              <p className="text-sm font-medium leading-tight">{label}</p>
            </div>
            <p className={`mt-3 font-bold ${typeof value === 'number' ? 'text-3xl' : 'text-xl'} ${STAT_TONE[tone]}`}>{value}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}

type StatTone = 'neutral' | 'muted' | 'warn' | 'good' | 'bad'
const STAT_TONE: Record<StatTone, string> = {
  neutral: 'text-gray-900',
  muted: 'text-gray-400',
  warn: 'text-amber-700',
  good: 'text-green-700',
  bad: 'text-red-600',
}
