import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { hasSupport, isSupportKind, setupSummary, supportLink, supportMessage } from '@/lib/support'

// GET ?kind=ajuda|configurar|entrar|conhecer&screen=Animais
// Rota aberta: quem ainda não tem conta também fala com o suporte. Com sessão, a mensagem vai com nome,
// propriedade e tela; sem sessão, vai genérica. O número não aparece em nenhuma tela; só no redirecionamento, na hora do clique.
export async function GET(request: NextRequest) {
  if (!hasSupport()) return NextResponse.json({ error: 'Suporte pelo WhatsApp não configurado' }, { status: 503 })

  const params = request.nextUrl.searchParams
  const kindParam = params.get('kind')
  const kind = isSupportKind(kindParam) ? kindParam : 'ajuda'
  const screen = (params.get('screen') ?? '').trim().slice(0, 60) || null

  const me = await getSessionUser()
  const farm = me?.effectiveFarmId
    ? await prisma.farm.findUnique({ where: { id: me.effectiveFarmId }, select: { name: true, city: true, state: true, segments: true } })
    : null

  let summary: string | null = null
  if (kind === 'configurar') {
    if (farm && me?.effectiveFarmId) {
      const [animals, milkDays] = await Promise.all([
        prisma.animal.count({ where: { farmId: me.effectiveFarmId, status: 'Vivo' } }),
        prisma.milkProduction.count({ where: { farmId: me.effectiveFarmId } }),
      ])
      summary = setupSummary(farm, animals, milkDays)
    } else if (!me) {
      summary = 'Ainda não criei a conta.'
    }
  }

  const text = supportMessage({ kind, name: me?.name ?? null, farmName: farm?.name ?? null, screen: kind === 'ajuda' ? screen : null, summary })
  return NextResponse.redirect(supportLink(text), 302)
}
