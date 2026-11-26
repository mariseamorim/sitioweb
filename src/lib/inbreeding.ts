// Consanguinidade: não deixa cobrir (ou inseminar) a fêmea com o pai nem com os avôs dela.
// O pai de um animal vem da cobertura que o gerou (Reproduction.calfId = animal), com o nome e o registro do touro;
// o avô materno vem da cobertura que gerou a mãe; o avô paterno, quando o pai é um animal do rebanho, da cobertura
// que gerou esse touro. Sem a cobertura (animal comprado ou cadastrado sem ela) vale o campo Pai do cadastro
// (Animal.fatherName: nome ou registro). Sem nenhum dos dois não há como saber.
// Cópia igual em mobile/src/lib/inbreeding.ts (o app confere offline, antes de pôr na fila).

export interface PedigreeAnimal { id: string; name: string; code: string; customCode: string | null; gender: string; motherId: string | null; fatherName?: string | null }
export interface PedigreeBirth { calfId: string | null; maleName: string | null; bullRegistry: string | null }
export interface BullInfo { maleName?: string | null; bullRegistry?: string | null }
export type Kinship = 'pai' | 'avô materno' | 'avô paterno'
export interface InbreedingConflict { kinship: Kinship; bull: string }

/** Sem acento, sem diferença de maiúscula e de espaços: "Trovão " = "trovao" */
const norm = (s: string | null | undefined) => (s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * O touro informado é o pai ou um avô da fêmea? Compara pelo registro, pelo nome e, quando o nome ou o registro
 * batem com um macho do rebanho (nome, número ou brinco), pelo próprio animal.
 */
export function inbreedingConflict(femaleId: string, bull: BullInfo, animals: PedigreeAnimal[], births: PedigreeBirth[]): InbreedingConflict | null {
  if (!norm(bull.maleName) && !norm(bull.bullRegistry)) return null
  const males = animals.filter(a => a.gender === 'Macho')
  const herdMatches = (b: BullInfo) => {
    const name = norm(b.maleName)
    const registry = norm(b.bullRegistry)
    return males.filter(m => {
      const ids = [norm(m.name), norm(m.code), norm(m.customCode)].filter(Boolean)
      return (!!name && ids.includes(name)) || (!!registry && ids.includes(registry))
    })
  }
  const keys = (b: BullInfo) => {
    const set = new Set<string>()
    if (norm(b.maleName)) set.add(`n:${norm(b.maleName)}`)
    if (norm(b.bullRegistry)) set.add(`r:${norm(b.bullRegistry)}`)
    for (const m of herdMatches(b)) set.add(`a:${m.id}`)
    return set
  }
  // Pai: a cobertura que gerou o animal; sem ela, o campo Pai do cadastro (pode ser o nome ou o registro)
  const fatherOf = (id: string | null | undefined): PedigreeBirth | null => {
    if (!id) return null
    const birth = births.find(b => b.calfId === id)
    if (birth && (norm(birth.maleName) || norm(birth.bullRegistry))) return birth
    const typed = animals.find(a => a.id === id)?.fatherName
    return norm(typed) ? { calfId: id, maleName: typed!, bullRegistry: typed! } : null
  }
  const female = animals.find(a => a.id === femaleId)
  if (!female) return null

  const father = fatherOf(female.id)
  const ancestors: [Kinship, PedigreeBirth | null][] = [
    ['pai', father],
    ['avô materno', fatherOf(female.motherId)],
    ...(father ? herdMatches(father).map(m => ['avô paterno', fatherOf(m.id)] as [Kinship, PedigreeBirth | null]) : []),
  ]
  const candidate = keys(bull)
  for (const [kinship, birth] of ancestors) {
    if (!birth) continue
    for (const k of keys(birth)) if (candidate.has(k)) return { kinship, bull: (bull.maleName || bull.bullRegistry || '').trim() }
  }
  return null
}

/** Pai digitado no cadastro: sem espaços sobrando, até 80 letras; vazio = não informado */
export function cleanFatherName(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const s = value.trim().replace(/\s+/g, ' ').slice(0, 80)
  return s || null
}

/** Frase da tela e do erro do servidor; no app vai pelo t() com {bull} e {who} (o parentesco também traduzido) */
export const INBREEDING_TEXT = 'Cruzamento bloqueado: {bull} é {who} desta fêmea. Escolha outro touro ou sêmen.'
export const KINSHIP_LABEL: Record<Kinship, string> = { pai: 'o pai', 'avô materno': 'o avô por parte de mãe', 'avô paterno': 'o avô por parte de pai' }

export function inbreedingMessage(c: InbreedingConflict) {
  return INBREEDING_TEXT.replace('{bull}', c.bull).replace('{who}', KINSHIP_LABEL[c.kinship])
}
