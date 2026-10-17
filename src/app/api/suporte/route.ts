import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/lib/auth'
import { hasSupport, isSupportKind, setupSummary, supportLink, supportMessage } from '@/lib/support'

// GET ?kind=ajuda|configurar|entrar|conhecer&screen=Animais
// Só para quem está logado: monta a mensagem com nome, propriedade e tela e redireciona para o WhatsApp do suporte.
// O número não aparece em nenhuma tela; só no redirecionamento, na hora do clique.
export async function GET(request: NextRequest) {
  const me = await getSessionUser()
  if (!me) return NextResponse.json({ error: 'Entre no sistema para falar com o suporte' }, { status: 401 })
  if (!hasSupport()) return NextResponse.json({ error: 'Suporte pelo WhatsApp não configurado' }, { status: 503 })

  const params = request.nextUrl.searchParams
  const kindParam = params.get('kind')
  const kind = isSupportKind(kindParam) ? kindParam : 'ajuda'
  const screen = (params.get('screen') ?? '').trim().slice(0, 60) || null

  const farm = me.effectiveFarmId
    ? await prisma.farm.findUnique({ where: { id: me.effectiveFarmId }, select: { name: true, city: true, state: true, segments: true } })
    : null

  let summary: string | null = null
  if (kind === 'configurar' && farm && me.effectiveFarmId) {
    const [animals, milkDays] = await Promise.all([
      prisma.animal.count({ where: { farmId: me.effectiveFarmId, status: 'Vivo' } }),
      prisma.milkProduction.count({ where: { farmId: me.effectiveFarmId } }),
    ])
    summary = setupSummary(farm, animals, milkDays)
  }

  const text = supportMessage({ kind, name: me.name, farmName: farm?.name ?? null, screen: kind === 'ajuda' ? screen : null, summary })
  return NextResponse.redirect(supportLink(text), 302)
}
