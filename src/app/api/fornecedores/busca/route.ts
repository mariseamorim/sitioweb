import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

// GET: produtor procura fornecedores aprovados por nome ou cidade
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user?.effectiveFarmId) return NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 })

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  if (q.length < 2) return NextResponse.json([])

  const vendors = await prisma.vendor.findMany({
    where: {
      status: 'aprovado',
      clients: { none: { farmId: user.effectiveFarmId } },
      OR: [
        { companyName: { contains: q, mode: 'insensitive' } },
        { city: { contains: q, mode: 'insensitive' } },
      ],
    },
    select: { id: true, companyName: true, city: true, state: true, description: true },
    take: 10,
    orderBy: { companyName: 'asc' },
  })
  return NextResponse.json(vendors)
}
