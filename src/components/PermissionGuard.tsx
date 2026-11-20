'use client'

import { useUser } from '@/contexts/UserContext'
import { CadeadoIcon } from '@/components/ModuleIcons'
import { useT } from '@/lib/i18n'

interface Props {
  module: string
  children: React.ReactNode
}

export function PermissionGuard({ module, children }: Props) {
  const { loading, canAccess } = useUser()
  const t = useT()

  if (loading) {
    return <p className="text-gray-400 text-sm mt-8">{t('Carregando...')}</p>
  }

  if (!canAccess(module)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <CadeadoIcon className="w-12 h-12 mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">{t('Acesso negado')}</h2>
        <p className="text-gray-400 text-sm">{t('Você não tem permissão para acessar este módulo.')}</p>
        <p className="text-gray-400 text-xs mt-1">{t('Solicite ao administrador que conceda acesso.')}</p>
      </div>
    )
  }

  return <>{children}</>
}
