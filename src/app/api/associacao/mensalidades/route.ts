import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrganization } from '@/lib/auth'
import { cleanNumber } from '@/lib/laticinio'

// POST: { reference: 'aaaa-mm', amount, dueDate } gera a mensalidade do mês para os associados ativos
// que ainda não têm (gerar de novo não duplica)
export async function POST(request: NextRequest) {
  const auth = await requireOrganization('associacao')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const reference = typeof body.reference === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(body.reference) ? body.reference : null
  const amount = cleanNumber(body.amount)
  const dueDate = typeof body.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? new Date(body.dueDate) : null
  if (!reference || !amount || !dueDate) return NextResponse.json({ error: 'Informe o mês, o valor e o vencimento' }, { status: 400 })

  const members = await prisma.orgMember.findMany({ where: { organizationId: auth.organization.id, status: 'ativo' }, select: { id: true } })
  const result = await prisma.memberFee.createMany({
    data: members.map((m) => ({ organizationId: auth.organization.id, memberId: m.id, reference, amount, dueDate })),
    skipDuplicates: true,
  })
  return NextResponse.json({ created: result.count }, { status: 201 })
}
