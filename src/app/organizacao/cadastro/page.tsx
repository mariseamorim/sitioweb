import type { Metadata } from 'next'
import { isOrgType } from '@/lib/organizations'
import { OrgSignupForm } from './OrgSignupForm'

export const metadata: Metadata = { title: 'Cadastro - Anota Aí Agro' }

// Cadastro de laticínio ou associação (?tipo=laticinio | associacao)
export default async function OrganizacaoCadastroPage({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const { tipo } = await searchParams
  return <OrgSignupForm type={isOrgType(tipo) ? tipo : 'laticinio'} />
}
