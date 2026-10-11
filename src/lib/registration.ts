import { NextResponse } from 'next/server'
import { getSessionUser, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** Contas pendentes podem completar um perfil; contas prontas não são substituídas. */
export async function registrationIdentity(input: unknown) {
  const me = await getSessionUser()
  if (me) {
    if (me.role !== 'onboarding') return { error: NextResponse.json({ error: 'Sua conta já está cadastrada. Use Meu cadastro para editar os dados.' }, { status: 409 }) }
    return { identity: { id: me.id, name: me.name, email: me.email, password: undefined } }
  }
  const user = input as { name?: unknown; email?: unknown; password?: unknown } | undefined
  if (!user || typeof user.name !== 'string' || !user.name.trim() || typeof user.email !== 'string' || typeof user.password !== 'string') return { error: NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 }) }
  const email = user.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: NextResponse.json({ error: 'E-mail inválido' }, { status: 400 }) }
  if (user.password.length < 6) return { error: NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 }) }
  if (await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })) return { error: NextResponse.json({ error: 'Este e-mail já tem uma conta. Entre para continuar seu cadastro.' }, { status: 409 }) }
  return { identity: { id: undefined, name: user.name.trim(), email, password: await hashPassword(user.password) } }
}
