'use client'
import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { PageHelp } from '@/components/PageHelp'
import { Navbar } from '@/components/Navbar'
const FULL_BLEED_PATHS = ['/inicio']
const AUTH_PATHS = ['/login', '/cadastro', '/setup', '/fornecedor/cadastro']
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [desktopOpen, setDesktopOpen] = useState(true)
  if (FULL_BLEED_PATHS.includes(pathname)) return <>{children}</>
  if (AUTH_PATHS.includes(pathname) || pathname.startsWith('/convite/')) return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
  return <div className="app-workspace"><Navbar desktopOpen={desktopOpen} onToggleDesktop={() => setDesktopOpen(open => !open)} /><div className={desktopOpen ? 'lg:ml-64' : ''}><main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"><PageHelp />{children}</main></div></div>
}
