import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { buildDashboard } from '@/lib/dashboard'

// GET: o Dashboard (tela para TV ou monitor) do perfil de quem está logado
export async function GET() {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 })
  const board = await buildDashboard(user)
  if (!board) return NextResponse.json({ error: 'O Dashboard ainda não está disponível para este perfil.' }, { status: 404 })
  return NextResponse.json(board, { headers: { 'Cache-Control': 'no-store' } })
}
