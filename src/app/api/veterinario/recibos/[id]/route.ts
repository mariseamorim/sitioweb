import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/auth'
import { requireVet } from '@/lib/vets'

// DELETE: apaga um recibo emitido por engano (o número dele não volta a ser usado se já houver recibos depois)
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const { count } = await prisma.vetReceipt.deleteMany({ where: { id: (await params).id, vetId: auth.vet.id } })
  return count ? NextResponse.json({ ok: true }) : notFound('Recibo não encontrado')
}
