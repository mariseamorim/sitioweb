// Administrador: propriedades agrupadas por proprietário.
// Agrupa pelo CPF/CNPJ; sem documento, pelo nome do proprietário; sem nenhum dos dois, em "Sem proprietário".
// Sem banco: usado na tela e no servidor.

import { maskDocument } from '@/lib/masks'

/** Dias sem lançamento para a propriedade contar como parada */
export const STALE_DAYS = 30

export interface AdminFarmSummary {
  id: string
  name: string
  propertyType: string | null
  documentType: string | null
  documentNumber: string | null
  owner: string | null
  phone: string | null
  address: string | null
  city: string | null
  state: string | null
  isActive: boolean
  segments: string[]
  /** Animais vivos cadastrados */
  animals: number
  /** Pessoas com acesso */
  members: number
  /** Último lançamento em qualquer módulo (ISO) ou null sem nada lançado */
  lastActivity: string | null
  createdAt: string
}

export interface OwnerGroup {
  key: string
  /** Nome do proprietário ou, sem nome, o documento */
  name: string
  /** CPF/CNPJ formatado, se houver */
  document: string | null
  /** Sem nome nem documento */
  unknown: boolean
  city: string | null
  farms: AdminFarmSummary[]
  animals: number
  /** Lançamento mais recente entre as propriedades */
  lastActivity: string | null
}

export type OwnerFilter = 'todos' | 'varias' | 'paradas' | 'semdono' | 'inativas'

export const OWNER_FILTERS: { key: OwnerFilter; label: string }[] = [
  { key: 'todos', label: 'Todas' },
  { key: 'varias', label: 'Várias propriedades' },
  { key: 'paradas', label: `Sem lançamento há ${STALE_DAYS} dias` },
  { key: 'semdono', label: 'Sem proprietário' },
  { key: 'inativas', label: 'Inativas' },
]

export const UNKNOWN_OWNER = 'Sem proprietário informado'

const digits = (v: string | null | undefined) => (v ?? '').replace(/\D/g, '')
const clean = (v: string | null | undefined) => (v ?? '').trim().replace(/\s+/g, ' ')
const fold = (v: string) => v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

const DAY = 24 * 60 * 60 * 1000

/** Dias inteiros desde a data (0 = hoje); null sem data */
export function daysSince(iso: string | null, now = new Date()): number | null {
  if (!iso) return null
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((now.getTime() - t) / DAY))
}

export const isStale = (iso: string | null, now = new Date()) => {
  const d = daysSince(iso, now)
  return d === null || d >= STALE_DAYS
}

/** "lançou hoje", "há 3 dias", "parada há 41 dias", "sem lançamentos" */
export function activityLabel(iso: string | null, now = new Date()): string {
  const d = daysSince(iso, now)
  if (d === null) return 'sem lançamentos'
  if (d === 0) return 'lançou hoje'
  if (d === 1) return 'lançou ontem'
  if (d >= STALE_DAYS) return `parada há ${d} dias`
  return `lançou há ${d} dias`
}

const later = (a: string | null, b: string | null) => (!a ? b : !b ? a : Date.parse(a) >= Date.parse(b) ? a : b)

/** Monta os grupos. Ordem: nome do proprietário; "Sem proprietário" por último. Propriedades por nome. */
export function groupFarmsByOwner(farms: AdminFarmSummary[]): OwnerGroup[] {
  const map = new Map<string, OwnerGroup>()
  for (const farm of farms) {
    const doc = digits(farm.documentNumber)
    const owner = clean(farm.owner)
    const key = doc ? `doc:${doc}` : owner ? `nome:${fold(owner)}` : 'sem-dono'
    let group = map.get(key)
    if (!group) {
      group = {
        key,
        name: owner || (doc ? maskDocument(doc, farm.documentType ?? undefined) : UNKNOWN_OWNER),
        document: doc ? maskDocument(doc, farm.documentType ?? undefined) : null,
        unknown: key === 'sem-dono',
        city: null,
        farms: [],
        animals: 0,
        lastActivity: null,
      }
      map.set(key, group)
    }
    // O primeiro nome informado vale para o grupo (o mesmo documento pode ter o nome escrito de jeitos diferentes)
    if (!group.unknown && owner && group.name === group.document) group.name = owner
    if (!group.city && (farm.city || farm.state)) group.city = [farm.city, farm.state].filter(Boolean).join(', ')
    group.farms.push(farm)
    if (farm.isActive) group.animals += farm.animals
    group.lastActivity = later(group.lastActivity, farm.lastActivity)
  }
  const groups = [...map.values()]
  for (const g of groups) g.farms.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  return groups.sort((a, b) => (a.unknown === b.unknown ? a.name.localeCompare(b.name, 'pt-BR') : a.unknown ? 1 : -1))
}

/** Texto onde a busca procura: dono, documento, propriedades e cidades */
export function ownerSearchText(group: OwnerGroup): string {
  return fold([
    group.name,
    group.document ?? '',
    digits(group.document),
    ...group.farms.flatMap((f) => [f.name, f.city ?? '', f.state ?? '', f.owner ?? '']),
  ].join(' '))
}

/** Aplica filtro e busca. Devolve o grupo só com as propriedades que entram (ou null se nenhuma). */
export function filterOwnerGroups(groups: OwnerGroup[], filter: OwnerFilter, query: string, now = new Date()): OwnerGroup[] {
  const q = fold(clean(query))
  const result: OwnerGroup[] = []
  for (const group of groups) {
    if (q && !ownerSearchText(group).includes(q)) continue
    const active = group.farms.filter((f) => f.isActive)
    let farms: AdminFarmSummary[]
    if (filter === 'inativas') farms = group.farms.filter((f) => !f.isActive)
    else if (filter === 'paradas') farms = active.filter((f) => isStale(f.lastActivity, now))
    // "Sem proprietário" junta donos diferentes: não conta como alguém com várias propriedades
    else if (filter === 'varias') farms = !group.unknown && active.length > 1 ? active : []
    else if (filter === 'semdono') farms = group.unknown ? active : []
    else farms = active
    if (!farms.length) continue
    result.push({ ...group, farms })
  }
  return result
}

export interface OwnerTotals {
  owners: number
  farms: number
  stale: number
  unknown: number
  inactive: number
}

/** Números do topo da tela, contando só as propriedades ativas (inativas à parte) */
export function ownerTotals(groups: OwnerGroup[], now = new Date()): OwnerTotals {
  const totals: OwnerTotals = { owners: 0, farms: 0, stale: 0, unknown: 0, inactive: 0 }
  for (const g of groups) {
    const active = g.farms.filter((f) => f.isActive)
    totals.inactive += g.farms.length - active.length
    if (!active.length) continue
    if (g.unknown) totals.unknown += active.length
    else totals.owners++
    totals.farms += active.length
    totals.stale += active.filter((f) => isStale(f.lastActivity, now)).length
  }
  return totals
}
