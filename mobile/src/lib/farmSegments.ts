// O que a propriedade faz. Uma propriedade pode ter mais de um. Porte de src/lib/farmSegments.ts do site.
export const FARM_SEGMENTS = [
  { key: 'leite', label: 'Leite' },
  { key: 'cria', label: 'Cria' },
  { key: 'recria', label: 'Recria' },
  { key: 'engorda', label: 'Engorda' },
] as const

export type FarmSegment = (typeof FARM_SEGMENTS)[number]['key']

/** Corte ou leite, pelo que a propriedade faz (cria, recria e engorda = corte); null = não informado */
export function farmKind(segments: readonly string[] | null | undefined): 'Leite' | 'Corte' | 'Leite e corte' | null {
  const list = segments ?? []
  const milk = list.includes('leite')
  const beef = list.some((s) => s === 'cria' || s === 'recria' || s === 'engorda')
  return milk && beef ? 'Leite e corte' : milk ? 'Leite' : beef ? 'Corte' : null
}

export const PROPERTY_TYPES = ['Fazenda', 'Sítio'] as const
export const DOCUMENT_TYPES = ['CNPJ', 'CPF'] as const
