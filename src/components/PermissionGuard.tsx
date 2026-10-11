'use client'

import { useUser } from '@/contexts/UserContext'
import { CadeadoIcon } from '@/components/ModuleIcons'

interface Props {
  module: string
  children: React.ReactNode
}

export function PermissionGuard({ module, children }: Props) {
  const { loading, canAccess } = useUser()

  if (loading) {
    return <p className="text-gray-400 text-sm mt-8">Carregando...</p>
  }

  if (!canAccess(module)) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <CadeadoIcon className="w-12 h-12 mb-4 text-gray-300" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Acesso negado</h2>
        <p className="text-gray-400 text-sm">Você não tem permissão para acessar este módulo.</p>
        <p className="text-gray-400 text-xs mt-1">Solicite ao administrador que conceda acesso.</p>
      </div>
    )
  }

  return <>{children}</>
}
