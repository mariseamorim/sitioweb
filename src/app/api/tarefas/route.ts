import { NextResponse } from 'next/server'
import { canAccessModule, getSessionUser } from '@/lib/auth'
import { getTodayTasks } from '@/lib/tasks'

export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!user.effectiveFarmId) return NextResponse.json([])

  const tasks = await getTodayTasks(user.effectiveFarmId, (m) => canAccessModule(user, m))
  return NextResponse.json(tasks)
}
