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

const UNIT_PLURAL: Record<string, string> = { saco: 'sacos', litro: 'litros', unidade: 'unidades', dose: 'doses', kg: 'kg' }

/** Quantidade da compra coletiva: "4 sacos", "1 saco", "2,5 kg" */
export function qtyWithUnit(quantity: number, unit: string) {
  const one = unit.toLowerCase()
  const label = quantity === 1 ? one : UNIT_PLURAL[one] ?? one
  return `${quantity.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${label}`
}

/** "1 associado pediu", "2 associados pediram" */
export const membersOrdered = (n: number) => (n === 1 ? '1 associado pediu' : `${n} associados pediram`)

/** Motivos de coleta não realizada */
export const SKIP_REASONS = ['Sem leite', 'Acesso bloqueado', 'Produtor ausente', 'Leite recusado', 'Outro'] as const
