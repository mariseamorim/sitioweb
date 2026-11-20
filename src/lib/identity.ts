// Identificação da conta: e-mail ou telefone, os dois opcionais, pelo menos um.
// O telefone é guardado só com números, para servir de login e não repetir:
//   Brasil: DDD + número, sem o 55 (10 ou 11 dígitos);
//   Paraguai: 595 + número sem o 0 da frente (11 ou 12 dígitos). Nenhum número do Brasil guardado começa com 595
//   (não existe DDD 59), então os dois não se confundem.
// Sem banco: usado nas telas e nas rotas.

import { maskPhone } from '@/lib/masks'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isEmail = (v: string) => EMAIL_RE.test(v.trim())

/** Telefone só com números (ver acima). null se não for um telefone do Brasil nem do Paraguai. */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  let digits = String(value).replace(/\D/g, '')
  const py = paraguayPhone(digits)
  if (py) return py
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2)
  if (digits.length !== 10 && digits.length !== 11) return null
  if (digits[0] === '0' || digits[2] === '0') return null
  return digits
}

/** Paraguai: +595 981 123456, 0981 123456 ou 981 123456 (celular, 9 dígitos começando com 9); fixo 021 123456. */
function paraguayPhone(digits: string): string | null {
  let national: string | null = null
  if (digits.startsWith('595') && (digits.length === 11 || digits.length === 12)) national = digits.slice(3)
  else if (digits.startsWith('0') && (digits.length === 9 || digits.length === 10)) national = digits.slice(1)
  else if (digits.length === 9 && digits.startsWith('9')) national = digits
  if (!national || national.startsWith('0')) return null
  // Celular: 9 + 8 dígitos; fixo: código de área (2 a 3 dígitos) + 5 a 7 dígitos
  if (national.startsWith('9') ? national.length !== 9 : national.length < 8 || national.length > 9) return null
  return '595' + national
}

/**
 * Estado (Brasil, sigla de duas letras) ou departamento (Paraguai, nome como "Alto Paraná").
 * Devolve o texto a gravar, null se vazio, ou 'invalid'.
 */
export function normalizeRegion(value: unknown): string | null | 'invalid' {
  if (value === null || value === undefined) return null
  const text = String(value).trim().replace(/\s+/g, ' ')
  if (!text) return null
  if (/^[A-Za-z]{2}$/.test(text)) return text.toUpperCase()
  return /^[\p{L} .'-]{3,40}$/u.test(text) ? text : 'invalid'
}

/** Como normalizeRegion, mas texto inválido vira null (campos opcionais que não devem barrar o cadastro) */
export function regionOrNull(value: unknown): string | null {
  const region = normalizeRegion(value)
  return region === 'invalid' ? null : region
}

/** E-mail limpo em minúsculas, ou null se vazio; 'invalid' se não parecer e-mail */
export function normalizeEmail(value: unknown): string | null | 'invalid' {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') return 'invalid'
  const email = value.trim().toLowerCase()
  if (!email) return null
  return EMAIL_RE.test(email) ? email : 'invalid'
}

/** O que a pessoa digitou no login: e-mail ou telefone */
export function parseLogin(value: unknown): { email: string } | { phone: string } | null {
  if (typeof value !== 'string') return null
  const text = value.trim()
  if (!text) return null
  if (text.includes('@')) return EMAIL_RE.test(text) ? { email: text.toLowerCase() } : null
  const phone = normalizePhone(text)
  return phone ? { phone } : null
}

/** Como mostrar a conta: e-mail ou telefone formatado */
export function contactLabel(user: { email?: string | null; phone?: string | null }): string {
  if (user.email) return user.email
  if (user.phone) return maskPhone(user.phone)
  return ''
}

/** Validação comum do cadastro: nome, pelo menos um contato e senha */
export function validateContact(input: { email?: unknown; phone?: unknown }): { email: string | null; phone: string | null } | { error: string } {
  const email = normalizeEmail(input.email)
  if (email === 'invalid') return { error: 'E-mail inválido' }
  const rawPhone = typeof input.phone === 'string' ? input.phone.trim() : ''
  const phone = rawPhone ? normalizePhone(rawPhone) : null
  if (rawPhone && !phone) return { error: 'Telefone inválido. Use o DDD e o número, como (35) 99999-0000, ou +595 981 123456 no Paraguai' }
  if (!email && !phone) return { error: 'Informe um telefone ou um e-mail para entrar' }
  return { email, phone }
}
