import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { clearSessionCookies, getSessionUser, setSessionCookie } from '@/lib/auth'
import { GOOGLE_COOKIE, googleConfig, googleCookieOptions, googleIdentity, safeNext } from '@/lib/google-auth'

export async function GET(request: NextRequest) {
  const config = googleConfig()
  const origin = config?.origin ?? new URL(request.url).origin
  function redirect(path: string) {
    const res = NextResponse.redirect(new URL(path, origin))
    res.headers.set('Cache-Control', 'no-store')
    res.cookies.set(GOOGLE_COOKIE, '', { ...googleCookieOptions, maxAge: 0 })
    return res
  }
  if (!config) return redirect('/login?googleError=config')
  try {
    const raw = (await cookies()).get(GOOGLE_COOKIE)?.value
    if (!raw) return redirect('/login?googleError=state')
    const flow = JSON.parse(raw)
    const state = request.nextUrl.searchParams.get('state')
    if (!state || typeof flow.state !== 'string' || typeof flow.verifier !== 'string' || typeof flow.expires !== 'number' || flow.expires < Date.now()) return redirect('/login?googleError=state')
    const a = Buffer.from(state), b = Buffer.from(flow.state)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return redirect('/login?googleError=state')
    if (request.nextUrl.searchParams.has('error')) return redirect('/login?googleError=cancelled')
    const code = request.nextUrl.searchParams.get('code')
    if (!code) return redirect('/login?googleError=failed')
    const info = await googleIdentity(code, flow.verifier, config)
    let user = await prisma.user.findUnique({ where: { googleId: info.sub } })
    if (flow.userId) {
      const me = await getSessionUser()
      if (!me || me.id !== flow.userId) return redirect('/login?googleError=state')
      if (me.email.toLowerCase() !== info.email || (user && user.id !== me.id)) return redirect('/perfil?googleError=mismatch')
      const existing = await prisma.user.findUniqueOrThrow({ where: { id: me.id } })
      if (existing.googleId && existing.googleId !== info.sub) return redirect('/perfil?googleError=mismatch')
      await prisma.user.update({ where: { id: me.id }, data: { googleId: info.sub } })
      return redirect(`${safeNext(flow.next)}?googleLinked=1`)
    }
    if (!user) {
      // E-mails iguais não vinculam contas automaticamente. O titular conecta após entrar com senha.
      const existing = await prisma.user.findFirst({ where: { email: { equals: info.email, mode: 'insensitive' } } })
      if (existing) return redirect('/login?googleError=link')
      user = await prisma.user.create({ data: { name: info.name, email: info.email, googleId: info.sub, role: 'onboarding', permissions: [] } })
    }
    if (user.role === 'fornecedor' && user.vendorId) {
      const vendor = await prisma.vendor.findUnique({ where: { id: user.vendorId } })
      if (!vendor || vendor.status === 'bloqueado') return redirect('/login?googleError=blocked')
    }
    const next = safeNext(flow.next)
    const onboardingNext = next.startsWith('/convite/') ? `/cadastro?convite=${encodeURIComponent(next.slice('/convite/'.length).split('?')[0])}` : ['/cadastro', '/lite/cadastro', '/fornecedor/cadastro', '/organizacao/cadastro'].some(p => next.split('?')[0] === p) ? next : '/criar-conta'
    const response = redirect(user.role === 'onboarding' ? onboardingNext : next)
    clearSessionCookies(response)
    setSessionCookie(response, user.id)
    return response
  } catch {
    return redirect('/login?googleError=failed')
  }
}
