import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth'
import { ACCOUNT_SELECT, toAccount } from '@/lib/adminAccounts'

// GET: todas as contas, de todos os perfis, para o administrador editar dados e redefinir senhas.
// A busca é feita na tela (a lista é pequena); a senha nunca sai daqui.
export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const users = await prisma.user.findMany({ select: ACCOUNT_SELECT, orderBy: { name: 'asc' }, take: 2000 })
  return NextResponse.json(users.map(toAccount), { headers: { 'Cache-Control': 'no-store' } })
}
