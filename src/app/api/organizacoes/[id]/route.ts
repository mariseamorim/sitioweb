import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireAdmin } from '@/lib/auth'

const STATUSES = ['pendente', 'aprovado', 'bloqueado']

// PATCH: admin aprova ou bloqueia
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { id } = await params
  const { status } = await request.json()
  if (!STATUSES.includes(status)) return NextResponse.json({ error: 'Situação inválida' }, { status: 400 })
  if (!(await prisma.organization.findUnique({ where: { id }, select: { id: true } }))) return notFound('Cadastro não encontrado')

  const organization = await prisma.organization.update({ where: { id }, data: { status } })
  return NextResponse.json(organization)
}
