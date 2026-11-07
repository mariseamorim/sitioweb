// O que a propriedade faz. Uma propriedade pode ter mais de um. Porte de src/lib/farmSegments.ts do site.
export const FARM_SEGMENTS = [
  { key: 'leite', label: 'Leite' },
  { key: 'cria', label: 'Cria' },
  { key: 'recria', label: 'Recria' },
  { key: 'engorda', label: 'Engorda' },
] as const

export type FarmSegment = (typeof FARM_SEGMENTS)[number]['key']

export const PROPERTY_TYPES = ['Fazenda', 'Sítio'] as const
export const DOCUMENT_TYPES = ['CNPJ', 'CPF'] as const
