import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { notFound, requireUser } from '@/lib/auth'
import { isDriverRole } from '@/lib/lite'

// PATCH: renomear, trocar o tipo, arquivar/reativar (active) ou, para o motorista,
// ligar o sítio a uma propriedade Pro (farmId) ou desligar (farmId: null). Arquivar mantém o histórico.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error

  const { id } = await params
  const point = await prisma.milkPoint.findFirst({ where: { id, ownerId: auth.user.id }, select: { id: true, kind: true } })
  if (!point) return notFound('Local não encontrado')

  const body = await request.json()
  const data: { name?: string; kind?: string; active?: boolean; farmId?: string | null } = {}
  if (body.name !== undefined) {
    const name = String(body.name).trim()
    if (!name) return NextResponse.json({ error: 'Informe o nome do local' }, { status: 400 })
    data.name = name
  }
  if (body.kind !== undefined) data.kind = body.kind === 'tanque' ? 'tanque' : 'sitio'
  if (typeof body.active === 'boolean') data.active = body.active

  if (body.farmId !== undefined) {
    if (!isDriverRole(auth.user.role)) {
      return NextResponse.json({ error: 'Só o motorista liga locais da rota a propriedades' }, { status: 403 })
    }
    if (body.farmId === null) {
      data.farmId = null
    } else {
      // Tanque comunitário recebe leite de vários produtores: não se liga a uma propriedade só
      if ((data.kind ?? point.kind) !== 'sitio') {
        return NextResponse.json({ error: 'Só sítios podem ser ligados a uma propriedade' }, { status: 400 })
      }
      const farm = await prisma.farm.findFirst({ where: { id: String(body.farmId), isActive: true }, select: { id: true } })
      if (!farm) return notFound('Propriedade não encontrada')
      data.farmId = farm.id
    }
  }

  const updated = await prisma.milkPoint.update({
    where: { id },
    data,
    select: { id: true, name: true, kind: true, active: true, farm: { select: { id: true, name: true, city: true, state: true } } },
  })
  return NextResponse.json(updated)
}
