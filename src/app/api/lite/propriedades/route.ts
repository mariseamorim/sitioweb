import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireUser } from '@/lib/auth'
import { isDriverRole } from '@/lib/lite'

// GET: o motorista procura a propriedade Pro pelo nome (e cidade) para ligar a um sítio da rota.
// Mostra só nome e localização; nenhum outro dado da propriedade.
export async function GET(request: NextRequest) {
  const auth = await requireUser()
  if ('error' in auth) return auth.error
  if (!isDriverRole(auth.user.role)) {
    return NextResponse.json({ error: 'Busca disponível só para motoristas' }, { status: 403 })
  }

  const q = (request.nextUrl.searchParams.get('q') ?? '').trim()
  const city = (request.nextUrl.searchParams.get('cidade') ?? '').trim()
  if (q.length < 3) return NextResponse.json([])

  const farms = await prisma.farm.findMany({
    where: {
      isActive: true,
      name: { contains: q, mode: 'insensitive' },
      ...(city ? { city: { contains: city, mode: 'insensitive' } } : {}),
    },
    select: { id: true, name: true, city: true, state: true },
    orderBy: { name: 'asc' },
    take: 10,
  })
  return NextResponse.json(farms)
}
