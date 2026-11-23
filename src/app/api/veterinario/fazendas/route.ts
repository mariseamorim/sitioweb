import { NextRequest, NextResponse } from 'next/server'
import { createClientFarm, requireVet } from '@/lib/vets'

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
  const link = await createClientFarm(user, vet.id, { name, owner: body.owner, phone: body.phone, city: body.city, state: body.state })
  return NextResponse.json({ id: link.id, farmId: link.farmId, name: link.farmName }, { status: 201 })
}
