import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth'
import { GOOGLE_COOKIE, googleConfig, googleCookieOptions, oauthChallenge, safeNext } from '@/lib/google-auth'

export async function GET(request: NextRequest) {
  const config = googleConfig()
  if (!config) return NextResponse.redirect(new URL('/login?googleError=config', request.url))
  const { state, verifier, challenge } = oauthChallenge()
  const linking = request.nextUrl.searchParams.get('link') === '1'
  const me = linking ? await getSessionUser() : null
  if (linking && !me) return NextResponse.redirect(new URL('/login', config.origin))
  const next = safeNext(request.nextUrl.searchParams.get('next'))
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: 'code', scope: 'openid email profile', state, code_challenge: challenge, code_challenge_method: 'S256', prompt: 'select_account' })
  const response = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
  response.headers.set('Cache-Control', 'no-store')
  response.cookies.set(GOOGLE_COOKIE, JSON.stringify({ state, verifier, next, userId: me?.id ?? null, expires: Date.now() + 600000 }), googleCookieOptions)
  return response
}
