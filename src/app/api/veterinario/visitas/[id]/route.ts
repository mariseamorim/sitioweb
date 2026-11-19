import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound } from '@/lib/auth'
import { requireVet } from '@/lib/vets'
import { day, hour, text } from '@/lib/vetInput'

const STATUSES = ['agendada', 'realizada', 'cancelada']

async function findOwn(id: string) {
  const auth = await requireVet()
  if ('error' in auth) return { error: auth.error } as const
  const visit = await prisma.vetVisit.findFirst({ where: { id, vetId: auth.vet.id } })
  if (!visit) return { error: notFound('Visita não encontrada') } as const
  return { visit } as const
}

// PATCH: remarca (date, time, purpose), conclui ou cancela (status) e guarda as recomendações (notes). Só muda o que vier.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await findOwn((await params).id)
  if ('error' in found) return found.error
  const body = await request.json()
  const data: { date?: Date; time?: string | null; purpose?: string | null; status?: string; notes?: string | null } = {}
  if ('date' in body) {
    const date = day(body.date)
    if (!date) return NextResponse.json({ error: 'Informe o dia da visita' }, { status: 400 })
    data.date = date
  }
  if ('time' in body) data.time = hour(body.time)
  if ('purpose' in body) data.purpose = text(body.purpose, 200)
  if ('notes' in body) data.notes = text(body.notes, 4000)
  if ('status' in body) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Situação inválida' }, { status: 400 })
    data.status = body.status
  }
  return NextResponse.json(await prisma.vetVisit.update({ where: { id: found.visit.id }, data }))
}

// DELETE: apaga a visita da agenda
export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const found = await findOwn((await params).id)
  if ('error' in found) return found.error
  await prisma.vetVisit.delete({ where: { id: found.visit.id } })
  return NextResponse.json({ ok: true })
}
