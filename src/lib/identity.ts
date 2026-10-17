// Identificação da conta: e-mail ou telefone, os dois opcionais, pelo menos um.
// O telefone é guardado só com números (DDD + número), para servir de login e não repetir.
// Sem banco: usado nas telas e nas rotas.

import { maskPhone } from '@/lib/masks'

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const isEmail = (v: string) => EMAIL_RE.test(v.trim())

/** Telefone só com números, sem o DDI 55: 10 dígitos (fixo) ou 11 (celular). null se não for um telefone. */
export function normalizePhone(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null
  let digits = String(value).replace(/\D/g, '')
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) digits = digits.slice(2)
  if (digits.length !== 10 && digits.length !== 11) return null
  if (digits[2] === '0') return null
  return digits
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
  if (rawPhone && !phone) return { error: 'Telefone inválido. Use o DDD e o número, como (35) 99999-0000' }
  if (!email && !phone) return { error: 'Informe um telefone ou um e-mail para entrar' }
  return { email, phone }
}
