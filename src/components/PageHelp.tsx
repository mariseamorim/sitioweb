'use client'
import { usePathname } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { SupportWhatsApp } from '@/components/SupportWhatsApp'
import { PAGE_HELP, canSeeHelp } from '@/lib/pageHelp'
export function PageHelp() {
  const pathname = usePathname()
  const { user, canAccess } = useUser()
  const item = PAGE_HELP[pathname]
  if (!item || !canSeeHelp(item, user, canAccess)) return null
  return <details key={pathname} className="mb-5 rounded-xl border border-green-100 bg-green-50/60 px-4">
    <summary className="cursor-pointer py-3 text-sm font-semibold text-green-900">Como usar esta tela</summary>
    <ol className="list-decimal space-y-2 pb-4 pl-5 text-sm leading-relaxed text-gray-700">{item.steps.map(step => <li key={step}>{step}</li>)}</ol>
    <p className="border-t border-green-100 py-3 text-sm text-gray-600">Não resolveu? <SupportWhatsApp /></p>
  </details>
}
