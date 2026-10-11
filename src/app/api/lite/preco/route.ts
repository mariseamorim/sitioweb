import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { canAccessModule, canEdit, requireUser } from '@/lib/auth'
import { usesFarmMode } from '@/lib/lite'

// PUT { price }: valor do litro (opcional) para estimar quanto vai receber. null apaga.
// No lite fica no cadastro do produtor; na versão completa, na propriedade.
export async function PUT(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  const { user } = auth

  const { price } = await request.json()
  const value = price === null || price === '' ? null : parseFloat(String(price).replace(',', '.'))
  if (value !== null && !(Number.isFinite(value) && value > 0 && value < 1000)) {
    return NextResponse.json({ error: 'Informe um valor válido, por exemplo 2,50' }, { status: 400 })
  }
  const milkPrice = value === null ? null : Math.round(value * 100) / 100

  if (usesFarmMode(user)) {
    if (!canAccessModule(user, 'leite') || !canEdit(user)) {
      return NextResponse.json({ error: 'Você não tem permissão para alterar o valor do litro' }, { status: 403 })
    }
    await prisma.farm.update({ where: { id: user.effectiveFarmId! }, data: { milkPrice } })
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { milkPrice } })
  }
  return NextResponse.json({ milkPrice })
}
