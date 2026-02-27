'use client'

import { useEffect, useState } from 'react'
import { PermissionGuard } from '@/components/PermissionGuard'
import { MODULES } from '@/lib/modules'
import { useUser } from '@/contexts/UserContext'

interface User {
  id: string
  name: string
  email: string
  role: string
  permissions: string[] | null
  farm: { name: string }
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador',
  editor: 'Editor',
  viewer: 'Visualizador',
}

const roleColor: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  editor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
}

const EMPTY_FORM = { name: '', email: '', password: '', role: 'viewer', permissions: [] as string[] }

function PermissionsGrid({ value, onChange, disabled }: {
  value: string[]
  onChange: (v: string[]) => void
  disabled: boolean
}) {
  function toggle(key: string) {
    onChange(value.includes(key) ? value.filter(k => k !== key) : [...value, key])
  }
  return (
    <div className="grid grid-cols-3 gap-2">
      {MODULES.map(m => (
        <label key={m.key} className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs cursor-pointer select-none transition-colors ${
          disabled ? 'opacity-40 cursor-not-allowed' :
          value.includes(m.key) ? 'border-green-400 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}>
          <input
            type="checkbox"
            className="accent-green-600"
            checked={value.includes(m.key)}
            onChange={() => !disabled && toggle(m.key)}
            disabled={disabled}
          />
          <span className="truncate">{m.label}</span>
        </label>
      ))}
    </div>
  )
}

export default function UsuariosPage() {
  const { user: me } = useUser()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editForm, setEditForm] = useState({ name: '', role: 'viewer', permissions: [] as string[] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function fetchUsers() {
    setLoading(true)
    fetch('/api/users').then(r => r.json()).then(data => {
      setUsers(Array.isArray(data) ? data : [])
      setLoading(false)
    })
  }

  useEffect(() => { fetchUsers() }, [])

  function openEdit(u: User) {
    setEditUser(u)
    setEditForm({
      name: u.name,
      role: u.role,
      permissions: u.permissions ?? [],
    })
    setError('')
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        permissions: form.permissions,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Erro ao salvar'); setSaving(false); return }
    setSaving(false); setShowCreate(false); setForm(EMPTY_FORM); fetchUsers()
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault()
    if (!editUser) return
    setSaving(true); setError('')
    const res = await fetch(`/api/users/${editUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        role: editForm.role,
        permissions: editForm.permissions,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Erro ao salvar'); setSaving(false); return }
    setSaving(false); setEditUser(null); fetchUsers()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Excluir o usuário "${name}"? Esta ação não pode ser desfeita.`)) return
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' })
    if (!res.ok) { const d = await res.json(); alert(d.error || 'Erro ao excluir'); return }
    fetchUsers()
  }

  return (
    <PermissionGuard module="usuarios">
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Usuários</h1>
            <p className="text-gray-500 text-sm mt-1">Gerencie acesso e permissões por módulo</p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setError(''); setForm(EMPTY_FORM) }}
            className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            + Novo Usuário
          </button>
        </div>

        {loading ? (
          <p className="text-gray-400 text-sm">Carregando...</p>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg">Nenhum usuário cadastrado</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Nome</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left">E-mail</th>
                  <th className="px-4 py-3 text-left">Perfil</th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left">Módulos</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-800">{u.name}</p>
                      <p className="sm:hidden text-xs text-gray-400 mt-0.5">{u.email}</p>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-500">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleColor[u.role] || 'bg-gray-100'}`}>
                        {ROLE_LABEL[u.role] || u.role}
                      </span>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-gray-400 text-xs">
                      {u.role === 'admin' ? (
                        <span className="text-purple-600 font-medium">Todos os módulos</span>
                      ) : u.permissions && u.permissions.length > 0 ? (
                        <span>{u.permissions.length} módulo{u.permissions.length > 1 ? 's' : ''}</span>
                      ) : (
                        <span className="text-red-400">Sem acesso</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(u)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        {u.id !== me?.id && (
                          <button
                            onClick={() => handleDelete(u.id, u.name)}
                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Excluir"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-800">Novo Usuário</h2>
                  <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>
                <form onSubmit={handleCreate} className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Nome *</label>
                    <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">E-mail *</label>
                    <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Senha *</label>
                    <input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Perfil</label>
                    <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value, permissions: [] })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                      <option value="editor">Editor</option>
                      <option value="viewer">Visualizador</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1.5">Módulos permitidos</label>
                    <PermissionsGrid value={form.permissions} onChange={p => setForm({ ...form, permissions: p })} disabled={false} />
                  </div>
                  {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setShowCreate(false)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
                    <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-medium py-2 rounded-lg">{saving ? 'Salvando...' : 'Salvar'}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Edit modal */}
        {editUser && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setEditUser(null)}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-800">Editar Usuário</h2>
                    <p className="text-xs text-gray-500">{editUser.email}</p>
                  </div>
                  <button onClick={() => setEditUser(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>
                <form onSubmit={handleUpdate} className="flex flex-col gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Nome</label>
                    <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Perfil</label>
                    <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value, permissions: [] })}
                      disabled={editUser.id === me?.id}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-50 disabled:text-gray-400">
                      <option value="editor">Editor</option>
                      <option value="viewer">Visualizador</option>
                    </select>
                    {editUser.id === me?.id && (
                      <p className="text-xs text-gray-400 mt-1">Você não pode alterar seu próprio perfil.</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 block mb-1.5">Módulos permitidos</label>
                    <PermissionsGrid
                      value={editForm.permissions}
                      onChange={p => setEditForm({ ...editForm, permissions: p })}
                      disabled={false}
                    />
                  </div>
                  {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
                  <div className="flex gap-2 pt-1">
                    <button type="button" onClick={() => setEditUser(null)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
                    <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-medium py-2 rounded-lg">{saving ? 'Salvando...' : 'Salvar'}</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
    </PermissionGuard>
  )
}
