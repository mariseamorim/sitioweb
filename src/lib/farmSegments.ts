// O que a propriedade faz. Uma propriedade pode ter mais de um. (Sem banco: usado também nas telas.)
export const FARM_SEGMENTS = [
  { key: 'leite', label: 'Leite' },
  { key: 'cria', label: 'Cria' },
  { key: 'recria', label: 'Recria' },
  { key: 'engorda', label: 'Engorda' },
] as const

export type FarmSegment = (typeof FARM_SEGMENTS)[number]['key']

const SEGMENT_KEYS: string[] = FARM_SEGMENTS.map((s) => s.key)

/** Lista válida de segmentos, sem repetição; null se vier algo que não é segmento. */
export function parseSegments(value: unknown): FarmSegment[] | null {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string' || !SEGMENT_KEYS.includes(v))) return null
  return SEGMENT_KEYS.filter((k) => value.includes(k)) as FarmSegment[]
}
