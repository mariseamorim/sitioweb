import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { resetDemoConsultant } from '@/lib/demoVet'

// A criação grava uns 1.500 registros: dá tempo à função na Vercel
export const maxDuration = 60

// POST { password? }: cria ou renova a conta fixa de demonstração do consultor (três propriedades fictícias,
// com as datas de hoje). Sem senha, mantém a atual. Ver resetDemoConsultant em src/lib/demoVet.ts.
export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error

  const { password } = await request.json().catch(() => ({}))
  if (password !== undefined && (typeof password !== 'string' || password.length < 6)) return NextResponse.json({ error: 'A senha precisa ter pelo menos 6 caracteres' }, { status: 400 })
  try {
    const { email } = await resetDemoConsultant(password)
    return NextResponse.json({ email })
  } catch (e) {
    console.error('[demo-consultor]', e)
    const message = e instanceof Error && (e.message.startsWith('O e-mail') || e.message.startsWith('Defina')) ? e.message : 'Não foi possível criar a conta de demonstração. Tente de novo.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
