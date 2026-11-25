import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { canAccessModule, getSessionUser } from '@/lib/auth'
import { memberFarms } from '@/lib/farms'
import { farmsOverview } from '@/lib/farmOverview'
import { adminFarmSummaries } from '@/lib/adminFarms'
import { FARM_SEGMENTS } from '@/lib/farmSegments'
import { OpenFarmButton } from '@/components/OpenFarmButton'
import Link from 'next/link'
import { FarmPicker } from '@/components/FarmPicker'
import { AdminFarmBanner } from '@/components/AdminFarmBanner'
import { HomeRedirect } from '@/components/HomeRedirect'
import { homeForRole } from '@/lib/organizations'
import { isVet } from '@/lib/vets'
import { SetupHelpCard } from '@/components/SetupHelpCard'
import { T } from '@/components/T'
import type { Accent } from '@/components/StatTile'
import { PeriodSummary } from '@/components/PeriodSummary'
import { loadPeriodSummary } from '@/lib/periodSummaryData'
import { BOVINE_CATEGORIES, CALF_AT_FOOT_DAYS, canAddCalf } from '@/lib/animalRules'
import {
  AnimalIcon, CheckIcon, LeiteIcon, TratamentoIcon, VacinaIcon,
  ReproducaoIcon, FinanceiroIcon, EstoqueIcon, BalancaIcon,
} from '@/components/ModuleIcons'

export default async function Home() {
  const user = await getSessionUser()
  // Quem não usa o Painel recebe uma página que segue para a tela certa, em vez de um redirecionamento do servidor:
  // assim "/" fica guardada no aparelho e o app instalado abre sem internet (o service worker não guarda redirecionamentos).
  // Dentro do app Android (identificador definido em capacitor.config.ts) não há página de apresentação: quem não está
  // logado vai direto para a tela de entrada. No site, segue para a apresentação (/inicio).
  if (!user) return <HomeRedirect href={((await headers()).get('user-agent') ?? '').includes('AnotaAiAgro/Android') ? '/login' : '/inicio'} />
  if (user.role === 'onboarding') redirect('/criar-conta')
  const home = homeForRole(user.role)
  if (home !== '/') return <HomeRedirect href={home} />
  // Veterinário consultor: a tela inicial é o painel das propriedades que ele atende
  if (user.role === 'editor' && await isVet(user.id)) return <HomeRedirect href="/consultoria" />

  const effectiveFarmId = user.effectiveFarmId

  // Admin sem propriedade aberta: escolhe uma, agrupadas por proprietário
  if (user.role === 'admin' && !effectiveFarmId) {
    return <FarmPicker farms={await adminFarmSummaries()} />
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
  // Visão mensal e anual: leite, dinheiro e nascimentos do mês e do ano, mês a mês
  const period = await loadPeriodSummary(effectiveFarmId!, (m) => canAccessModule(user, m), segments, now)
  const showPeriod = period.show.milk || period.show.money || period.show.births

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

  // Cor de cada cartão pelo significado: contagens em azul/verde-água, pendências em laranja, saldo verde ou vermelho
  const stats: { href: string; label: string; value: number | string; Icon: (p: { className?: string }) => React.ReactNode; accent: Accent }[] = [
    { href: '/animais', label: 'Total de animais', value: totalAnimals, Icon: AnimalIcon, accent: 'blue' },
    { href: '/animais?filtro=vivos', label: 'Animais vivos', value: aliveAnimals, Icon: CheckIcon, accent: 'teal' },
    ...(does('leite') ? [{ href: '/milk-production', label: 'Registros de leite', value: milkCount, Icon: LeiteIcon, accent: 'blue' as Accent }] : []),
    { href: '/veterinary-treatment', label: 'Tratamentos', value: vetCount, Icon: TratamentoIcon, accent: 'teal' },
    { href: '/vacinacao?filtro=pendentes', label: 'Vacinas pendentes', value: vaccinePending, Icon: VacinaIcon, accent: vaccinePending > 0 ? 'amber' : 'green' },
    { href: '/reproducao?filtro=partos', label: 'Partos esperados', value: upcomingBirths, Icon: ReproducaoIcon, accent: upcomingBirths > 0 ? 'amber' : 'teal' },
    { href: '/financeiro', label: 'Saldo do mês', value: fmtBRL(monthBalance), Icon: FinanceiroIcon, accent: monthBalance >= 0 ? 'green' : 'red' },
    { href: '/estoque?filtro=alerta', label: 'Itens em alerta', value: lowStockCount, Icon: EstoqueIcon, accent: lowStockCount > 0 ? 'red' : 'green' },
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
            <h1 className="text-2xl font-bold text-gray-900"><T k="Painel" /></h1>
            <p className="text-gray-500 text-sm mt-1">
              <T k="Bem-vindo de volta," /> <span className="font-medium text-gray-700">{user.name}</span>
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
        <h2 id="daily-actions" className="text-lg font-bold text-gray-900"><T k="O que você quer fazer?" /></h2>
        <p className="mt-1 mb-4 text-sm text-gray-600"><T k="Escolha uma tarefa para abrir a tela correspondente." /></p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">{quickActions.map(({ href, title, detail, Icon }) => <Link key={href} href={href} className="flex items-start gap-3 rounded-xl border border-green-200 bg-white p-4 hover:bg-green-50">
          <span aria-hidden="true" className="rounded-lg bg-green-50 p-2 text-green-700"><Icon className="h-6 w-6" /></span>
          <span><span className="block text-base font-semibold text-green-900"><T k={title} /></span><span className="mt-1 block text-sm text-gray-600"><T k={detail} /></span></span>
        </Link>)}</div>
      </section>}
      {showPeriod && <PeriodSummary summary={period.summary} show={period.show} />}
      <h2 className="mb-4 text-lg font-bold text-gray-900"><T k="Resumo da propriedade" /></h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {stats.map(({ href, label, value, Icon, accent }) => (
          <Link
            key={label}
            href={href}
            className={`rounded-xl border border-gray-200 p-4 transition-shadow hover:shadow-md sm:p-5 ${TILE[accent].box}`}
          >
            <div className="flex items-center gap-2 text-gray-700">
              <Icon className="w-5 h-5 shrink-0 text-gray-500" />
              <p className="text-sm font-medium leading-tight"><T k={label} /></p>
            </div>
            <p className={`mt-3 font-bold tabular-nums ${typeof value === 'number' ? 'text-3xl' : 'text-xl'} ${TILE[accent].value}`}>{value}</p>
          </Link>
        ))}
      </div>

      {matrices.length > 0 && does('cria', 'leite') && (
        <section aria-labelledby="cria" className="mt-8">
          <h2 id="cria" className="text-lg font-bold text-gray-900"><T k="Matrizes" /></h2>
          <p className="mt-1 mb-4 text-sm text-gray-600"><T k="Vacas a partir de 2 anos e meio. Com bezerro ao pé: cria viva de até 8 meses cadastrada como filha dela." /></p>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            {[
              ['Matrizes', matrices.length, 'blue', 'matrizes'],
              ['Com bezerro ao pé', withCalf, 'green', 'com-cria'],
              ['Solteiras', matrices.length - withCalf, 'amber', 'solteiras'],
            ].map(([label, value, accent, filter]) => (
              <Link key={label} href={`/animais?filtro=${filter}`} className={`rounded-xl border border-gray-200 p-4 transition-shadow hover:shadow-md sm:p-5 ${TILE[accent as Accent].box}`}>
                <p className="text-sm font-medium leading-tight text-gray-700"><T k={String(label)} /></p>
                <p className={`mt-3 text-3xl font-bold tabular-nums ${TILE[accent as Accent].value}`}>{value}</p>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// Aviso com faixa colorida à esquerda: vermelho urgente, laranja atenção, azul informação
const TASK_TONE = { red: 'bg-red-50 text-red-800', amber: 'bg-amber-50 text-amber-800', blue: 'bg-blue-50 text-blue-800' } as const
const TASK_BAR = { red: 'bg-red-600', amber: 'bg-amber-500', blue: 'bg-blue-600' } as const

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
      <h2 id="todas" className="text-lg font-bold text-gray-900"><T k="Suas {n} propriedades" vars={{ n: farms.length }} /></h2>
      <p className="mt-1 mb-4 text-sm text-gray-600">
        <T k="{n} animais cadastrados" vars={{ n: alive }} />{lotHeads ? <> <T k="e {n} cabeças em lotes" vars={{ n: lotHeads }} /></> : null}
        {balances.length ? <> · <T k="saldo do mês somado:" /> <strong className={balance >= 0 ? 'text-green-700' : 'text-red-600'}>{fmtBRL(balance)}</strong></> : null}
        {' · '}<T k={alerts === 1 ? '{n} aviso' : '{n} avisos'} vars={{ n: alerts }} />
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {farms.map(f => (
          <article key={f.id} className={`rounded-xl border bg-white p-4 ${f.id === activeId ? 'border-green-400' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-bold text-gray-900">{f.name}</h3>
                {f.segments.length > 0 && <p className="text-xs text-gray-500">{FARM_SEGMENTS.filter(s => f.segments.includes(s.key)).map((s, i) => <span key={s.key}>{i ? ' · ' : ''}<T k={s.label} /></span>)}</p>}
              </div>
              {f.id === activeId
                ? <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800"><T k="Aberta" /></span>
                : <OpenFarmButton farmId={f.id} className="shrink-0 rounded-lg border border-green-700 px-3 py-1.5 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-60" />}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div><dt className="text-xs text-gray-500"><T k={f.openLots ? 'Animais / em lotes' : 'Animais'} /></dt><dd className="font-semibold text-gray-900">{f.alive}{f.openLots ? ` / ${f.lotHeads}` : ''}</dd></div>
              {f.monthBalance !== null && <div><dt className="text-xs text-gray-500"><T k="Saldo do mês" /></dt><dd className={`font-semibold ${f.monthBalance >= 0 ? 'text-green-700' : 'text-red-600'}`}>{fmtBRL(f.monthBalance)}</dd></div>}
            </dl>
            {f.tasks.length === 0
              ? <p className="mt-3 text-sm text-gray-500"><T k="Nenhum aviso hoje." /></p>
              : <ul className="mt-3 space-y-1 text-sm">
                  {f.tasks.slice(0, 3).map(t => <li key={t.title} className={`relative rounded-md py-1 pl-3 pr-2 font-medium ${TASK_TONE[t.tone]}`}><span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1 rounded-l-md ${TASK_BAR[t.tone]}`} /><T k={t.title} /></li>)}
                  {f.tasks.length > 3 && <li className="text-gray-500"><T k="e mais {n}" vars={{ n: f.tasks.length - 3 }} /></li>}
                </ul>}
          </article>
        ))}
      </div>
    </section>
  )
}

// Mesmas cores do StatTile; aqui o cartão inteiro é um link, por isso a classe fica na página
// (o StatTile só aceita nome em texto e o Painel é componente de servidor, que traduz com <T />).
// Cartões do resumo: borda cinza neutra; a cor fica só no fundo suave e no número
const TILE: Record<Accent, { box: string; value: string }> = {
  green: { box: 'bg-green-50', value: 'text-green-900' },
  blue: { box: 'bg-blue-50', value: 'text-blue-900' },
  teal: { box: 'bg-teal-50', value: 'text-teal-900' },
  amber: { box: 'bg-amber-50', value: 'text-amber-800' },
  red: { box: 'bg-red-50', value: 'text-red-700' },
}
