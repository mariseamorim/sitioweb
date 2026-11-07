import { all, one } from '@/db'
import { createLocal, deleteLocal, updateLocal } from '@/sync/local'

export interface Animal {
  id: string
  code: string
  customCode: string | null
  name: string
  species: string
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
}

export const SPECIES = ['Vaca', 'Boi', 'Boi de engorda', 'Touro', 'Bezerro', 'Bezerra', 'Cavalo', 'Égua', 'Cabra', 'Bode', 'Ovelha', 'Carneiro', 'Porco', 'Porca', 'Outro']
export const STATUSES = ['Vivo', 'Doente', 'Vendido', 'Morto']
export const ACQUISITIONS = [['existente', 'Já estava na propriedade'], ['nascimento', 'Nasceu aqui'], ['compra', 'Comprado']] as const

export function listAnimals(farmId: string, q = ''): Animal[] {
  const term = `%${q.trim().toLowerCase()}%`
  return all<Animal>(
    `SELECT * FROM animals WHERE farmId = ? AND (? = '%%' OR lower(name) LIKE ? OR lower(code) LIKE ? OR lower(coalesce(customCode, '')) LIKE ?) ORDER BY name COLLATE NOCASE`,
    [farmId, term, term, term, term],
  )
}

export const getAnimal = (id: string) => one<Animal>('SELECT * FROM animals WHERE id = ?', [id])

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
}

export function saveAnimal(farmId: string, input: AnimalInput, id?: string): string {
  const body = {
    name: input.name.trim(), species: input.species, gender: input.gender, birthDate: input.birthDate, status: input.status,
    customCode: input.customCode.trim() || null, acquisitionType: input.acquisitionType, isCastrated: input.isCastrated,
    observations: input.observations.trim() || null, motherId: input.motherId || null,
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
