import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireProducer } from '@/lib/auth'
import { endVetLink, isVet } from '@/lib/vets'

// DELETE: o produtor encerra o acesso do veterinário à propriedade aberta.
// O veterinário fica com a cópia do que ele mesmo lançou; os dados da propriedade continuam com o produtor.
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireProducer(true)
  if ('error' in auth) return auth.error
  if (await isVet(auth.user.id)) return NextResponse.json({ error: 'Só o produtor pode encerrar o acesso do veterinário' }, { status: 403 })

  const { id } = await params
  const link = await prisma.vetClient.findFirst({ where: { id, farmId: auth.farmId, status: 'ativo' }, select: { id: true } })
  if (!link) return notFound('Veterinário não encontrado')
  await endVetLink(link.id)
  return NextResponse.json({ ok: true })
}
