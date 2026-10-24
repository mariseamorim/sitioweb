'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { CadeadoIcon, FecharIcon } from '@/components/ModuleIcons'
import { contactLabel } from '@/lib/identity'
import { maskPhone } from '@/lib/masks'
import { ROLE_LABELS, roleLabel } from '@/lib/roles'
import { fmtDate } from '@/lib/reports'
import type { Account } from '@/lib/adminAccounts'

// Contas e senhas: o administrador vê todas as contas (produtor, equipe, fornecedor, laticínio, associação, Anota Aí Leite),
// corrige nome, telefone e e-mail e define uma senha nova para quem esqueceu a sua.

const ROLE_STYLE: Record<string, string> = {
  admin: 'bg-purple-100 text-purple-700',
  editor: 'bg-blue-100 text-blue-700',
  viewer: 'bg-gray-100 text-gray-600',
  fornecedor: 'bg-amber-100 text-amber-800',
  laticinio: 'bg-sky-100 text-sky-800',
  associacao: 'bg-teal-100 text-teal-800',
  lite: 'bg-green-100 text-green-800',
  motorista: 'bg-green-100 text-green-800',
  onboarding: 'bg-red-50 text-red-700',
}

const input = 'mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600'

/** Senha fácil de ditar pelo telefone: 8 letras e números sem os que se confundem (0/O, 1/l/I) */
function suggestPassword() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function AdminUsuariosPage() {
  const { isAdmin, loading: userLoading } = useUser()
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [loadError, setLoadError] = useState('')
  const [query, setQuery] = useState('')
  const [role, setRole] = useState('')
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<{ name: string; password: string } | null>(null)

  function load() {
    fetch('/api/admin/usuarios')
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error)
        setAccounts(data)
      })
      .catch((e: Error) => setLoadError(e.message || 'Não foi possível carregar as contas'))
  }
  useEffect(load, [])

  const roles = useMemo(() => Object.keys(ROLE_LABELS).filter((r) => accounts?.some((a) => a.role === r)), [accounts])
  const visible = useMemo(() => {
    if (!accounts) return []
    const q = normalize(query.trim())
    const digits = query.replace(/\D/g, '')
    return accounts.filter((a) => {
      if (role && a.role !== role) return false
      if (!q) return true
      return normalize(a.name).includes(q)
        || (a.email ?? '').toLowerCase().includes(q)
        || (!!digits && (a.phone ?? '').includes(digits))
        || normalize(a.place ?? '').includes(q)
    })
  }, [accounts, query, role])

  function openEdit(account: Account) {
    setEditing(account)
    setForm({ name: account.name, phone: account.phone ? maskPhone(account.phone) : '', email: account.email ?? '', password: '' })
    setShowPassword(false)
    setError('')
    setDone(null)
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!editing) return
    setError('')
    setSaving(true)
    try {
      const body: Record<string, string> = {}
      if (form.name.trim() !== editing.name) body.name = form.name.trim()
      const phone = form.phone.replace(/\D/g, '')
      if (phone !== (editing.phone ?? '')) body.phone = phone
      if (form.email.trim().toLowerCase() !== (editing.email ?? '')) body.email = form.email.trim()
      if (form.password) body.password = form.password
      if (!Object.keys(body).length) { setError('Nada foi alterado'); return }
      const res = await fetch(`/api/admin/usuarios/${editing.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAccounts((list) => list?.map((a) => (a.id === data.id ? { ...a, ...data } : a)) ?? list)
      if (form.password) setDone({ name: data.name, password: form.password })
      setEditing(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verifique sua conexão e tente novamente')
    } finally {
      setSaving(false)
    }
  }

  if (userLoading) return <p className="text-gray-400 text-sm mt-8">Carregando...</p>
  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <CadeadoIcon className="w-12 h-12 mb-4 text-gray-300" />
        <p className="text-gray-600">Área do administrador.</p>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Contas e senhas</h1>
        <p className="text-gray-500 text-sm mt-1">Todas as contas do sistema. Corrija nome, telefone e e-mail ou defina uma senha nova para quem esqueceu a sua.</p>
      </div>

      {done && (
        <div role="status" className="mb-5 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-green-900">
          <p className="font-semibold">Senha de {done.name} redefinida.</p>
          <p className="mt-1 text-sm">Nova senha: <code className="rounded bg-white px-2 py-0.5 font-mono text-base font-bold">{done.password}</code>. Envie para a pessoa; ela pode trocar depois em Meu cadastro. A senha não fica visível de novo.</p>
          <button type="button" onClick={() => setDone(null)} className="mt-2 text-sm font-semibold text-green-800 hover:underline">Entendi</button>
        </div>
      )}

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, telefone, e-mail, propriedade ou empresa" aria-label="Buscar conta"
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600" />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Filtrar por perfil" className="rounded-lg border border-gray-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600">
          <option value="">Todos os perfis</option>
          {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
        </select>
      </div>

      {loadError ? (
        <p className="text-gray-500">{loadError}</p>
      ) : !accounts ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : visible.length === 0 ? (
        <p className="py-12 text-center text-gray-500">Nenhuma conta encontrada.</p>
      ) : (
        <>
          <p className="mb-2 text-sm text-gray-500">{visible.length === 1 ? '1 conta' : `${visible.length} contas`}</p>
          <ul className="grid gap-3">
            {visible.map((a) => (
              <li key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold text-gray-900">{a.name}</p>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${ROLE_STYLE[a.role] ?? 'bg-gray-100 text-gray-600'}`}>{roleLabel(a.role)}</span>
                      {a.googleConnected && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">Entra com Google</span>}
                      {!a.hasPassword && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">Sem senha</span>}
                    </div>
                    <p className="text-sm text-gray-500">
                      {[a.phone ? maskPhone(a.phone) : null, a.email].filter(Boolean).join(' · ') || contactLabel(a) || 'Sem telefone nem e-mail'}
                    </p>
                    <p className="text-sm text-gray-500">{a.place ? `${a.place} · ` : ''}conta criada em {fmtDate(a.createdAt)}</p>
                  </div>
                  <button type="button" onClick={() => openEdit(a)} className="border border-gray-300 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-50">
                    Editar e senha
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => !saving && setEditing(null)}>
          <div role="dialog" aria-modal="true" aria-labelledby="editar-conta" className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-1">
                <h2 id="editar-conta" className="text-lg font-bold text-gray-800">Editar conta</h2>
                <button type="button" onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>
              <p className="mb-4 text-sm text-gray-500">{roleLabel(editing.role)}{editing.place ? ` · ${editing.place}` : ''}</p>
              <form onSubmit={save} className="flex flex-col gap-3">
                <fieldset disabled={saving} className="flex flex-col gap-3 disabled:opacity-70">
                  <label className="text-xs font-medium text-gray-600">Nome *
                    <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required className={input} />
                  </label>
                  <label className="text-xs font-medium text-gray-600">Telefone
                    <input type="tel" inputMode="tel" placeholder="(35) 99999-0000" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} className={input} />
                  </label>
                  <label className="text-xs font-medium text-gray-600">E-mail
                    <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={input} />
                  </label>
                  <p className="-mt-1 text-xs text-gray-500">A pessoa entra com o telefone ou com o e-mail. Pelo menos um precisa ficar.</p>
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <label className="text-xs font-medium text-gray-700">Nova senha <span className="font-normal text-gray-500">(deixe vazio para manter a atual)</span>
                      <input type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className={input} />
                    </label>
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button type="button" onClick={() => { setForm((f) => ({ ...f, password: suggestPassword() })); setShowPassword(true) }} className="text-sm font-semibold text-green-700 hover:underline">Gerar senha</button>
                      <button type="button" onClick={() => setShowPassword((v) => !v)} className="text-sm font-semibold text-gray-600 hover:underline">{showPassword ? 'Ocultar' : 'Mostrar'}</button>
                    </div>
                    <p className="mt-2 text-xs text-gray-600">Mínimo de 6 caracteres. A pessoa entra com esta senha e pode trocar depois em Meu cadastro.</p>
                  </div>
                </fieldset>
                {error && <p role="alert" className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setEditing(null)} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50">Cancelar</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-medium py-2 rounded-lg">{saving ? 'Salvando...' : 'Salvar'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
