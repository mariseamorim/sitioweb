import type { Metadata } from 'next'
import { OrgSignupForm } from './OrgSignupForm'

export const metadata: Metadata = { title: 'Cadastro - Anota Aí Agro' }

// Cadastro de laticínio. Associação não aceita mais cadastro novo; as contas existentes continuam funcionando.
export default function OrganizacaoCadastroPage() {
  return <OrgSignupForm type="laticinio" />
}
