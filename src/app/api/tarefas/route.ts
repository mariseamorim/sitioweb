import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAccessModule, getSessionUser } from '@/lib/auth'
import { getTodayTasks } from '@/lib/tasks'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!user.effectiveFarmId) return NextResponse.json([])

  const seen = await prisma.user.findUnique({ where: { id: user.id }, select: { offersSeenAt: true } })
  const tasks = await getTodayTasks(user.effectiveFarmId, (m) => canAccessModule(user, m), seen?.offersSeenAt ?? null)
  return NextResponse.json(tasks)
}
