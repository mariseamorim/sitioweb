import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { addFarmMember } from '@/lib/farms'
import { requireVet } from '@/lib/vets'

// POST: o veterinário cadastra a propriedade de um cliente que ainda não usa o sistema.
// Body: { name, owner, phone, city, state }. Ele passa a atendê-la; o produtor pode receber o acesso depois
// (POST /api/veterinario/clientes/{id}/produtor).
export async function POST(request: NextRequest) {
  const auth = await requireVet()
  if ('error' in auth) return auth.error
  const { user, vet } = auth

  const body = await request.json()
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!name) return NextResponse.json({ error: 'Informe o nome da propriedade' }, { status: 400 })
  const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

  const link = await prisma.$transaction(async (tx) => {
    const farm = await tx.farm.create({
      data: { name, owner: text(body.owner), phone: text(body.phone), city: text(body.city), state: text(body.state)?.toUpperCase() ?? null },
    })
    await addFarmMember(tx, user.id, farm.id)
    // Sem nenhuma propriedade aberta, esta já fica aberta
    if (!user.farmId) await tx.user.update({ where: { id: user.id }, data: { farmId: farm.id } })
    return tx.vetClient.create({ data: { vetId: vet.id, farmId: farm.id, farmName: farm.name, createdByVet: true } })
  })
  return NextResponse.json({ id: link.id, farmId: link.farmId, name: link.farmName }, { status: 201 })
}
