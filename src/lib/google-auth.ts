import { createHash, randomBytes } from 'crypto'
export { safeNext } from '@/lib/google-navigation'

export const GOOGLE_COOKIE = process.env.NODE_ENV === 'production' ? '__Host-google_oauth' : 'google_oauth'
export const googleCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: 600 }

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI
  if (!clientId || !clientSecret || !redirectUri) return null
  let url: URL
  try { url = new URL(redirectUri) } catch { return null }
  if (url.pathname !== '/api/auth/google/callback' || (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost'))) return null
  return { clientId, clientSecret, redirectUri, origin: url.origin }
}

export function oauthChallenge() {
  const verifier = randomBytes(32).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url'), state: randomBytes(32).toString('base64url') }
}

export async function googleIdentity(code: string, verifier: string, config: NonNullable<ReturnType<typeof googleConfig>>) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri, grant_type: 'authorization_code', code_verifier: verifier }),
  })
  const tokens = await response.json()
  if (!response.ok || typeof tokens.access_token !== 'string') throw new Error('GOOGLE_TOKEN')
  const infoResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    cache: 'no-store', signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const info = await infoResponse.json()
  if (!infoResponse.ok || typeof info.sub !== 'string' || !info.sub || info.email_verified !== true || typeof info.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(info.email)) throw new Error('GOOGLE_IDENTITY')
  return { sub: info.sub, email: info.email.trim().toLowerCase(), name: typeof info.name === 'string' && info.name.trim() ? info.name.trim() : info.email.split('@')[0] }
}
