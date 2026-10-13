import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireOrganization } from '@/lib/auth'
import { cleanText } from '@/lib/laticinio'
import { SUPPLY_CATEGORIES } from '@/lib/supplies'

// POST: { title, category, unit, description?, deadline? } abre uma compra coletiva para os associados
export async function POST(request: NextRequest) {
  const auth = await requireOrganization('associacao')
  if ('error' in auth) return auth.error

  const body = await request.json()
  const title = cleanText(body.title, 120)
  const unit = cleanText(body.unit, 20)
  if (!title || !unit) return NextResponse.json({ error: 'Informe o produto e a unidade' }, { status: 400 })
  const deadline = typeof body.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.deadline) ? new Date(body.deadline) : null

  const purchase = await prisma.groupPurchase.create({
    data: {
      organizationId: auth.organization.id,
      title,
      unit,
      category: SUPPLY_CATEGORIES.includes(body.category) ? body.category : 'Outro',
      description: cleanText(body.description, 500),
      deadline,
    },
  })
  return NextResponse.json(purchase, { status: 201 })
}
