'use client'
import { usePathname } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
const FULL_BLEED_PATHS = ['/inicio']
const AUTH_PATHS = ['/login', '/cadastro', '/setup', '/fornecedor/cadastro']
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  if (FULL_BLEED_PATHS.includes(pathname)) return <>{children}</>
  if (AUTH_PATHS.includes(pathname) || pathname.startsWith('/convite/')) return <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">{children}</main>
  return <><Navbar /><div className="lg:ml-64"><main id="conteudo" tabIndex={-1} className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">{children}</main></div></>
}
