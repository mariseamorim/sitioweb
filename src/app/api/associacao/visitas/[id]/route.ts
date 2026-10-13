import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireOrganization } from '@/lib/auth'
import { cleanText } from '@/lib/laticinio'

const STATUSES = ['solicitada', 'agendada', 'concluida', 'cancelada']

// PATCH: agenda (data + técnico), conclui (com o resultado) ou cancela a visita
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireOrganization('associacao')
  if ('error' in auth) return auth.error
  const { id } = await params
  if (!(await prisma.techVisit.findFirst({ where: { id, organizationId: auth.organization.id }, select: { id: true } }))) return notFound('Visita não encontrada')

  const body = await request.json()
  const data: Record<string, unknown> = {}
  if (body.scheduledFor !== undefined) {
    const date = typeof body.scheduledFor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.scheduledFor) ? new Date(body.scheduledFor) : null
    data.scheduledFor = date
    if (date && body.status === undefined) data.status = 'agendada'
  }
  if (body.technician !== undefined) data.technician = cleanText(body.technician, 80)
  if (body.result !== undefined) data.result = cleanText(body.result, 1000)
  if (body.status !== undefined) {
    if (!STATUSES.includes(body.status)) return NextResponse.json({ error: 'Situação inválida' }, { status: 400 })
    data.status = body.status
  }
  return NextResponse.json(await prisma.techVisit.update({ where: { id }, data }))
}
