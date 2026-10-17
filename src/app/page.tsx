import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { canAccessModule, getSessionUser } from '@/lib/auth'
import { memberFarms } from '@/lib/farms'
import { farmsOverview } from '@/lib/farmOverview'
import { FARM_SEGMENTS } from '@/lib/farmSegments'
import { OpenFarmButton } from '@/components/OpenFarmButton'
import Link from 'next/link'
import { FarmPicker } from '@/components/FarmPicker'
import { AdminFarmBanner } from '@/components/AdminFarmBanner'
import { SetupHelpCard } from '@/components/SetupHelpCard'
import { BOVINE_CATEGORIES, CALF_AT_FOOT_DAYS, canAddCalf } from '@/lib/animalRules'
import {
  AnimalIcon, CheckIcon, LeiteIcon, TratamentoIcon, VacinaIcon,
  ReproducaoIcon, FinanceiroIcon, EstoqueIcon, BalancaIcon,
} from '@/components/ModuleIcons'

export default async function Home() {
  const user = await getSessionUser()
  if (!user) redirect('/inicio')
  if (user.role === 'onboarding') redirect('/criar-conta')
  if (user.role === 'fornecedor') redirect('/fornecedor')
  if (user.role === 'laticinio') redirect('/laticinio')
  if (user.role === 'associacao') redirect('/associacao')
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
    select: { name: true, segments: true },
  })
  // Sem segmento informado, mostra tudo
  const segments = farm?.segments ?? []
  const does = (...keys: string[]) => !segments.length || keys.some(k => segments.includes(k))

  const now = new Date()
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7)
  const in30 = new Date(now); in30.setDate(in30.getDate() + 30)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const atFootSince = new Date(now); atFootSince.setDate(atFootSince.getDate() - CALF_AT_FOOT_DAYS)
  const [totalAnimals, aliveAnimals, milkCount, vetCount, vaccinePending, upcomingBirths, monthTransactions, supplies, females] = await Promise.all([
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
    // Cria: matrizes vivas e as crias ainda ao pé (vivas, mais novas que a idade de desmama)
    prisma.animal.findMany({
      where: { farmId: effectiveFarmId!, status: 'Vivo', gender: 'Fêmea', species: { in: BOVINE_CATEGORIES } },
      select: { species: true, gender: true, birthDate: true, calves: { where: { status: 'Vivo', birthDate: { gte: atFootSince } }, select: { id: true } } },
    }),
  ])
  const matrices = females.filter(f => canAddCalf(f))
  const withCalf = matrices.filter(m => m.calves.length > 0).length

  // Quem tem mais de uma propriedade vê o resumo de todas no topo
  const myFarms = user.role === 'admin' ? [] : await memberFarms(user.id)
  const overview = myFarms.length > 1
    ? await farmsOverview(
        myFarms,
        (m) => canAccessModule(user, m),
        (await prisma.user.findUnique({ where: { id: user.id }, select: { offersSeenAt: true } }))?.offersSeenAt ?? null,
        { start: startOfMonth, end: endOfMonth },
      )
    : []

  const monthBalance = monthTransactions.reduce(
    (sum, t) => sum + (t.type === 'Receita' ? t.amount : -t.amount),
    0,
  )
  const lowStockCount = supplies.filter(s => s.currentQuantity <= s.minimumQuantity).length
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const stats: { href: string; label: string; value: number | string; Icon: (p: { className?: string }) => React.ReactNode; tone: StatTone }[] = [
    { href: '/animais', label: 'Total de animais', value: totalAnimals, Icon: AnimalIcon, tone: 'neutral' },
    { href: '/animais?filtro=vivos', label: 'Animais vivos', value: aliveAnimals, Icon: CheckIcon, tone: 'neutral' },
    ...(does('leite') ? [{ href: '/milk-production', label: 'Registros de leite', value: milkCount, Icon: LeiteIcon, tone: 'neutral' as StatTone }] : []),
    { href: '/veterinary-treatment', label: 'Tratamentos', value: vetCount, Icon: TratamentoIcon, tone: 'neutral' },
    { href: '/vacinacao?filtro=pendentes', label: 'Vacinas pendentes', value: vaccinePending, Icon: VacinaIcon, tone: vaccinePending > 0 ? 'warn' : 'muted' },
    { href: '/reproducao?filtro=partos', label: 'Partos esperados', value: upcomingBirths, Icon: ReproducaoIcon, tone: upcomingBirths > 0 ? 'warn' : 'muted' },
    { href: '/financeiro', label: 'Saldo do mês', value: fmtBRL(monthBalance), Icon: FinanceiroIcon, tone: monthBalance >= 0 ? 'good' : 'bad' },
    { href: '/estoque?filtro=alerta', label: 'Itens em alerta', value: lowStockCount, Icon: EstoqueIcon, tone: lowStockCount > 0 ? 'warn' : 'muted' },
  ]


  const quickActions = [
    ...(does('leite') ? [{ href: '/milk-production', module: 'leite', title: 'Anotar leite', detail: 'Total do dia ou quantidade por vaca', Icon: LeiteIcon }] : []),
    ...(does('recria', 'engorda') && segments.length ? [{ href: '/engorda', module: 'animais', title: 'Pesar lote', detail: 'Pesagens e ganho por dia da engorda', Icon: BalancaIcon }] : []),
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

      {overview.length > 0 && <FarmsOverview farms={overview} activeId={effectiveFarmId!} fmtBRL={fmtBRL} />}

      {totalAnimals === 0 && user.role !== 'admin' && <SetupHelpCard farmId={effectiveFarmId!} />}

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

      {matrices.length > 0 && does('cria', 'leite') && (
        <section aria-labelledby="cria" className="mt-8">
          <h2 id="cria" className="text-lg font-bold text-gray-900">Matrizes</h2>
          <p className="mt-1 mb-4 text-sm text-gray-600">Vacas a partir de 2 anos e meio. Com bezerro ao pé: cria viva de até 8 meses cadastrada como filha dela.</p>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[
              ['Matrizes', matrices.length, 'text-gray-900', 'matrizes'],
              ['Com bezerro ao pé', withCalf, 'text-green-700', 'com-cria'],
              ['Solteiras', matrices.length - withCalf, 'text-gray-900', 'solteiras'],
            ].map(([label, value, tone, filter]) => (
              <Link key={label} href={`/animais?filtro=${filter}`} className="rounded-xl border border-gray-200 bg-white p-4 hover:border-gray-300 sm:p-5">
                <p className="text-sm font-medium leading-tight text-gray-500">{label}</p>
                <p className={`mt-3 text-3xl font-bold ${tone}`}>{value}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

const TASK_TONE = { red: 'text-red-700', amber: 'text-amber-700', blue: 'text-blue-700' } as const

/** Resumo de todas as propriedades: cabeças, saldo do mês e os avisos de cada uma */
function FarmsOverview({ farms, activeId, fmtBRL }: {
  farms: Awaited<ReturnType<typeof farmsOverview>>
  activeId: string
  fmtBRL: (v: number) => string
}) {
  const alive = farms.reduce((s, f) => s + f.alive, 0)
  const lotHeads = farms.reduce((s, f) => s + f.lotHeads, 0)
  const balances = farms.filter(f => f.monthBalance !== null)
  const balance = balances.reduce((s, f) => s + f.monthBalance!, 0)
  const alerts = farms.reduce((s, f) => s + f.tasks.length, 0)
  return (
    <section aria-labelledby="todas" className="mb-8">
      <h2 id="todas" className="text-lg font-bold text-gray-900">Suas {farms.length} propriedades</h2>
      <p className="mt-1 mb-4 text-sm text-gray-600">
        {alive} animais cadastrados{lotHeads ? ` e ${lotHeads} cabeças em lotes` : ''}
        {balances.length ? <> · saldo do mês somado: <strong className={balance >= 0 ? 'text-green-700' : 'text-red-600'}>{fmtBRL(balance)}</strong></> : null}
        {` · ${alerts} aviso${alerts === 1 ? '' : 's'}`}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {farms.map(f => (
          <article key={f.id} className={`rounded-xl border bg-white p-4 ${f.id === activeId ? 'border-green-400' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-bold text-gray-900">{f.name}</h3>
                {f.segments.length > 0 && <p className="text-xs text-gray-500">{FARM_SEGMENTS.filter(s => f.segments.includes(s.key)).map(s => s.label).join(' · ')}</p>}
              </div>
              {f.id === activeId
                ? <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">Aberta</span>
                : <OpenFarmButton farmId={f.id} className="shrink-0 rounded-lg border border-green-700 px-3 py-1.5 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-60" />}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-gray-500">{f.openLots ? 'Animais / em lotes' : 'Animais'}</dt><dd className="font-semibold text-gray-900">{f.alive}{f.openLots ? ` / ${f.lotHeads}` : ''}</dd></div>
              {f.monthBalance !== null && <div><dt className="text-xs text-gray-500">Saldo do mês</dt><dd className={`font-semibold ${f.monthBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtBRL(f.monthBalance)}</dd></div>}
            </dl>
            {f.tasks.length === 0
              ? <p className="mt-3 text-sm text-gray-500">Nenhum aviso hoje.</p>
              : <ul className="mt-3 space-y-1 text-sm">
                  {f.tasks.slice(0, 3).map(t => <li key={t.title} className={TASK_TONE[t.tone]}>{t.title}</li>)}
                  {f.tasks.length > 3 && <li className="text-gray-500">e mais {f.tasks.length - 3}</li>}
                </ul>}
          </article>
        ))}
      </div>
    </section>
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
