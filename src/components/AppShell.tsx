'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { PageHelp } from '@/components/PageHelp'
import { Navbar } from '@/components/Navbar'
import { useUser } from '@/contexts/UserContext'
const FULL_BLEED_PATHS = ['/inicio']
const AUTH_PATHS = ['/login', '/cadastro', '/criar-conta', '/setup', '/fornecedor/cadastro', '/organizacao/cadastro']
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useUser()
  const [desktopOpen, setDesktopOpen] = useState(true)
  // O Anota Aí Leite tem interface própria, sem o menu do app completo
  if (FULL_BLEED_PATHS.includes(pathname) || pathname === '/lite' || pathname.startsWith('/lite/')) return <>{children}</>
  // A Ajuda é aberta: sem login, aparece sem o menu, como as telas de entrada
  if (AUTH_PATHS.includes(pathname) || pathname.startsWith('/convite/') || pathname.startsWith('/associar/') || ((pathname === '/ajuda' || pathname === '/') && !user)) return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
  return <div className="app-workspace"><Navbar desktopOpen={desktopOpen} onToggleDesktop={() => setDesktopOpen(open => !open)} /><div className={desktopOpen ? 'lg:ml-64' : ''}><main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><PageHelp />{children}</main></div></div>
}
