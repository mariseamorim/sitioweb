'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { screenLabel, supportHref, type SupportKind } from '@/lib/support'

// Botão "Fale com o suporte pelo WhatsApp". Aponta para /api/suporte, que monta a mensagem no servidor (quem é, de onde,
// em que tela) e redireciona para o WhatsApp. Só aparece para quem está logado e quando há número configurado.
// Sem internet, fica desativado com o motivo.

interface Props {
  kind?: SupportKind
  /** button: botão verde; link: texto; menu: item do menu lateral */
  variant?: 'button' | 'link' | 'menu'
  label?: string
  className?: string
  onClick?: () => void
}

export function WhatsAppIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.14-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2.01-1.42.25-.7.25-1.29.17-1.42-.07-.12-.27-.2-.57-.35M12.05 21.78h-.01a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.9-9.88 2.64 0 5.12 1.03 6.99 2.9a9.82 9.82 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.33.16 11.89c0 2.1.55 4.14 1.59 5.95L0 24l6.3-1.65a11.88 11.88 0 0 0 5.74 1.46h.01c6.55 0 11.89-5.33 11.89-11.89 0-3.18-1.24-6.16-3.48-8.4" />
    </svg>
  )
}

const STYLE = {
  button: 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 text-sm font-semibold text-white hover:bg-green-600',
  link: 'inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 hover:underline',
  menu: 'flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900',
}
const OFFLINE = 'Sem internet não dá para abrir o WhatsApp. Tente quando tiver sinal.'

export function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  return online
}

export function SupportWhatsApp({ kind = 'ajuda', variant = 'link', label = 'Fale com o suporte pelo WhatsApp', className = '', onClick }: Props) {
  const pathname = usePathname()
  const { user } = useUser()
  const online = useOnline()
  if (!user?.support) return null

  const icon = <span aria-hidden="true" className={variant === 'menu' ? 'text-gray-400' : ''}><WhatsAppIcon className={variant === 'link' ? 'h-4 w-4' : 'h-5 w-5'} /></span>
  const classes = `${STYLE[variant]} ${className}`.trim()

  if (!online) {
    return <span role="link" aria-disabled="true" title={OFFLINE} className={`${classes} cursor-not-allowed opacity-50`}>{icon}<span>{label}</span></span>
  }
  return (
    <a href={supportHref(kind, kind === 'ajuda' ? screenLabel(pathname) : null)} target="_blank" rel="noopener noreferrer" onClick={onClick} className={classes}>
      {icon}<span>{label}</span>
    </a>
  )
}
