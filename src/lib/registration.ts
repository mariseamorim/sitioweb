import { NextResponse } from 'next/server'
import { getSessionUser, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateContact } from '@/lib/identity'

/** Já existe conta com este e-mail ou telefone? Devolve a mensagem para a pessoa, ou null. */
export async function contactInUse(email: string | null, phone: string | null, exceptId?: string): Promise<string | null> {
  if (email) {
    const found = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } })
    if (found && found.id !== exceptId) return 'Este e-mail já tem uma conta. Entre para continuar seu cadastro.'
  }
  if (phone) {
    const found = await prisma.user.findFirst({ where: { phone }, select: { id: true } })
    if (found && found.id !== exceptId) return 'Este telefone já tem uma conta. Entre para continuar seu cadastro.'
  }
  return null
}

/** Contas pendentes podem completar um perfil; contas prontas não são substituídas.
 *  Cadastro novo: nome, senha e pelo menos um contato (telefone ou e-mail). */
export async function registrationIdentity(input: unknown) {
  const me = await getSessionUser()
  if (me) {
    if (me.role !== 'onboarding') return { error: NextResponse.json({ error: 'Sua conta já está cadastrada. Use Meu cadastro para editar os dados.' }, { status: 409 }) }
    return { identity: { id: me.id, name: me.name, email: me.email, phone: me.phone, password: undefined } }
  }
  const user = input as { name?: unknown; email?: unknown; phone?: unknown; password?: unknown } | undefined
  if (!user || typeof user.name !== 'string' || !user.name.trim() || typeof user.password !== 'string') return { error: NextResponse.json({ error: 'Nome, senha e um telefone ou e-mail são obrigatórios' }, { status: 400 }) }
  const contact = validateContact(user)
  if ('error' in contact) return { error: NextResponse.json({ error: contact.error }, { status: 400 }) }
  if (user.password.length < 6) return { error: NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 }) }
  const inUse = await contactInUse(contact.email, contact.phone)
  if (inUse) return { error: NextResponse.json({ error: inUse }, { status: 409 }) }
  return { identity: { id: undefined, name: user.name.trim(), email: contact.email, phone: contact.phone, password: await hashPassword(user.password) } }
}
