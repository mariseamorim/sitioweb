// Listas do administrador da plataforma (cópia em cache: /api/admin/usuarios, /api/fornecedores, /api/organizacoes).
import * as Crypto from 'expo-crypto'
import { getCache, setCache } from '@/db'
import { notifyChange } from '@/db/events'
import { queueRequest } from '@/sync/local'

export interface Account {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  /** Propriedade, empresa ou organização da conta */
  place: string | null
  hasPassword: boolean
  googleConnected: boolean
  createdAt: string
}

export type ApprovalStatus = 'pendente' | 'aprovado' | 'bloqueado'

export interface AdminVendor {
  id: string
  companyName: string
  document: string | null
  contactName: string
  phone: string
  whatsapp: string | null
  email: string
  city: string | null
  state: string | null
  description: string | null
  status: ApprovalStatus
  createdAt: string
  _count: { clients: number; promotions: number }
}

export type OrgType = 'laticinio' | 'associacao'

export interface Organization {
  id: string
  type: OrgType
  name: string
  document: string | null
  contactName: string
  phone: string
  email: string
  city: string | null
  state: string | null
  status: ApprovalStatus
  createdAt: string
  _count: { points: number; routes: number; members: number }
}

export const STATUS_LABEL: Record<ApprovalStatus, string> = { pendente: 'Em análise', aprovado: 'Aprovado', bloqueado: 'Bloqueado' }
export const STATUS_TONE: Record<ApprovalStatus, 'amber' | 'green' | 'muted'> = { pendente: 'amber', aprovado: 'green', bloqueado: 'muted' }
export const ORG_LABEL: Record<OrgType, string> = { laticinio: 'Laticínio', associacao: 'Associação' }

export const CACHE = { accounts: 'admin_accounts', vendors: 'admin_vendors', orgs: 'admin_orgs' } as const

export function readCache<T>(key: string): T[] {
  const list = getCache<T[]>(key)
  return Array.isArray(list) ? list : []
}

/** Altera um item da cópia local e avisa as telas. */
export function patchCache<T extends { id: string }>(key: string, id: string, patch: Partial<T>) {
  setCache(key, readCache<T>(key).map(item => (item.id === id ? { ...item, ...patch } : item)))
  notifyChange()
}

/** Aprovar/bloquear fornecedor ou organização: entra na fila e a cópia local já muda. */
export function setApproval(farmId: string, kind: 'vendors' | 'orgs', id: string, status: ApprovalStatus) {
  const path = kind === 'vendors' ? `/api/fornecedores/${id}` : `/api/organizacoes/${id}`
  queueRequest({ farmId, module: 'admin', method: 'PATCH', path, body: { status } })
  patchCache<{ id: string; status: ApprovalStatus }>(CACHE[kind], id, { status })
}

/** Senha fácil de ditar pelo telefone: 8 letras e números sem os que se confundem (0/O, 1/l/I) */
export function suggestPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  return Array.from(Crypto.getRandomBytes(8), b => alphabet[b % alphabet.length]).join('')
}

/** Sem acento e sem maiúscula, para a busca */
export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** "pendente" → "1 cadastro aguardando aprovação" */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
