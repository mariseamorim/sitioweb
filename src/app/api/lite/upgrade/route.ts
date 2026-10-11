import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { MODULES } from '@/lib/modules'

// POST: produtor do Anota Aí Leite passa para a versão completa (Pro).
// Cria a propriedade, transforma o histórico do lite em registros de leite dela e,
// dali em diante, o lite passa a anotar direto na Produção de leite da propriedade.
export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { user } = auth
  if (user.role !== 'lite') {
    return NextResponse.json({ error: 'Disponível só para o produtor do Anota Aí Leite' }, { status: 403 })
  }

  const { name, propertyType, city, state } = await request.json()
  if (!String(name ?? '').trim()) return NextResponse.json({ error: 'Informe o nome da propriedade' }, { status: 400 })
  if (!String(city ?? '').trim() || !String(state ?? '').trim()) {
    return NextResponse.json({ error: 'Informe a cidade e o estado (ajudam o motorista a encontrar sua propriedade)' }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const farm = await tx.farm.create({
      data: {
        name: String(name).trim(),
        propertyType: propertyType === 'Fazenda' ? 'Fazenda' : 'Sítio',
        city: String(city).trim(),
        state: String(state).trim().toUpperCase().slice(0, 2),
        owner: user.name,
      },
    })

    // Histórico do lite: soma dos locais por dia vira um registro "lite" por dia na propriedade
    const entries = await tx.milkEntry.findMany({ where: { point: { ownerId: user.id } }, select: { date: true, liters: true } })
    const byDay = new Map<string, number>()
    for (const e of entries) {
      const day = e.date.toISOString().slice(0, 10)
      byDay.set(day, (byDay.get(day) ?? 0) + e.liters)
    }
    if (byDay.size) {
      await tx.milkProduction.createMany({
        data: [...byDay.entries()].map(([day, liters]) => ({
          farmId: farm.id, date: new Date(day), quantity: Math.round(liters * 10) / 10, source: 'lite', observations: 'Anota Aí Leite',
        })),
      })
    }

    await tx.milkPoint.deleteMany({ where: { ownerId: user.id } })
    await tx.user.update({
      where: { id: user.id },
      data: { role: 'editor', farmId: farm.id, permissions: MODULES.map((m) => m.key) },
    })
    return { farmId: farm.id, imported: byDay.size }
  })

  return NextResponse.json(result, { status: 201 })
}
