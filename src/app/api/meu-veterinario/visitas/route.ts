import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireProducer } from '@/lib/auth'
import { animalToday } from '@/lib/animalRules'

// GET: visitas que os veterinários marcaram para a propriedade aberta, de hoje em diante
export async function GET() {
  const auth = await requireProducer(false)
  if ('error' in auth) return auth.error
  const visits = await prisma.vetVisit.findMany({
    where: { status: 'agendada', date: { gte: new Date(`${animalToday()}T00:00:00.000Z`) }, client: { farmId: auth.farmId, status: 'ativo' } },
    include: { vet: { select: { user: { select: { name: true } } } } },
    orderBy: [{ date: 'asc' }, { time: 'asc' }],
  })
  return NextResponse.json(visits.map((v) => ({ id: v.id, date: v.date, time: v.time, purpose: v.purpose, vet: v.vet.user.name })))
}
