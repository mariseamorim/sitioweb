// Nome de cada perfil de conta, como aparece para o administrador e nas listas

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
