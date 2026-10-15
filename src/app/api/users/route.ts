import { prisma } from '@/lib/prisma'
import { canAccessModule, getSessionUser, grantablePermissions, hashPassword, requireUserManager } from '@/lib/auth'
import { MODULES } from '@/lib/modules'
import { addFarmMember } from '@/lib/farms'
import { NextRequest, NextResponse } from 'next/server'

const MODULE_KEYS = MODULES.map((m) => m.key)
const TEAM_ROLES = ['editor', 'viewer']

export async function GET() {
  const me = await getSessionUser()
  if (!me) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
  if (!canAccessModule(me, 'usuarios')) {
    return NextResponse.json({ error: 'Você não tem permissão para ver a equipe' }, { status: 403 })
  }

  const users = await prisma.user.findMany({
    // Equipe desta propriedade: quem está com ela aberta e quem tem acesso a ela (o dono pode estar em outra)
    where: me.effectiveFarmId ? { OR: [{ farmId: me.effectiveFarmId }, { farmMemberships: { some: { farmId: me.effectiveFarmId } } }] } : { farmId: null },
    select: {
      id: true, name: true, email: true, role: true, permissions: true,
      farmId: true, farm: { select: { name: true } }, createdAt: true,
    },
    orderBy: { name: 'asc' },
  })
  return NextResponse.json(users)
}

// POST: o admin ou o dono da propriedade cadastra alguém da equipe
export async function POST(request: NextRequest) {
  const auth = await requireUserManager()
  if ('error' in auth) return auth.error
  const { me, farmId } = auth

  const { name, email, password, role, permissions } = await request.json()

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 })
  }
  if (String(password).length < 6) {
    return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  }
  if (role && !TEAM_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Perfil inválido. Use Editor ou Leitor.' }, { status: 400 })
  }
  const granted = grantablePermissions(me, permissions, MODULE_KEYS)
  if ('error' in granted) return NextResponse.json({ error: granted.error }, { status: 403 })

  if (await prisma.user.findUnique({ where: { email } })) {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
  }

  const hashed = await hashPassword(password)
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        name, email, password: hashed,
        role: role || 'viewer',
        permissions: granted,
        farmId,
      },
      select: { id: true, name: true, email: true, role: true, permissions: true, farmId: true },
    })
    await addFarmMember(tx, created.id, farmId)
    return created
  })
  return NextResponse.json(user, { status: 201 })
}
