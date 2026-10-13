// Laticínio (organiza as coletas) e associação (acompanha e apoia os associados)

export type OrgType = 'laticinio' | 'associacao'

export const ORG_TYPES: Record<OrgType, { label: string; panel: string; signupTitle: string; intro: string }> = {
  laticinio: {
    label: 'Laticínio',
    panel: '/laticinio',
    signupTitle: 'Cadastro de laticínio',
    intro: 'Organize as coletas: pontos de coleta, rotas, motoristas, pendências e o leite recebido.',
  },
  associacao: {
    label: 'Associação',
    panel: '/associacao',
    signupTitle: 'Cadastro de associação',
    intro: 'Acompanhe os associados, a produção que eles compartilham e organize compras coletivas.',
  },
}

export const isOrgType = (value: unknown): value is OrgType => value === 'laticinio' || value === 'associacao'

/** Painel inicial de cada perfil que não usa a gestão da propriedade */
export function homeForRole(role: string | undefined): string {
  if (role === 'fornecedor') return '/fornecedor'
  if (role === 'laticinio') return '/laticinio'
  if (role === 'associacao') return '/associacao'
  if (role === 'lite' || role === 'motorista') return '/lite'
  return '/'
}

/** Dias da semana das rotas (0 = domingo, como Date.getDay) */
export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'] as const

/** Motivos de coleta não realizada */
export const SKIP_REASONS = ['Sem leite', 'Acesso bloqueado', 'Produtor ausente', 'Leite recusado', 'Outro'] as const
