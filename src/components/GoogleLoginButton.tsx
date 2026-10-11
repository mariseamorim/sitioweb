'use client'
import { useEffect, useState } from 'react'

export const GOOGLE_ERRORS: Record<string, string> = {
  config: 'O login Google ainda não foi configurado. Você pode entrar com e-mail e senha.',
  state: 'A tentativa de login expirou. Tente novamente.',
  cancelled: 'O login Google foi cancelado.',
  failed: 'Não foi possível entrar com Google. Tente novamente.',
  link: 'Este e-mail já tem uma conta. Entre com sua senha e conecte o Google em Meu cadastro.',
  blocked: 'O cadastro deste fornecedor está bloqueado.',
  mismatch: 'Escolha a conta Google com o mesmo e-mail do seu cadastro.',
}

export function GoogleLoginButton({ next, link = false }: { next?: string; link?: boolean }) {
  const [enabled, setEnabled] = useState(false)
  useEffect(() => { fetch('/api/auth/google/config', { cache: 'no-store' }).then(r => r.json()).then(data => setEnabled(data.enabled === true)).catch(() => {}) }, [])
  if (!enabled) return null
  return <button type="button" onClick={() => {
    const params = new URLSearchParams({ next: next ?? new URLSearchParams(window.location.search).get('next') ?? '/' })
    if (link) params.set('link', '1')
    window.location.href = `/api/auth/google?${params}`
  }} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50">{link ? 'Conectar conta Google' : 'Continuar com Google'}</button>
}
