import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAccessModule, canEdit, requireUser } from '@/lib/auth'
import { MAX_PAYEES, cleanCode, cleanName, payeeScope, scopeWhere, toLitePayee } from '@/lib/payees'

// Nomes da nota do laticínio. GET lista; POST cria { pointId, name, producerCode, sequence }.
// Precisa de internet (é cadastro feito uma vez); a divisão de cada coleta, essa vai pela fila.
export async function GET() {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const scope = await payeeScope(auth.user)
  if (!scope) return NextResponse.json([])
  const payees = await prisma.milkPayee.findMany({ where: scopeWhere(scope), orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })
  return NextResponse.json(payees.map(toLitePayee))
}

export async function POST(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { user } = auth
  const scope = await payeeScope(user)
  if (!scope) return NextResponse.json({ error: 'O motorista não tem nomes de nota' }, { status: 403 })
  if ('farmId' in scope && (!canAccessModule(user, 'leite') || !canEdit(user))) {
    return NextResponse.json({ error: 'Você não tem permissão para anotar o leite' }, { status: 403 })
  }

  const body = await request.json()
  const name = cleanName(body.name)
  if (!name) return NextResponse.json({ error: 'Informe o nome como está na folha' }, { status: 400 })

  let where: { farmId: string } | { pointId: string }
  if ('farmId' in scope) where = { farmId: scope.farmId }
  else {
    const pointId = String(body.pointId ?? '')
    if (!scope.pointIds.includes(pointId)) return NextResponse.json({ error: 'Local não encontrado' }, { status: 404 })
    where = { pointId }
  }
  const count = await prisma.milkPayee.count({ where })
  if (count >= MAX_PAYEES) return NextResponse.json({ error: `Limite de ${MAX_PAYEES} nomes` }, { status: 400 })

  const payee = await prisma.milkPayee.create({
    data: { ...where, name, producerCode: cleanCode(body.producerCode), sequence: cleanCode(body.sequence), position: count },
  })
  return NextResponse.json(toLitePayee(payee), { status: 201 })
}
