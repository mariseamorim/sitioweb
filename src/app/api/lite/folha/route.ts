import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAccessModule, canEdit, requireUser } from '@/lib/auth'
import { LiteSheetChange, isDriverRole, parseLiters, usesFarmMode } from '@/lib/lite'
import { todayUTC } from '@/lib/utils'

// PUT { changes }: litros da folha do motorista em cada coleta, para o produtor conferir.
// Um valor por dia; liters null apaga. Reenviar o mesmo dado não duplica.
// No lite fica no produtor; na versão completa, na propriedade.
export async function PUT(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { user } = auth
  if (isDriverRole(user.role)) {
    return NextResponse.json({ error: 'A conferência da folha é do produtor' }, { status: 403 })
  }

  const { changes } = (await request.json()) as { changes?: LiteSheetChange[] }
  if (!Array.isArray(changes) || changes.length === 0) {
    return NextResponse.json({ error: 'Nada para salvar' }, { status: 400 })
  }
  const today = todayUTC().toISOString().slice(0, 10)
  if (changes.some((c) => !/^\d{4}-\d{2}-\d{2}$/.test(c?.date ?? '') || c.date > today)) {
    return NextResponse.json({ error: 'Há coletas com data inválida' }, { status: 400 })
  }
  if (changes.some((c) => c.liters !== null && !parseLiters(c.liters))) {
    return NextResponse.json({ error: 'Informe os litros da folha' }, { status: 400 })
  }

  let owner: { userId: string } | { farmId: string }
  if (usesFarmMode(user)) {
    if (!canAccessModule(user, 'leite') || !canEdit(user)) {
      return NextResponse.json({ error: 'Você não tem permissão para anotar o leite' }, { status: 403 })
    }
    owner = { farmId: user.effectiveFarmId! }
  } else {
    owner = { userId: user.id }
  }

  await prisma.$transaction(
    changes.map((c) => {
      const date = new Date(c.date)
      const liters = parseLiters(c.liters)
      if (liters === null) return prisma.milkSheet.deleteMany({ where: { ...owner, date } })
      const where = 'farmId' in owner ? { farmId_date: { farmId: owner.farmId, date } } : { userId_date: { userId: owner.userId, date } }
      return prisma.milkSheet.upsert({ where, create: { ...owner, date, liters }, update: { liters } })
    }),
  )
  return NextResponse.json({ saved: changes.length })
}
