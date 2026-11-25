import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canEdit, getSessionUser } from '@/lib/auth'
import { vetProfileOf } from '@/lib/vets'

// DELETE: desfaz o "feito" (o manejo volta para a agenda). Da propriedade aberta ou de uma que o veterinário atende.
export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  const { id } = await params
  const row = await prisma.agendaDone.findUnique({ where: { id }, select: { farmId: true } })
  if (!row) return NextResponse.json({ ok: true })
  const vet = await vetProfileOf(user.id)
  const own = row.farmId === user.effectiveFarmId && canEdit(user)
  const linked = vet ? await prisma.vetClient.count({ where: { vetId: vet.id, farmId: row.farmId, status: 'ativo' } }) : 0
  if (!own && !linked) return NextResponse.json({ error: 'Você não tem permissão para esta ação' }, { status: 403 })
  await prisma.agendaDone.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
