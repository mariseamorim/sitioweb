import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAccessModule, canEdit, requireUser, type SessionUser } from '@/lib/auth'
import { LiteSheetChange, isDriverRole, parseLiters, usesFarmMode } from '@/lib/lite'
import { payeeScope, scopeWhere } from '@/lib/payees'
import { todayUTC } from '@/lib/utils'

// Folha do carreteiro, para o produtor conferir. No lite fica no produtor; na versão completa, na propriedade.
// PUT { changes }: um valor por dia; liters null apaga. Campos ausentes não mudam o que já está salvo.
// Com payeeLiters (litros de cada nome lidos da folha), a divisão daquela coleta passa a ser a da folha.
// GET ?data=yyyy-mm-dd: a foto guardada daquela coleta (não vem na carga da tela, é grande).

const MAX_PHOTO = 600 * 1024

async function owner(user: SessionUser): Promise<{ error: NextResponse } | { owner: { farmId: string } | { userId: string } }> {
  if (isDriverRole(user.role)) return { error: NextResponse.json({ error: 'A conferência da folha é do produtor' }, { status: 403 }) }
  if (usesFarmMode(user)) {
    if (!canAccessModule(user, 'leite') || !canEdit(user)) return { error: NextResponse.json({ error: 'Você não tem permissão para anotar o leite' }, { status: 403 }) }
    return { owner: { farmId: user.effectiveFarmId! } }
  }
  return { owner: { userId: user.id } }
}

export async function GET(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const who = await owner(auth.user)
  if ('error' in who) return who.error
  const date = request.nextUrl.searchParams.get('data') ?? ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Informe a data' }, { status: 400 })
  const sheet = await prisma.milkSheet.findFirst({ where: { ...who.owner, date: new Date(date) }, select: { photo: true } })
  if (!sheet?.photo) return NextResponse.json({ error: 'Sem foto para esta coleta' }, { status: 404 })
  return NextResponse.json({ photo: sheet.photo }, { headers: { 'Cache-Control': 'private, max-age=86400' } })
}

export async function PUT(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { user } = auth
  const who = await owner(user)
  if ('error' in who) return who.error
  const own = who.owner

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
  if (changes.some((c) => typeof c.photo === 'string' && (c.photo.length > MAX_PHOTO || !c.photo.startsWith('data:image/jpeg;base64,')))) {
    return NextResponse.json({ error: 'Foto inválida ou grande demais' }, { status: 400 })
  }

  // Nomes da nota deste produtor, para a divisão lida da folha
  const scope = await payeeScope(user)
  const payees = scope ? await prisma.milkPayee.findMany({ where: scopeWhere(scope), select: { id: true } }) : []
  const payeeIds = new Set(payees.map((p) => p.id))

  await prisma.$transaction(async (tx) => {
    for (const c of changes) {
      const date = new Date(c.date)
      const liters = parseLiters(c.liters)
      if (liters === null) { await tx.milkSheet.deleteMany({ where: { ...own, date } }); continue }
      const extra = {
        ...(c.temperature !== undefined && { temperature: c.temperature === null ? null : parseLiters(c.temperature) }),
        ...(c.sampleNumber !== undefined && { sampleNumber: c.sampleNumber ? String(c.sampleNumber).trim().slice(0, 20) : null }),
        ...(c.rulerValue !== undefined && { rulerValue: c.rulerValue === null ? null : parseLiters(c.rulerValue) }),
        ...(c.photo !== undefined && { photo: c.photo || null }),
      }
      if ('farmId' in own) await tx.milkSheet.upsert({ where: { farmId_date: { farmId: own.farmId, date } }, create: { farmId: own.farmId, date, liters, ...extra }, update: { liters, ...extra } })
      else await tx.milkSheet.upsert({ where: { userId_date: { userId: own.userId, date } }, create: { userId: own.userId, date, liters, ...extra }, update: { liters, ...extra } })
      if (c.payeeLiters && typeof c.payeeLiters === 'object') {
        for (const [payeeId, value] of Object.entries(c.payeeLiters)) {
          const part = parseLiters(value)
          if (!payeeIds.has(payeeId) || part === null) continue
          await tx.milkSplit.upsert({ where: { payeeId_date: { payeeId, date } }, create: { payeeId, date, liters: part }, update: { liters: part } })
        }
      }
    }
  })
  return NextResponse.json({ saved: changes.length })
}
