import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireFarmAccess } from '@/lib/auth'
import { milkPrice } from '@/lib/milkValidation'

export async function GET() {
  const auth = await requireFarmAccess('leite', 'view')
  if (auth.error) return auth.error
  const farm = await prisma.farm.findUnique({ where: { id: auth.farmId }, select: { milkPrice: true } })
  return NextResponse.json({ price: farm?.milkPrice ?? null }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function PUT(request: NextRequest) {
  const auth = await requireFarmAccess('leite', 'edit')
  if (auth.error) return auth.error
  let body
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 }) }
  const price = milkPrice(body?.price)
  if (price === undefined) return NextResponse.json({ error: 'Informe um preço por litro válido, por exemplo 2,50' }, { status: 400 })
  await prisma.farm.update({ where: { id: auth.farmId }, data: { milkPrice: price } })
  return NextResponse.json({ price })
}
