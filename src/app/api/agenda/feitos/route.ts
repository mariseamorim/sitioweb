import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAccessModule, canEdit, getSessionUser } from '@/lib/auth'
import { vetProfileOf } from '@/lib/vets'
import { DONE_KINDS, type AgendaKind } from '@/lib/agenda'

// Manejos da agenda marcados como feitos (secagem, pré-parto, retorno ao cio).
// GET: os da propriedade aberta (o app guarda no celular). POST { key, farmId? }: marca; o veterinário pode
// marcar nas propriedades que atende (farmId). Marcar de novo não duplica.

async function allowedFarm(farmId: string | undefined) {
  const user = await getSessionUser()
  if (!user) return { error: NextResponse.json({ error: 'Não autenticado' }, { status: 401 }) } as const
  const target = farmId || user.effectiveFarmId
  if (!target) return { error: NextResponse.json({ error: 'Selecione uma propriedade' }, { status: 400 }) } as const
  if (target === user.effectiveFarmId && canAccessModule(user, 'reproducao')) return { user, farmId: target } as const
  // Veterinário: propriedade que ele atende
  const vet = await vetProfileOf(user.id)
  const linked = vet ? await prisma.vetClient.count({ where: { vetId: vet.id, farmId: target, status: 'ativo' } }) : 0
  if (!linked) return { error: NextResponse.json({ error: 'Você não tem acesso a esta propriedade' }, { status: 403 }) } as const
  return { user, farmId: target } as const
}

export async function GET() {
  const auth = await allowedFarm(undefined)
  if ('error' in auth) return auth.error
  const rows = await prisma.agendaDone.findMany({ where: { farmId: auth.farmId }, select: { id: true, key: true, doneAt: true, createdAt: true } })
  return NextResponse.json(rows)
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))
  const key = typeof body.key === 'string' ? body.key.trim().slice(0, 120) : ''
  const kind = key.split(':')[0] as AgendaKind
  if (!key.includes(':') || !DONE_KINDS.includes(kind)) return NextResponse.json({ error: 'Item da agenda inválido' }, { status: 400 })
  const auth = await allowedFarm(typeof body.farmId === 'string' ? body.farmId : undefined)
  if ('error' in auth) return auth.error
  if (!canEdit(auth.user) && !(await vetProfileOf(auth.user.id))) return NextResponse.json({ error: 'Você não tem permissão para esta ação' }, { status: 403 })
  const row = await prisma.agendaDone.upsert({
    where: { farmId_key: { farmId: auth.farmId, key } },
    create: { farmId: auth.farmId, key, userId: auth.user.id },
    update: {},
    select: { id: true, key: true, doneAt: true, createdAt: true },
  })
  return NextResponse.json(row, { status: 201 })
}
