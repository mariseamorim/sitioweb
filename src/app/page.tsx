import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function Home() {
  const cookieStore = await cookies()
  const userId = cookieStore.get('userId')?.value

  if (!userId) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { farm: true },
  })

  if (!user) redirect('/login')

  const now = new Date()
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7)
  const in30 = new Date(now); in30.setDate(in30.getDate() + 30)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

  const [totalAnimals, aliveAnimals, milkCount, vetCount, vaccinePending, upcomingBirths, monthTransactions, supplies] = await Promise.all([
    prisma.animal.count({ where: { farmId: user.farmId } }),
    prisma.animal.count({ where: { farmId: user.farmId, status: 'Vivo' } }),
    prisma.milkProduction.count({ where: { animal: { farmId: user.farmId } } }),
    prisma.veterinaryTreatment.count({ where: { animal: { farmId: user.farmId } } }),
    prisma.vaccination.count({
      where: {
        animal: { farmId: user.farmId },
        appliedDate: null,
        scheduledDate: { lte: in7 },
      },
    }),
    prisma.reproduction.count({
      where: {
        farmId: user.farmId,
        actualBirthDate: null,
        expectedBirthDate: { lte: in30 },
      },
    }),
    prisma.transaction.findMany({
      where: {
        farmId: user.farmId,
        date: { gte: startOfMonth, lte: endOfMonth },
      },
      select: { type: true, amount: true },
    }),
    prisma.supply.findMany({
      where: { farmId: user.farmId },
      select: { currentQuantity: true, minimumQuantity: true },
    }),
  ])

  const monthBalance = monthTransactions.reduce(
    (sum, t) => sum + (t.type === 'Receita' ? t.amount : -t.amount),
    0,
  )
  const lowStockCount = supplies.filter(s => s.currentQuantity <= s.minimumQuantity).length
  const fmtBRL = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Painel</h1>
        <p className="text-gray-500 text-sm mt-1">
          Bem-vindo de volta, <span className="font-medium text-gray-700">{user.name}</span>
          <span className="mx-1.5 text-gray-300">·</span>
          {user.farm.name}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Link href="/animais" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-base">🐄</div>
            <p className="text-sm text-gray-500 font-medium leading-tight">Total de Animais</p>
          </div>
          <p className="text-3xl font-bold text-gray-800">{totalAnimals}</p>
        </Link>

        <Link href="/animais" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center text-green-600 font-bold text-base">✓</div>
            <p className="text-sm text-gray-500 font-medium leading-tight">Animais Vivos</p>
          </div>
          <p className="text-3xl font-bold text-green-600">{aliveAnimals}</p>
        </Link>

        <Link href="/milk-production" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center text-base">🥛</div>
            <p className="text-sm text-gray-500 font-medium leading-tight">Registros de Leite</p>
          </div>
          <p className="text-3xl font-bold text-blue-600">{milkCount}</p>
        </Link>

        <Link href="/veterinary-treatment" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center text-base">💊</div>
            <p className="text-sm text-gray-500 font-medium leading-tight">Tratamentos Vet.</p>
          </div>
          <p className="text-3xl font-bold text-purple-600">{vetCount}</p>
        </Link>

        <Link href="/vacinacao" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-yellow-50 flex items-center justify-center text-base">💉</div>
            <p className="text-sm text-gray-500 font-medium leading-tight">Vacinas Pendentes</p>
          </div>
          <p className={`text-3xl font-bold ${vaccinePending > 0 ? 'text-yellow-600' : 'text-gray-400'}`}>
            {vaccinePending}
          </p>
        </Link>

        <Link href="/reproducao" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-pink-50 flex items-center justify-center text-base">🐄</div>
            <p className="text-sm text-gray-500 font-medium leading-tight">Partos Esperados</p>
          </div>
          <p className={`text-3xl font-bold ${upcomingBirths > 0 ? 'text-pink-600' : 'text-gray-400'}`}>
            {upcomingBirths}
          </p>
        </Link>

        <Link href="/financeiro" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-base">💰</div>
            <p className="text-sm text-gray-500 font-medium leading-tight">Saldo do Mês</p>
          </div>
          <p className={`text-xl font-bold ${monthBalance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {fmtBRL(monthBalance)}
          </p>
        </Link>

        <Link href="/estoque" className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md hover:border-gray-200 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center text-base">📦</div>
            <p className="text-sm text-gray-500 font-medium leading-tight">Itens em Alerta</p>
          </div>
          <p className={`text-3xl font-bold ${lowStockCount > 0 ? 'text-orange-500' : 'text-gray-400'}`}>
            {lowStockCount}
          </p>
        </Link>
      </div>
    </div>
  )
}
