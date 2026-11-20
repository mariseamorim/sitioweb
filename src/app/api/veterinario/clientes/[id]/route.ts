import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/auth'
import { endVetLink, requireVet } from '@/lib/vets'

async function findOwn(id: string) {
  const auth = await requireVet()
  if ('error' in auth) return { error: auth.error } as const
  const link = await prisma.vetClient.findFirst({ where: { id, vetId: auth.vet.id } })
  if (!link) return { error: notFound('Propriedade não encontrada') } as const
  return { link } as const
}

// GET: histórico de um vínculo encerrado — a cópia do que o veterinário lançou, como estava no dia do encerramento
export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await findOwn((await params).id)
  if ('error' in found) return found.error
  const { link } = found
  if (link.status !== 'encerrado') return NextResponse.json({ error: 'O vínculo ainda está ativo' }, { status: 400 })
  return NextResponse.json({ id: link.id, name: link.farmName, since: link.createdAt, endedAt: link.endedAt, records: Array.isArray(link.archive) ? link.archive : [] })
}

// DELETE: o veterinário deixa de atender a propriedade (fica com a cópia do que lançou)
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await findOwn((await params).id)
  if ('error' in found) return found.error
  if (!(await endVetLink(found.link.id))) return NextResponse.json({ error: 'O vínculo já estava encerrado' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
