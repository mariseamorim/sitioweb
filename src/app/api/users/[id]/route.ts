import { prisma } from '@/lib/prisma'
import { grantablePermissions, requireUserManager } from '@/lib/auth'
import { MODULES } from '@/lib/modules'
import { NextRequest, NextResponse } from 'next/server'

const MODULE_KEYS = MODULES.map((m) => m.key)
const TEAM_ROLES = ['editor', 'viewer']

/** Alguém da equipe desta propriedade que quem está logado pode alterar. */
async function findManageable(id: string, farmId: string) {
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, farmId: true, role: true } })
  if (!target || target.farmId !== farmId) {
    return { error: NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 }) } as const
  }
  if (target.role === 'admin') {
    return { error: NextResponse.json({ error: 'Administradores não podem ser alterados por aqui' }, { status: 403 }) } as const
  }
  return { target } as const
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserManager()
  if ('error' in auth) return auth.error
  const { me, farmId } = auth

  const { id } = await params
  const found = await findManageable(id, farmId)
  if ('error' in found) return found.error

  const { name, role, permissions } = await request.json()
  const self = id === me.id

  // Ninguém altera o próprio perfil nem as próprias permissões (evita se trancar para fora)
  if (self && (role !== undefined || permissions !== undefined)) {
    return NextResponse.json({ error: 'Você não pode alterar seu próprio perfil ou permissões' }, { status: 400 })
  }
  if (role !== undefined && !TEAM_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Perfil inválido. Use Editor ou Leitor.' }, { status: 400 })
  }

  let granted: string[] | undefined
  if (permissions !== undefined) {
    const result = grantablePermissions(me, permissions, MODULE_KEYS)
    if ('error' in result) return NextResponse.json({ error: result.error }, { status: 403 })
    granted = result
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(name && { name }),
      ...(role && { role }),
      ...(granted && { permissions: granted }),
    },
    select: { id: true, name: true, email: true, role: true, permissions: true, farmId: true },
  })
  return NextResponse.json(user)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUserManager()
  if ('error' in auth) return auth.error
  const { me, farmId } = auth

  const { id } = await params
  if (id === me.id) {
    return NextResponse.json({ error: 'Você não pode excluir sua própria conta' }, { status: 400 })
  }
  const found = await findManageable(id, farmId)
  if ('error' in found) return found.error

  await prisma.user.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
