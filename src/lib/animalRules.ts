export const BOVINE_CATEGORIES = ['Vaca', 'Boi', 'Boi de engorda', 'Touro', 'Bezerro', 'Bezerra']
export const isBovine = (species: string) => BOVINE_CATEGORIES.includes(species)

/** Até quantos dias de vida a cria conta como "bezerro ao pé" da mãe (desmama por volta dos 8 meses) */
export const CALF_AT_FOOT_DAYS = 240

export function fixedAnimalGender(species: string): 'Fêmea' | 'Macho' | null {
  if (['Vaca', 'Bezerra'].includes(species)) return 'Fêmea'
  if (['Boi', 'Boi de engorda', 'Touro'].includes(species)) return 'Macho'
  return null
}

export interface ClassifiedAnimal {
  species: string
  gender: string
  birthDate: string | Date
  isCastrated?: boolean
  acquisitionType?: string
}

/** A mesma data de negócio no servidor e no aparelho, mesmo quando o servidor usa UTC. */
export function animalToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

export function validAnimalDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isFinite(value.getTime())) return null
  if (typeof value === 'string' && value.length > 10 && (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(new Date(value).getTime()))) return null
  const day = value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === 'string' ? value.slice(0, 10) : ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null
  const parsed = new Date(`${day}T00:00:00Z`)
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? day : null
}

/** Soma meses completos; o aniversário de 29/02 ocorre em 28/02 em ano não bissexto. */
export function ageThresholdDate(birthDate: string | Date, months: number) {
  const day = validAnimalDate(birthDate)
  if (!day) return null
  const birth = new Date(`${day}T00:00:00Z`)
  const anniversary = new Date(Date.UTC(birth.getUTCFullYear(), birth.getUTCMonth() + months, 1))
  const lastDay = new Date(Date.UTC(anniversary.getUTCFullYear(), anniversary.getUTCMonth() + 1, 0)).getUTCDate()
  anniversary.setUTCDate(Math.min(birth.getUTCDate(), lastDay))
  return anniversary.toISOString().slice(0, 10)
}

export function hasAnimalAge(birthDate: string | Date, months: number, today = animalToday()) {
  const threshold = ageThresholdDate(birthDate, months)
  return threshold !== null && threshold <= today
}

export function animalCategory(animal: ClassifiedAnimal, today = animalToday()): string {
  if (!isBovine(animal.species)) return animal.species
  if (animal.gender === 'Macho') {
    if (animal.isCastrated || animal.species === 'Boi' && animal.isCastrated === undefined) return 'Boi de engorda'
    return hasAnimalAge(animal.birthDate, 36, today) ? 'Touro' : 'Bezerro'
  }
  return hasAnimalAge(animal.birthDate, 30, today) ? 'Vaca' : 'Bezerra'
}

/** Idade mínima para cobertura (Reprodução): 2 anos */
export const BREEDING_AGE_MONTHS = 24

/** Fêmea que pode aparecer na Reprodução: bovina a partir de 2 anos (outras espécies, qualquer idade), viva */
export function canBreed(animal: ClassifiedAnimal & { status?: string }, today = animalToday()) {
  if (animal.gender !== 'Fêmea' || animal.status === 'Morto' || animal.status === 'Vendido') return false
  return !isBovine(animal.species) || hasAnimalAge(animal.birthDate, BREEDING_AGE_MONTHS, today)
}

export function canAddCalf(animal: ClassifiedAnimal, today = animalToday()) {
  return animal.gender === 'Fêmea' && isBovine(animal.species) && hasAnimalAge(animal.birthDate, 30, today)
}

export function animalRuleError(animal: ClassifiedAnimal, today = animalToday()) {
  const birth = validAnimalDate(animal.birthDate)
  if (!birth || birth > today) return 'Informe uma data de nascimento válida, que não seja futura'
  if (!['Fêmea', 'Macho'].includes(animal.gender)) return 'Sexo inválido'
  const fixedGender = fixedAnimalGender(animal.species)
  if (fixedGender && animal.gender !== fixedGender) return `O sexo de ${animal.species} deve ser ${fixedGender}`
  if (animal.isCastrated && (animal.gender !== 'Macho' || !isBovine(animal.species))) return 'A castração está disponível apenas para bovinos machos'
  if (animal.acquisitionType && !['existente', 'nascimento', 'compra'].includes(animal.acquisitionType)) return 'Origem do animal inválida'
  if (animal.acquisitionType === 'compra' && animal.gender === 'Fêmea' && (animal.species === 'Vaca' || animalCategory(animal, today) === 'Vaca') && !hasAnimalAge(animal.birthDate, 36, today)) return 'Para cadastrar uma vaca comprada, ela deve ter pelo menos 3 anos'
  return null
}
