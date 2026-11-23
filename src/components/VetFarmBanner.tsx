'use client'

// Veterinário: faixa no topo das telas da fazenda dizendo em qual propriedade ele está (animais, reprodução,
// vacinas, tratamentos, relatórios...) e o atalho para trocar. Na Consultoria, no Dashboard e no cadastro não aparece.
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUser } from '@/contexts/UserContext'
import { PropriedadeIcon } from '@/components/ModuleIcons'
import { useT } from '@/lib/i18n'

const OUTSIDE_FARM = ['/consultoria', '/dashboard', '/perfil', '/ajuda', '/manual', '/ofertas']

export function VetFarmBanner() {
  const { user } = useUser()
  const pathname = usePathname()
  const t = useT()
  if (!user?.vet || OUTSIDE_FARM.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm text-teal-900">
      <p className="flex min-w-0 items-center gap-2">
        <PropriedadeIcon className="h-5 w-5 shrink-0 text-teal-700" />
        {user.farmName
          ? <span>{t('Você está na propriedade')} <strong>{user.farmName}</strong></span>
          : <span>{t('Nenhuma propriedade aberta. Abra uma em Fazendas atendidas.')}</span>}
      </p>
      <Link href="/consultoria?aba=fazendas" className="rounded-lg border border-teal-600 bg-white px-3 py-1.5 font-semibold text-teal-800 hover:bg-teal-100">{t('Trocar propriedade')}</Link>
    </div>
  )
}
