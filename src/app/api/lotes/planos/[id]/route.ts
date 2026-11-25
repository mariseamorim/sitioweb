import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFarmAccess } from '@/lib/auth'
import { PLAN_SELECT, parsePlan } from '../../shared'

async function findPlan(id: string, farmId: string) {
  return prisma.lotPlan.findFirst({ where: { id, farmId }, select: { id: true } })
}

// PUT: altera o plano (nome, situação, descrição, etapas e meta)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const { id } = await params
  if (!(await findPlan(id, auth.farmId))) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
  const data = parsePlan(await request.json().catch(() => ({})))
  if (typeof data === 'string') return NextResponse.json({ error: data }, { status: 400 })
  const plan = await prisma.lotPlan.update({ where: { id }, data, select: PLAN_SELECT })
  return NextResponse.json(plan)
}

// DELETE: apaga o plano; os lotes que usavam ficam sem plano
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireFarmAccess('animais', 'edit')
  if (auth.error) return auth.error
  const { id } = await params
  if (!(await findPlan(id, auth.farmId))) return NextResponse.json({ error: 'Plano não encontrado' }, { status: 404 })
  await prisma.lotPlan.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
