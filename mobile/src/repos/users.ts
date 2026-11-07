// Equipe da propriedade (tabela local `users`, lista de /api/users).
import { all, one, parseJson, type Row } from '@/db'
import { phoneDigits } from '@/lib/masks'
import { createLocal, deleteLocal, updateLocal } from '@/sync/local'

export interface TeamUser {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  permissions: string[]
  createdAt: string | null
}

function fromRow(r: Row): TeamUser {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    email: (r.email as string | null) ?? null,
    phone: (r.phone as string | null) ?? null,
    role: String(r.role ?? 'viewer'),
    permissions: parseJson<string[]>(r.permissions, []),
    createdAt: (r.createdAt as string | null) ?? null,
  }
}

export function listUsers(farmId: string): TeamUser[] {
  return all('SELECT * FROM users WHERE farmId = ? ORDER BY name COLLATE NOCASE', [farmId]).map(fromRow)
}

export function getUser(id: string): TeamUser | null {
  const r = one('SELECT * FROM users WHERE id = ?', [id])
  return r ? fromRow(r) : null
}

/** "Todos os módulos" / "N módulo(s)" / "Sem acesso", como na lista do site */
export function modulesLabel(u: Pick<TeamUser, 'role' | 'permissions'>): string {
  if (u.role === 'admin') return 'Todos os módulos'
  if (u.permissions.length > 0) return `${u.permissions.length} módulo${u.permissions.length > 1 ? 's' : ''}`
  return 'Sem acesso'
}

export interface NewUserInput { name: string; email: string; phone: string; password: string; role: string; permissions: string[] }

/** POST /api/users. A senha vai só no pedido da fila; a linha local guarda o resto. Devolve o id local. */
export function createUser(farmId: string, input: NewUserInput): string {
  const email = input.email.trim().toLowerCase() || null
  const phone = phoneDigits(input.phone) || null
  const body = { name: input.name.trim(), email, phone, password: input.password, role: input.role, permissions: input.permissions }
  return createLocal({ table: 'users', farmId, path: '/api/users', body })
}

/** PUT /api/users/{id}. Editando a si mesmo só o nome muda (perfil e módulos ficam como estão). */
export function updateUser(farmId: string, id: string, input: { name: string; role: string; permissions: string[] }, self: boolean) {
  const body = self ? { name: input.name.trim() } : { name: input.name.trim(), role: input.role, permissions: input.permissions }
  updateLocal({ table: 'users', farmId, id, path: `/api/users/${id}`, body })
}

export function removeUser(farmId: string, id: string) {
  deleteLocal({ table: 'users', farmId, id, path: `/api/users/${id}` })
}
