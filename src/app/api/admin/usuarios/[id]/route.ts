import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { hashPassword, notFound, requireAdmin } from '@/lib/auth'
import { validateContact } from '@/lib/identity'
import { contactInUse } from '@/lib/registration'
import { ACCOUNT_SELECT, toAccount } from '@/lib/adminAccounts'

// PATCH: o administrador altera nome, telefone, e-mail e/ou define uma senha nova para qualquer conta.
// Só o que vier no corpo muda; a senha nova não exige a atual (é a saída de quem esqueceu a senha).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { id } = await params
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return fail('Dados inválidos') }
  if (!body || typeof body !== 'object') return fail('Dados inválidos')

  const user = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, phone: true, role: true, vendorId: true } })
  if (!user) return notFound('Conta não encontrada')

  const data: { name?: string; email?: string | null; phone?: string | null; password?: string } = {}
  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || !body.name.trim()) return fail('Informe o nome')
    data.name = body.name.trim()
  }
  if (body.email !== undefined || body.phone !== undefined) {
    // O contato que não veio continua o que está; pelo menos um dos dois precisa ficar
    const contact = validateContact({ email: body.email !== undefined ? body.email : user.email, phone: body.phone !== undefined ? body.phone : user.phone })
    if ('error' in contact) return fail(contact.error)
    const inUse = await contactInUse(contact.email, contact.phone, id)
    if (inUse) return NextResponse.json({ error: inUse.replace(' Entre para continuar seu cadastro.', '') }, { status: 409 })
    data.email = contact.email
    data.phone = contact.phone
  }
  if (body.password !== undefined && body.password !== '') {
    if (typeof body.password !== 'string' || body.password.length < 6) return fail('A nova senha deve ter pelo menos 6 caracteres')
    data.password = await hashPassword(body.password)
  }
  if (!Object.keys(data).length) return fail('Nada para alterar')

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const row = await tx.user.update({ where: { id }, data, select: ACCOUNT_SELECT })
      // Fornecedor: o contato da empresa acompanha a conta, como em Meu cadastro
      if (user.role === 'fornecedor' && user.vendorId && (data.name !== undefined || data.email !== undefined)) {
        await tx.vendor.update({
          where: { id: user.vendorId },
          data: { ...(data.name !== undefined ? { contactName: data.name } : {}), ...(data.email !== undefined ? { email: data.email } : {}) },
        })
      }
      return row
    })
    return NextResponse.json({ ...toAccount(updated), passwordChanged: !!data.password })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ error: 'E-mail ou telefone já cadastrado' }, { status: 409 })
    return NextResponse.json({ error: 'Não foi possível salvar a conta' }, { status: 500 })
  }
}

const fail = (error: string) => NextResponse.json({ error }, { status: 400 })
