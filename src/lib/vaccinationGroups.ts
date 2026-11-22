// Vacinar vários animais de uma vez: o rebanho inteiro, uma categoria (ex.: só as bezerras) ou um lote.
// Só os animais vivos entram. O app tem uma cópia em mobile/src/lib/vaccinationGroups.ts.

export type VaccTarget = 'animal' | 'rebanho' | 'categoria' | 'lote'

export const VACC_TARGETS: { key: VaccTarget; label: string }[] = [
  { key: 'animal', label: 'Um animal' },
  { key: 'rebanho', label: 'Rebanho inteiro' },
  { key: 'categoria', label: 'Uma categoria' },
  { key: 'lote', label: 'Um lote' },
]

export interface GroupAnimal { id: string; species: string; status?: string | null; lotId?: string | null }

export const isActiveAnimal = (a: { status?: string | null }) => a.status !== 'Morto' && a.status !== 'Vendido'

/** Animais que recebem a vacina para o alvo escolhido */
export function targetAnimals<T extends GroupAnimal>(animals: T[], target: VaccTarget, opts: { category?: string; lotId?: string } = {}): T[] {
  const active = animals.filter(isActiveAnimal)
  if (target === 'rebanho') return active
  if (target === 'categoria') return opts.category ? active.filter((a) => a.species === opts.category) : []
  if (target === 'lote') return opts.lotId ? active.filter((a) => a.lotId === opts.lotId) : []
  return []
}

/** Categorias do rebanho vivo com a quantidade de cada uma, a maior primeiro */
export function herdCategories(animals: GroupAnimal[]): { species: string; n: number }[] {
  const count = new Map<string, number>()
  for (const a of animals.filter(isActiveAnimal)) count.set(a.species, (count.get(a.species) ?? 0) + 1)
  return [...count.entries()].map(([species, n]) => ({ species, n })).sort((a, b) => b.n - a.n || a.species.localeCompare(b.species))
}
