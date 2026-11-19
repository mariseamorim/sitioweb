'use client'
import { useT, type Vars } from '@/lib/i18n'

/** Texto traduzido dentro de um componente de servidor: <T k="Painel" />. A chave é o texto em português. */
export function T({ k, vars }: { k: string; vars?: Vars }) {
  const t = useT()
  return <>{t(k, vars)}</>
}
