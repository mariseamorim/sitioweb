import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAccessModule, canEdit, requireUser } from '@/lib/auth'
import { cleanCode, cleanName, payeeScope, scopeWhere, toLitePayee } from '@/lib/payees'

// PATCH { name?, producerCode?, sequence?, active? }: altera ou arquiva um nome.
// Arquivar tira o nome das próximas coletas; as divisões já feitas ficam no histórico.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { user } = auth
  const scope = await payeeScope(user)
  if (!scope) return NextResponse.json({ error: 'O motorista não tem nomes de nota' }, { status: 403 })
  if ('farmId' in scope && (!canAccessModule(user, 'leite') || !canEdit(user))) {
    return NextResponse.json({ error: 'Você não tem permissão para anotar o leite' }, { status: 403 })
  }

  const { id } = await params
  const existing = await prisma.milkPayee.findFirst({ where: { id, ...scopeWhere(scope) }, select: { id: true } })
  if (!existing) return NextResponse.json({ error: 'Nome não encontrado' }, { status: 404 })

  const body = await request.json()
  const data: { name?: string; producerCode?: string | null; sequence?: string | null; active?: boolean } = {}
  if (body.name !== undefined) {
    const name = cleanName(body.name)
    if (!name) return NextResponse.json({ error: 'Informe o nome como está na folha' }, { status: 400 })
    data.name = name
  }
  if (body.producerCode !== undefined) data.producerCode = cleanCode(body.producerCode)
  if (body.sequence !== undefined) data.sequence = cleanCode(body.sequence)
  if (body.active !== undefined) data.active = body.active !== false

  const payee = await prisma.milkPayee.update({ where: { id }, data })
  return NextResponse.json(toLitePayee(payee))
}
