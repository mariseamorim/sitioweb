import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAccessModule, canEdit, renewSession, requireUser } from '@/lib/auth'
import { FARM_POINT_ID, LITE_HISTORY_DAYS, LiteChange, LiteData, parseLiters, usesFarmMode } from '@/lib/lite'
import { todayUTC } from '@/lib/utils'

const isoDay = (d: Date) => d.toISOString().slice(0, 10)

function historyStart() {
  const since = todayUTC()
  since.setUTCDate(since.getUTCDate() - LITE_HISTORY_DAYS)
  return since
}


// GET: tudo o que o app precisa para funcionar no aparelho
export async function GET() {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { user } = auth
  const since = historyStart()

  if (usesFarmMode(user)) {
    if (!canAccessModule(user, 'leite')) {
      return NextResponse.json({ error: 'Você não tem acesso ao módulo de leite' }, { status: 403 })
    }
    const farmId = user.effectiveFarmId!
    const [farm, records, collections] = await Promise.all([
      prisma.farm.findUnique({ where: { id: farmId }, select: { name: true, milkPrice: true } }),
      prisma.milkProduction.findMany({
        where: { farmId, date: { gte: since } },
        select: { date: true, quantity: true },
      }),
      prisma.milkEntry.findMany({
        where: { point: { farmId }, date: { gte: since } },
        select: { date: true, liters: true, pointId: true, point: { select: { name: true, owner: { select: { name: true } } } } },
        orderBy: { date: 'desc' },
      }),
    ])
    const data: LiteData = {
      userName: user.name,
      role: user.role,
      mode: 'fazenda',
      farmId,
      canEdit: canEdit(user),
      points: [{ id: FARM_POINT_ID, name: farm?.name ?? 'Minha propriedade', kind: 'sitio', active: true }],
      entries: [...records.reduce((days, r) => {
        const day = isoDay(r.date)
        days.set(day, (days.get(day) ?? 0) + r.quantity)
        return days
      }, new Map<string, number>())].map(([date, liters]) => ({ pointId: FARM_POINT_ID, date, liters: Math.round(liters * 1000) / 1000 })),
      collections: collections.map((c) => ({
        date: isoDay(c.date), liters: c.liters, pointId: c.pointId, pointName: c.point.name, driverName: c.point.owner.name,
      })),
      milkPrice: farm?.milkPrice ?? null,
    }
    return renewSession(NextResponse.json(data))
  }

  const points = await prisma.milkPoint.findMany({
    where: { ownerId: user.id },
    orderBy: [{ active: 'desc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, kind: true, active: true, farm: { select: { id: true, name: true, city: true, state: true } } },
  })
  const owner = await prisma.user.findUnique({ where: { id: user.id }, select: { milkPrice: true } })
  const entries = await prisma.milkEntry.findMany({
    where: { point: { ownerId: user.id }, date: { gte: since } },
    select: { pointId: true, date: true, liters: true },
    orderBy: { date: 'desc' },
  })

  const data: LiteData = {
    userName: user.name,
    role: user.role,
    mode: 'pessoal',
    canEdit: true,
    points: points.map((p) => ({ ...p, kind: p.kind === 'tanque' ? 'tanque' : 'sitio' })),
    entries: entries.map((e) => ({ pointId: e.pointId, date: isoDay(e.date), liters: e.liters })),
    collections: [],
    milkPrice: owner?.milkPrice ?? null,
  }
  return renewSession(NextResponse.json(data))
}

// PUT: grava as anotações (um valor por local por dia). Reenviar o mesmo dado não duplica.
export async function PUT(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { user } = auth

  const { changes } = (await request.json()) as { changes?: LiteChange[] }
  if (!Array.isArray(changes) || changes.length === 0) {
    return NextResponse.json({ error: 'Nada para salvar' }, { status: 400 })
  }

  const today = isoDay(todayUTC())
  const valid = changes.filter((c) => c?.pointId && /^\d{4}-\d{2}-\d{2}$/.test(c.date) && c.date <= today)
  if (valid.length !== changes.length) {
    return NextResponse.json({ error: 'Há anotações com data inválida' }, { status: 400 })
  }

  if (usesFarmMode(user)) {
    if (!canAccessModule(user, 'leite') || !canEdit(user)) {
      return NextResponse.json({ error: 'Você não tem permissão para anotar o leite' }, { status: 403 })
    }
    if (valid.some((c) => c.pointId !== FARM_POINT_ID)) {
      return NextResponse.json({ error: 'Local não encontrado' }, { status: 404 })
    }
    try {
      await saveFarmChanges(user.effectiveFarmId!, valid)
    } catch (error) {
      if (error instanceof FarmMilkConflict) return NextResponse.json({ error: error.message }, { status: 409 })
      throw error
    }
    return NextResponse.json({ saved: valid.length })
  }

  const ids = [...new Set(valid.map((c) => c.pointId))]
  const owned = await prisma.milkPoint.count({ where: { id: { in: ids }, ownerId: user.id } })
  if (owned !== ids.length) return NextResponse.json({ error: 'Local não encontrado' }, { status: 404 })

  await prisma.$transaction(
    valid.map((c) => {
      const liters = parseLiters(c.liters)
      return liters === null
        ? prisma.milkEntry.deleteMany({ where: { pointId: c.pointId, date: new Date(c.date) } })
        : prisma.milkEntry.upsert({
            where: { pointId_date: { pointId: c.pointId, date: new Date(c.date) } },
            create: { pointId: c.pointId, date: new Date(c.date), liters },
            update: { liters },
          })
    }),
  )
  return NextResponse.json({ saved: valid.length })
}

class FarmMilkConflict extends Error {}

/** O valor do Lite é o total diário. Ajusta apenas sua parcela, preservando as ordenhas detalhadas. */
async function saveFarmChanges(farmId: string, changes: LiteChange[]) {
  await prisma.$transaction(async (tx) => {
    const farm = await tx.farm.findUnique({ where: { id: farmId }, select: { milkPrice: true } })
    for (const c of changes) {
      const date = new Date(c.date)
      const liters = parseLiters(c.liters)
      // Serializa os reenvios do Lite para não criar duas parcelas para o mesmo dia.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${farmId}), hashtext(${c.date}))`
      const records = await tx.milkProduction.findMany({ where: { farmId, date }, select: { id: true, source: true, quantity: true } })
      const liteRecords = records.filter(r => r.source === 'lite')
      const existing = liteRecords[0]
      const detailedTotal = records.filter(r => r.source !== 'lite').reduce((sum, r) => sum + r.quantity, 0)
      const remaining = Math.round(((liters ?? 0) - detailedTotal) * 1000) / 1000
      if (remaining < 0) throw new FarmMilkConflict('O total é menor que os litros já registrados na Produção de leite. Ajuste os lançamentos nessa tela primeiro.')
      if (remaining === 0) {
        await tx.milkProduction.deleteMany({ where: { farmId, date, source: 'lite' } })
      } else if (existing) {
        await tx.milkProduction.update({ where: { id: existing.id }, data: { quantity: remaining } })
        if (liteRecords.length > 1) await tx.milkProduction.deleteMany({ where: { id: { in: liteRecords.slice(1).map(r => r.id) } } })
      } else {
        await tx.milkProduction.create({ data: { farmId, date, quantity: remaining, pricePerLiter: farm?.milkPrice ?? null, source: 'lite', observations: 'Anota Aí Leite' } })
      }
    }
  })
}
