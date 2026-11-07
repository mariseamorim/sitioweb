// Propriedades (tabela local `farms`: /api/farms para o produtor, /api/admin/propriedades para o administrador).
import { all, one, parseJson, patchRow, upsert, type Row } from '@/db'
import { notifyChange } from '@/db/events'
import type { AdminFarmSummary } from '@/lib/ownerGroups'
import { createLocal, deleteLocal, isLocalId, queueRequest, updateLocal } from '@/sync/local'

export type Farm = AdminFarmSummary

function fromRow(r: Row): Farm {
  const text = (k: string) => ((r[k] as string | null | undefined) ?? null)
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    propertyType: text('propertyType'),
    documentType: text('documentType'),
    documentNumber: text('documentNumber'),
    owner: text('owner'),
    phone: text('phone'),
    address: text('address'),
    city: text('city'),
    state: text('state'),
    // /api/farms do produtor traz isActive; sem a coluna, a propriedade conta como ativa
    isActive: r.isActive === null || r.isActive === undefined ? true : Number(r.isActive) !== 0,
    segments: parseJson<string[]>(r.segments, []),
    animals: Number(r.animals ?? 0),
    members: Number(r.members ?? 0),
    lastActivity: text('lastActivity'),
    createdAt: text('createdAt') ?? '',
  }
}

/** Todas as propriedades conhecidas (a lista baixada com a propriedade aberta). */
export function listFarms(farmId: string): Farm[] {
  return all('SELECT * FROM farms WHERE farmId = ? ORDER BY name COLLATE NOCASE', [farmId]).map(fromRow)
}

export function getFarm(id: string): Farm | null {
  const r = one('SELECT * FROM farms WHERE id = ?', [id])
  return r ? fromRow(r) : null
}

export interface FarmInput {
  name: string; propertyType: string; documentType: string; documentNumber: string; owner: string
  phone: string; address: string; city: string; state: string; segments: string[]
}

export const EMPTY_FARM: FarmInput = {
  name: '', propertyType: 'Fazenda', documentType: 'CNPJ', documentNumber: '', owner: '', phone: '', address: '', city: '', state: '', segments: [],
}

/** Corpo de POST/PATCH /api/farms, igual ao formulário do site */
export function farmBody(input: FarmInput) {
  return {
    name: input.name.trim(),
    propertyType: input.propertyType,
    documentType: input.documentType,
    documentNumber: input.documentNumber.trim(),
    owner: input.owner.trim(),
    phone: input.phone.trim(),
    address: input.address.trim(),
    city: input.city.trim(),
    state: input.state.trim().toUpperCase(),
    segments: input.segments,
  }
}

/** Cadastra no aparelho e agenda o POST (administrador, ou produtor sem internet). Devolve o id local. */
export function createFarmLocal(farmId: string, input: FarmInput): string {
  return createLocal({ table: 'farms', farmId, path: '/api/farms', body: farmBody(input), row: { isActive: 1 } })
}

/** PATCH /api/farms/{id} */
export function updateFarm(farmId: string, id: string, input: FarmInput) {
  updateLocal({ table: 'farms', farmId, id, path: `/api/farms/${id}`, body: farmBody(input), method: 'PATCH' })
}

/** Guarda a propriedade que o servidor acabou de devolver (criação com internet). */
export function adoptFarm(farmId: string, farm: Row) {
  upsert('farms', farmId, farm)
  notifyChange()
}

/**
 * DELETE /api/farms/{id}/delete: o servidor apaga se não houver registros, senão só desativa.
 * No aparelho a propriedade fica como inativa até a próxima sincronização dizer o que aconteceu.
 */
export function removeFarm(farmId: string, id: string) {
  if (isLocalId(id)) {
    deleteLocal({ table: 'farms', farmId, id, path: `/api/farms/${id}/delete` })
    return
  }
  patchRow('farms', id, { isActive: 0 })
  queueRequest({ farmId, module: 'fazendas', method: 'DELETE', path: `/api/farms/${id}/delete` })
}
