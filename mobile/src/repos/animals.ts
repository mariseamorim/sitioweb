import { all, one } from '@/db'
import { createLocal, currentId, deleteLocal, updateLocal } from '@/sync/local'
import { isBovine } from '@/lib/animalRules'
import { matches } from '@/lib/search'

export interface Animal {
  id: string
  code: string
  customCode: string | null
  name: string
  species: string
  /** Raça (só bovinos) */
  breed: string | null
  gender: string
  birthDate: string
  status: string
  isCastrated: number
  acquisitionType: string
  gta: string | null
  observations: string | null
  motherId: string | null
  lowDate: string | null
  lowReason: string | null
  /** 1 quando há foto guardada (só em listAnimals); a foto em si vem de getAnimalPhoto */
  hasPhoto?: number
}

/** Espécies do cadastro, por grupo (a mesma lista em src/lib/types.ts do site). Bovinos mudam de categoria pela idade. */
export const SPECIES_GROUPS: { label: string; species: string[] }[] = [
  { label: 'Bovinos', species: ['Vaca', 'Novilha', 'Bezerra', 'Touro', 'Garrote', 'Bezerro', 'Boi', 'Boi de engorda'] },
  { label: 'Búfalos', species: ['Búfala', 'Búfalo'] },
  { label: 'Equinos', species: ['Cavalo', 'Égua', 'Potro', 'Mula', 'Burro'] },
  { label: 'Ovinos e caprinos', species: ['Ovelha', 'Carneiro', 'Cabra', 'Bode'] },
  { label: 'Suínos', species: ['Porco', 'Porca'] },
  { label: 'Aves', species: ['Galinha', 'Galo', 'Pato', 'Peru'] },
  { label: 'Outros', species: ['Cachorro', 'Outro'] },
]
export const SPECIES = SPECIES_GROUPS.flatMap(g => g.species)
export const STATUSES = ['Vivo', 'Doente', 'Vendido', 'Morto']
/** Cor do selo da situação do animal (só aparência) */
export const statusTone = (s: string): 'green' | 'amber' | 'blue' | 'red' | 'muted' =>
  s === 'Vivo' ? 'green' : s === 'Doente' ? 'amber' : s === 'Vendido' ? 'blue' : s === 'Morto' ? 'red' : 'muted'
export const ACQUISITIONS = [['existente', 'Já estava na propriedade'], ['nascimento', 'Nasceu aqui'], ['compra', 'Comprado']] as const

// Busca sem acento: o SQLite só ignora maiúscula em letras sem acento, então o filtro é feito aqui
export function listAnimals(farmId: string, q = ''): Animal[] {
  const rows = all<Animal>(
    `SELECT *, EXISTS(SELECT 1 FROM animal_photos p WHERE p.id = animals.id) AS hasPhoto FROM animals WHERE farmId = ? ORDER BY name COLLATE NOCASE`,
    [farmId],
  )
  if (!q.trim()) return rows
  return rows.filter(a => matches(`${a.name} ${a.code} ${a.customCode ?? ''}`, q))
}

export const getAnimal = (id: string) => one<Animal>('SELECT * FROM animals WHERE id = ?', [currentId(id)])

/** Foto do animal (data URL) ou null. Fica fora da tabela animals: ver db/index.ts. */
export const getAnimalPhoto = (id: string) => one<{ imageUrl: string }>('SELECT imageUrl FROM animal_photos WHERE id = ?', [currentId(id)])?.imageUrl ?? null

export const animalLabel = (a: Pick<Animal, 'name' | 'code' | 'customCode'> | null | undefined) =>
  a ? `${a.name} (${a.customCode || a.code})` : 'Animal removido'

export function nextCode(farmId: string): string {
  const rows = all<{ code: string }>('SELECT code FROM animals WHERE farmId = ?', [farmId])
  const max = rows.reduce((acc, r) => { const n = Number.parseInt(r.code, 10); return Number.isFinite(n) && n > acc ? n : acc }, 0)
  return String(max + 1).padStart(2, '0')
}

export interface AnimalInput {
  name: string; species: string; gender: string; birthDate: string; status: string; customCode: string
  acquisitionType: string; isCastrated: boolean; observations: string; motherId: string | null
  /** Raça: só vale para bovino; vazio = sem raça */
  breed: string
  /** Foto em data URL; vazio = tirar a foto; ausente = não mexer na foto */
  imageUrl?: string
}

export function saveAnimal(farmId: string, input: AnimalInput, id?: string): string {
  const body = {
    name: input.name.trim(), species: input.species, breed: isBovine(input.species) ? input.breed.trim().slice(0, 40) || null : null, gender: input.gender, birthDate: input.birthDate, status: input.status,
    customCode: input.customCode.trim() || null, acquisitionType: input.acquisitionType, isCastrated: input.isCastrated,
    observations: input.observations.trim() || null, motherId: input.motherId || null,
    // Só vai quando a foto mudou: o servidor mantém a que tem (e o aparelho pode ainda não ter baixado a foto)
    ...(input.imageUrl !== undefined ? { imageUrl: input.imageUrl || null } : {}),
  }
  const row = { isCastrated: input.isCastrated ? 1 : 0 }
  if (id) {
    updateLocal({ table: 'animals', farmId, id, path: `/api/animals/${id}`, body, row })
    return id
  }
  return createLocal({ table: 'animals', farmId, path: '/api/animals', body, row: { ...row, code: nextCode(farmId) } })
}

export function removeAnimal(farmId: string, id: string) {
  deleteLocal({ table: 'animals', farmId, id, path: `/api/animals/${id}` })
}

export const animalOptions = (farmId: string) => listAnimals(farmId).map(a => ({ value: a.id, label: a.name, detail: `${a.customCode || a.code} · ${a.species}` }))
