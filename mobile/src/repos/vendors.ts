// Ofertas, pedidos/mensagens e meus fornecedores: leitura do banco local e escritas pela fila de envio.
import { all, getMeta, parseJson, upsert, type Row } from '@/db'
import { notifyChange } from '@/db/events'
import { api } from '@/api/client'
import { createLocal, deleteLocal, queueRequest, updateLocal } from '@/sync/local'
import { requestSync } from '@/sync/trigger'

export interface OfferVendor { id: string; companyName: string; city: string | null; state: string | null; whatsapp: string | null; phone: string }

export interface Offer {
  id: string
  vendorId: string
  title: string
  description: string | null
  category: string
  price: number | null
  unit: string | null
  imageUrl: string | null
  validUntil: string
  isMyVendor: boolean
  matchesLowStock: boolean
  vendor: OfferVendor | null
}

export type RequestStatus = 'novo' | 'respondido' | 'fechado' | 'cancelado'

export interface SupplyRequest {
  id: string
  vendorId: string
  supplyId: string | null
  itemName: string
  quantity: number | null
  unit: string | null
  note: string | null
  status: RequestStatus
  reply: string | null
  replyPrice: number | null
  repliedAt: string | null
  createdAt: string
  vendor: { id: string; companyName: string; whatsapp: string | null; phone: string } | null
}

export interface MyVendor {
  id: string
  companyName: string
  contactName: string
  city: string | null
  state: string | null
  whatsapp: string | null
  phone: string
  status: string
  muted: boolean
  shareStock: boolean
}

/** Fornecedor encontrado pela busca (GET /api/fornecedores/busca) */
export interface FoundVendor {
  id: string
  companyName: string
  contactName: string
  city: string | null
  state: string | null
  description: string | null
  linked: boolean
}

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: 'amber' | 'blue' | 'green' | 'muted' }> = {
  novo: { label: 'Aguardando resposta', tone: 'amber' },
  respondido: { label: 'Respondido', tone: 'blue' },
  fechado: { label: 'Resolvido', tone: 'green' },
  cancelado: { label: 'Cancelado', tone: 'muted' },
}

/** As rotas de fornecedores não exigem módulo (qualquer pessoa logada) */
const MODULE = ''

export function listOffers(farmId: string): Offer[] {
  // Primeiro o que combina com o estoque baixo, como no servidor
  return all<Row>('SELECT * FROM offers WHERE farmId = ? ORDER BY matchesLowStock DESC, createdAt DESC', [farmId]).map(r => ({
    ...(r as unknown as Offer),
    isMyVendor: !!r.isMyVendor,
    matchesLowStock: !!r.matchesLowStock,
    vendor: parseJson<OfferVendor | null>(r.vendor, null),
  }))
}

export const lowCategories = (farmId: string) => parseJson<string[]>(getMeta(`lowCategories:${farmId}`), [])

export function listRequests(farmId: string): SupplyRequest[] {
  return all<Row>('SELECT * FROM supply_requests WHERE farmId = ? ORDER BY createdAt DESC', [farmId]).map(r => ({
    ...(r as unknown as SupplyRequest),
    vendor: parseJson<SupplyRequest['vendor']>(r.vendor, null),
  }))
}

export function listMyVendors(farmId: string): MyVendor[] {
  return all<Row>('SELECT * FROM vendors WHERE farmId = ? ORDER BY since DESC', [farmId]).map(r => ({
    ...(r as unknown as MyVendor),
    muted: !!r.muted,
    shareStock: !!r.shareStock,
  }))
}

/** Conta o clique em "Chamar no WhatsApp" para o fornecedor (abre um contato da oferta no relatório dele). */
export function countOfferClick(farmId: string, offerId: string) {
  queueRequest({ farmId, module: MODULE, method: 'POST', path: `/api/ofertas/${offerId}/whatsapp` })
}

export function setRequestStatus(farmId: string, id: string, status: 'fechado' | 'cancelado') {
  updateLocal({ table: 'supply_requests', farmId, id, path: `/api/pedidos/${id}`, method: 'PATCH', body: { status } })
}

/** Mensagem solta (sem item do estoque) para um fornecedor vinculado. */
export function sendMessage(farmId: string, vendor: MyVendor, subject: string, note: string): string {
  const body = { vendorId: vendor.id, itemName: subject.trim().slice(0, 120), category: 'Outro', note: note.trim().slice(0, 500) }
  const vendorJson = { id: vendor.id, companyName: vendor.companyName, whatsapp: vendor.whatsapp, phone: vendor.phone }
  return createLocal({ table: 'supply_requests', farmId, path: '/api/pedidos', body, row: { status: 'novo', vendor: vendorJson, createdAt: new Date().toISOString() } })
}

export function setVendorLink(farmId: string, vendorId: string, patch: { muted?: boolean; shareStock?: boolean }) {
  updateLocal({ table: 'vendors', farmId, id: vendorId, path: `/api/meus-fornecedores/${vendorId}`, method: 'PATCH', body: patch })
}

export function removeVendor(farmId: string, vendorId: string) {
  deleteLocal({ table: 'vendors', farmId, id: vendorId, path: `/api/meus-fornecedores/${vendorId}` })
}

/** Busca de fornecedores aprovados: só com internet. */
export const searchVendors = (q: string) => api<FoundVendor[]>(`/api/fornecedores/busca?q=${encodeURIComponent(q.trim())}`)

/** Vincula o fornecedor à propriedade (online) e já o mostra na lista; a próxima sincronização completa telefone e contato. */
export async function addVendor(farmId: string, found: FoundVendor) {
  await api('/api/meus-fornecedores', { method: 'POST', body: { vendorId: found.id } })
  upsert('vendors', farmId, {
    id: found.id, companyName: found.companyName, contactName: found.contactName, city: found.city, state: found.state,
    whatsapp: null, phone: '', status: 'aprovado', muted: false, shareStock: true, since: new Date().toISOString(),
  })
  notifyChange()
  requestSync()
}
