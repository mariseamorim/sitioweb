import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword, notFound } from '@/lib/auth'
import { addFarmMember } from '@/lib/farms'
import { validateContact } from '@/lib/identity'
import { MODULES } from '@/lib/modules'
import { contactInUse } from '@/lib/registration'
import { requireVet } from '@/lib/vets'

// POST: o veterinário cria a conta do produtor de uma propriedade que ele mesmo cadastrou.
// Body: { name, phone, email, password }. O produtor entra como dono (todos os módulos) e pode trocar a senha depois.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireVet()
  if ('error' in auth) return auth.error

  const { id } = await params
  const link = await prisma.vetClient.findFirst({ where: { id, vetId: auth.vet.id, status: 'ativo' } })
  if (!link?.farmId) return notFound('Propriedade não encontrada')
  if (!link.createdByVet) return NextResponse.json({ error: 'Esta propriedade já tem a conta do produtor' }, { status: 400 })

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name || typeof body.password !== 'string') return NextResponse.json({ error: 'Nome, senha e um telefone ou e-mail são obrigatórios' }, { status: 400 })
  if (body.password.length < 6) return NextResponse.json({ error: 'A senha deve ter pelo menos 6 caracteres' }, { status: 400 })
  const contact = validateContact(body)
  if ('error' in contact) return NextResponse.json({ error: contact.error }, { status: 400 })
  const inUse = await contactInUse(contact.email, contact.phone)
  if (inUse) return NextResponse.json({ error: inUse }, { status: 409 })

  const password = await hashPassword(body.password)
  const farmId = link.farmId
  await prisma.$transaction(async (tx) => {
    const producer = await tx.user.create({
      data: { name, email: contact.email, phone: contact.phone, password, role: 'editor', permissions: MODULES.map((m) => m.key), farmId },
    })
    await addFarmMember(tx, producer.id, farmId)
    // A propriedade passa a ter dono: deixa de ser "cadastrada pelo veterinário" e guarda o nome dele se estava vazio
    await tx.vetClient.update({ where: { id: link.id }, data: { createdByVet: false } })
    await tx.farm.updateMany({ where: { id: farmId, owner: null }, data: { owner: name } })
  })
  return NextResponse.json({ ok: true }, { status: 201 })
}
