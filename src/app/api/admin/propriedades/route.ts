import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { adminFarmSummaries } from '@/lib/adminFarms'

// GET: todas as propriedades com resumo (animais, pessoas, último lançamento) para a tela do administrador
export async function GET() {
  const me = await getSessionUser()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (me.role !== 'admin') return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
  return NextResponse.json(await adminFarmSummaries())
}
