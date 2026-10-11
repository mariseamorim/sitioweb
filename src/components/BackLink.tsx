import Link from 'next/link'
import { SetaDireitaIcon } from '@/components/ModuleIcons'

// "← Voltar" padrão do app: mesmo visual e lugar em todas as telas sem menu
export function BackLink({ href, label = 'Voltar', className = '' }: { href: string; label?: string; className?: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-semibold text-green-800 hover:bg-green-50 focus-visible:outline-2 focus-visible:outline-green-700 ${className}`}
    >
      <SetaDireitaIcon className="h-4 w-4 rotate-180" />
      {label}
    </Link>
  )
}
