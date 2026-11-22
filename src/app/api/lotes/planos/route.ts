import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFarmAccess } from '@/lib/auth'
import { PLAN_SELECT, parsePlan } from '../shared'

// Planos de recria/engorda da propriedade (permissão do módulo Animais, como os lotes)
export async function GET() {
  const auth = await requireFarmAccess('animais', 'view')
  if (auth.error) return auth.error
  const plans = await prisma.lotPlan.findMany({ where: { farmId: auth.farmId }, select: PLAN_SELECT, orderBy: [{ active: 'desc' }, { name: 'asc' }] })
  return NextResponse.json(plans)
}

export async function POST(request: NextRequest) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const data = parsePlan(await request.json().catch(() => ({})))
  if (typeof data === 'string') return NextResponse.json({ error: data }, { status: 400 })
  const plan = await prisma.lotPlan.create({ data: { ...data, farmId: auth.farmId }, select: PLAN_SELECT })
  return NextResponse.json(plan, { status: 201 })
}
