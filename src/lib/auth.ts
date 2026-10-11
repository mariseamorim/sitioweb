import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'crypto'
import { promisify } from 'util'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const scryptAsync = promisify(scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

export const SESSION_COOKIE = 'session'
export const ACTIVE_FARM_COOKIE = 'activeFarmId'
const SESSION_MAX_AGE = 60 * 60 * 24 * 30 // 30 dias

// ── Senhas ──────────────────────────────────────────────────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const hash = await scryptAsync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`
}

/** Aceita o formato novo (scrypt) e senhas antigas em texto puro, para migrar no login. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith('scrypt$')) {
    const [, saltHex, hashHex] = stored.split('$')
    const expected = Buffer.from(hashHex, 'hex')
    const actual = await scryptAsync(password, Buffer.from(saltHex, 'hex'), expected.length)
    return timingSafeEqual(actual, expected)
  }
  const a = Buffer.from(password)
  const b = Buffer.from(stored)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function isLegacyPassword(stored: string): boolean {
  return !stored.startsWith('scrypt$')
}

// ── Sessão (cookie assinado com HMAC) ───────────────────────────────────

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (secret) return secret
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET não configurado')
  }
  return 'dev-only-secret-troque-em-producao'
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('base64url')
}

function createSessionToken(userId: string): string {
  const expires = Date.now() + SESSION_MAX_AGE * 1000
  const payload = `${userId}.${expires}`
  return `${payload}.${sign(payload)}`
}

function readSessionToken(token: string | undefined): string | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, expires, signature] = parts
  const expected = Buffer.from(sign(`${userId}.${expires}`))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  if (Number(expires) < Date.now()) return null
  return userId
}

export function setSessionCookie(response: NextResponse, userId: string) {
  response.cookies.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  })
}

export function clearSessionCookies(response: NextResponse) {
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 })
  response.cookies.set(ACTIVE_FARM_COOKIE, '', { path: '/', maxAge: 0 })
}

// ── Usuário da requisição ───────────────────────────────────────────────

export interface SessionUser {
  id: string
  name: string
  email: string
  role: string
  permissions: string[] | null
  farmId: string | null
  /** Empresa do usuário quando role = "fornecedor" */
  vendorId: string | null
  /** Fazenda em uso: a do usuário ou, para admin, a escolhida no seletor. */
  effectiveFarmId: string | null
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies()
  const userId = readSessionToken(cookieStore.get(SESSION_COOKIE)?.value)
  if (!userId) return null

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, permissions: true, farmId: true, vendorId: true },
  })
  if (!user) return null

  const effectiveFarmId = user.role === 'admin'
    ? cookieStore.get(ACTIVE_FARM_COOKIE)?.value ?? null
    : user.farmId

  return {
    ...user,
    permissions: Array.isArray(user.permissions) ? (user.permissions as string[]) : null,
    effectiveFarmId,
  }
}

export function canAccessModule(user: SessionUser, module: string): boolean {
  if (user.role === 'admin') return true
  return !!user.permissions?.includes(module)
}

export function canEdit(user: SessionUser): boolean {
  return user.role === 'admin' || user.role === 'editor'
}

type AccessResult =
  | { user: SessionUser; farmId: string; error?: undefined }
  | { error: NextResponse; user?: undefined; farmId?: undefined }

/**
 * Garante login, permissão no módulo e uma fazenda ativa.
 * Uso: const auth = await requireFarmAccess('leite', 'edit'); if (auth.error) return auth.error
 */
export async function requireFarmAccess(module: string, mode: 'view' | 'edit'): Promise<AccessResult> {
  const user = await getSessionUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 }) }
  }
  if (!canAccessModule(user, module) || (mode === 'edit' && !canEdit(user))) {
    return { error: NextResponse.json({ error: 'Você não tem permissão para esta ação' }, { status: 403 }) }
  }
  if (!user.effectiveFarmId) {
    return { error: NextResponse.json({ error: 'Selecione uma propriedade' }, { status: 400 }) }
  }
  return { user, farmId: user.effectiveFarmId }
}

/** Garante que é um fornecedor com empresa não bloqueada. */
export async function requireVendor() {
  const user = await getSessionUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 }) } as const
  }
  const vendor = user.role === 'fornecedor' && user.vendorId
    ? await prisma.vendor.findUnique({ where: { id: user.vendorId } })
    : null
  if (!vendor || vendor.status === 'bloqueado') {
    return { error: NextResponse.json({ error: 'Acesso restrito a fornecedores' }, { status: 403 }) } as const
  }
  return { user, vendor } as const
}

/** Produtor (qualquer perfil com propriedade ativa, exceto fornecedor). */
export async function requireProducer(edit: boolean) {
  const user = await getSessionUser()
  if (!user?.effectiveFarmId || user.role === 'fornecedor') {
    return { error: NextResponse.json({ error: 'Faça login com uma propriedade' }, { status: 401 }) } as const
  }
  if (edit && !canEdit(user)) {
    return { error: NextResponse.json({ error: 'Você não tem permissão para esta ação' }, { status: 403 }) } as const
  }
  return { user, farmId: user.effectiveFarmId } as const
}

/** Qualquer usuário logado (usado pelo Anota Aí Leite). */
export async function requireUser() {
  const user = await getSessionUser()
  if (!user) return { error: NextResponse.json({ error: 'Faça login para continuar' }, { status: 401 }) } as const
  return { user } as const
}

export async function requireAdmin() {
  const user = await getSessionUser()
  if (!user || user.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Acesso restrito ao administrador' }, { status: 403 }) } as const
  }
  return { user } as const
}

export function notFound(message = 'Registro não encontrado') {
  return NextResponse.json({ error: message }, { status: 404 })
}
