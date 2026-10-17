import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAccessModule, canEdit, requireUser } from '@/lib/auth'
import { LiteSplitChange, parseLiters } from '@/lib/lite'
import { payeeScope, scopeWhere } from '@/lib/payees'
import { todayUTC } from '@/lib/utils'

// PUT { changes }: litros de cada nome no dia da coleta. liters null apaga a parte daquele nome.
// Vem pela fila do aparelho: reenviar o mesmo dado não duplica.
export async function PUT(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { user } = auth
  const scope = await payeeScope(user)
  if (!scope) return NextResponse.json({ error: 'O motorista não divide a nota' }, { status: 403 })
  if ('farmId' in scope && (!canAccessModule(user, 'leite') || !canEdit(user))) {
    return NextResponse.json({ error: 'Você não tem permissão para anotar o leite' }, { status: 403 })
  }

  const { changes } = (await request.json()) as { changes?: LiteSplitChange[] }
  if (!Array.isArray(changes) || changes.length === 0) {
    return NextResponse.json({ error: 'Nada para salvar' }, { status: 400 })
  }
  const today = todayUTC().toISOString().slice(0, 10)
  if (changes.some((c) => !c?.payeeId || !/^\d{4}-\d{2}-\d{2}$/.test(c?.date ?? '') || c.date > today)) {
    return NextResponse.json({ error: 'Há divisões com data inválida' }, { status: 400 })
  }
  if (changes.some((c) => c.liters !== null && parseLiters(c.liters) === null)) {
    return NextResponse.json({ error: 'Informe os litros de cada nome' }, { status: 400 })
  }

  const ids = [...new Set(changes.map((c) => c.payeeId))]
  const mine = await prisma.milkPayee.findMany({ where: { id: { in: ids }, ...scopeWhere(scope) }, select: { id: true } })
  if (mine.length !== ids.length) return NextResponse.json({ error: 'Nome não encontrado' }, { status: 404 })

  await prisma.$transaction(
    changes.map((c) => {
      const date = new Date(c.date)
      const liters = parseLiters(c.liters)
      if (liters === null) return prisma.milkSplit.deleteMany({ where: { payeeId: c.payeeId, date } })
      return prisma.milkSplit.upsert({ where: { payeeId_date: { payeeId: c.payeeId, date } }, create: { payeeId: c.payeeId, date, liters }, update: { liters } })
    }),
  )
  return NextResponse.json({ saved: changes.length })
}
