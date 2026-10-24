// Contas de todos os perfis para o administrador (tela Contas e senhas): o que a lista mostra e como sai do banco.
// A senha nunca sai daqui: vira só "tem senha" ou não.

import type { Prisma } from '@prisma/client'

export const ACCOUNT_SELECT = {
  id: true, name: true, email: true, phone: true, role: true, password: true, googleId: true, createdAt: true,
  farm: { select: { name: true } },
  vendor: { select: { companyName: true } },
  organization: { select: { name: true } },
} satisfies Prisma.UserSelect

type AccountRow = Prisma.UserGetPayload<{ select: typeof ACCOUNT_SELECT }>

export interface Account {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  /** Propriedade, empresa ou organização da conta, para o administrador reconhecer a pessoa */
  place: string | null
  hasPassword: boolean
  googleConnected: boolean
  createdAt: string
}

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    place: row.vendor?.companyName ?? row.organization?.name ?? row.farm?.name ?? null,
    hasPassword: !!row.password,
    googleConnected: !!row.googleId,
    createdAt: row.createdAt.toISOString(),
  }
}
