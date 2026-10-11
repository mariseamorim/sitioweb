import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'

// Sem acento e sem maiúscula: "ze da racao" encontra "Zé da Ração"
const normalize = (text: string | null | undefined) =>
  (text ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// GET: produtor procura fornecedores aprovados pelo nome da loja, do contato, cidade ou o que vendem.
// Os que já são fornecedores da propriedade também aparecem, marcados (linked).
export async function GET(request: NextRequest) {
  const user = await getSessionUser()
  if (!user?.effectiveFarmId) return NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 })

  const q = normalize(request.nextUrl.searchParams.get('q')).trim()
  if (q.length < 2) return NextResponse.json([])
  const words = q.split(/\s+/)

  // Poucos fornecedores por região: filtra aqui para ignorar acentos (o banco não tem unaccent)
  const vendors = await prisma.vendor.findMany({
    where: { status: 'aprovado' },
    select: {
      id: true, companyName: true, contactName: true, city: true, state: true, description: true, categories: true,
      clients: { where: { farmId: user.effectiveFarmId }, select: { id: true } },
    },
    orderBy: { companyName: 'asc' },
    take: 1000,
  })

  const found = vendors
    .filter((v) => {
      const text = normalize([v.companyName, v.contactName, v.city, v.state, v.description, ...v.categories].join(' '))
      return words.every((w) => text.includes(w))
    })
    .slice(0, 10)
    .map(({ clients, ...v }) => ({ ...v, linked: clients.length > 0 }))
  return NextResponse.json(found)
}
