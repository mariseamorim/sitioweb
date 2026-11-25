import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { buildDashboard } from '@/lib/dashboard'

// GET ?meses=3|6|12: o Dashboard (tela para TV ou monitor) do perfil de quem está logado.
// O período só vale nos quadros que têm filtro (hoje, o do veterinário).
export async function GET(request: Request) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 })
  const months = Number(new URL(request.url).searchParams.get('meses')) || undefined
  const board = await buildDashboard(user, { months })
  if (!board) return NextResponse.json({ error: 'O Dashboard ainda não está disponível para este perfil.' }, { status: 404 })
  return NextResponse.json(board, { headers: { 'Cache-Control': 'no-store' } })
}
