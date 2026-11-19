import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { clearSessionCookies, getSessionUser, setSessionCookie } from '@/lib/auth'
import { cleanupDemos, createDemoVet } from '@/lib/demoVet'

// A criação grava uns 1.500 registros: dá tempo à função na Vercel
export const maxDuration = 60

/** Demonstrações novas por minuto, no site todo (freio contra abuso da rota aberta) */
const PER_MINUTE = 20

// POST: entra na demonstração do veterinário (sem login). Quem já está numa demonstração continua nela;
// senão cria uma conta nova com as propriedades fictícias. Ver src/lib/demoVet.ts.
export async function POST() {
  const me = await getSessionUser()
  if (me?.isDemo) return NextResponse.json({ ok: true, reused: true })

  const recent = await prisma.user.count({ where: { isDemo: true, createdAt: { gte: new Date(Date.now() - 60_000) } } })
  if (recent >= PER_MINUTE) return NextResponse.json({ error: 'Muitas demonstrações ao mesmo tempo. Tente de novo em um minuto.' }, { status: 429 })

  await cleanupDemos()
  try {
    const userId = await createDemoVet()
    const response = NextResponse.json({ ok: true }, { status: 201 })
    clearSessionCookies(response)
    setSessionCookie(response, userId)
    return response
  } catch (e) {
    console.error('[demo] criação falhou', e)
    return NextResponse.json({ error: 'Não foi possível abrir a demonstração. Tente de novo.' }, { status: 500 })
  }
}
