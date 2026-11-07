// Nome de cada perfil de conta, como aparece para o administrador (igual ao site: src/lib/roles.ts)

export const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Leitor',
  fornecedor: 'Fornecedor',
  laticinio: 'Laticínio',
  associacao: 'Associação',
  lite: 'Anota Aí Leite',
  motorista: 'Motorista',
  onboarding: 'Cadastro incompleto',
}

export const roleLabel = (role: string) => ROLE_LABELS[role] ?? role
