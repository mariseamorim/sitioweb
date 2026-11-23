'use client'
import { PermissionGuard } from '@/components/PermissionGuard'

import { useEffect, useState } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { useUser } from '@/contexts/UserContext'
import { FARM_SEGMENTS } from '@/lib/farmSegments'
import { PENDING_MESSAGE, hasPendingOnDevice, reloadInFarm, switchFarm } from '@/lib/farmSwitch'
import { DOCUMENT_PLACEHOLDER, maskDocument, maskPhone } from '@/lib/masks'
import { OwnerGroups } from '@/components/OwnerGroups'
import type { AdminFarmSummary } from '@/lib/ownerGroups'
import { cachedGet, fetchWithTimeout } from '@/lib/offlineData'
import { useLang, useT } from '@/lib/i18n'

interface Farm {
  id: string
  name: string
  propertyType?: string | null
  documentType?: string | null
  documentNumber?: string | null
  owner?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  isActive?: boolean
  segments?: string[]
  lactatingGoal?: number | null
}

const EMPTY = {
  name: '',
  propertyType: 'Fazenda',
  documentType: 'CNPJ',
  documentNumber: '',
  owner: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  segments: [] as string[],
  lactatingGoal: '' as string | number,
}

const typeColor: Record<string, string> = {
  Fazenda: 'bg-green-100 text-green-800',
  Sítio:   'bg-amber-100 text-amber-800',
}
// Faixa colorida no topo do cartão, na cor do tipo (o tipo também aparece escrito na etiqueta)
const typeBar: Record<string, string> = {
  Fazenda: 'bg-green-600',
  Sítio:   'bg-amber-500',
}

const OFFLINE_ACTION = 'Sem internet. Esta ação precisa de conexão; tente de novo quando o sinal voltar.'

export default function PropriedadesPage() {
  const { confirm, notify } = useDialog()
  const t = useT()
  const es = useLang() === 'es'
  const { user, refresh } = useUser()
  const canManage = user?.role === 'admin' || user?.role === 'editor'
  const [editingId, setEditingId] = useState<string | null>(null)
  const [farms, setFarms] = useState<Farm[]>([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState<string | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  // Administrador: todas as propriedades com resumo, agrupadas por proprietário
  const [summaries, setSummaries] = useState<AdminFarmSummary[]>([])

  const isAdmin = user?.role === 'admin'

  // Listas com cópia no aparelho: sem sinal ou com sinal fraco, mostra a última cópia
  function fetchFarms() {
    setLoading(true)
    if (isAdmin) {
      cachedGet<AdminFarmSummary[]>('cache_fazendas_admin', '/api/admin/propriedades')
        .then(({ data, fromCache }) => { setSummaries(data); setFarms(data); setFromCache(fromCache); setLoadError(''); setLoading(false) })
        .catch((e: Error) => { setSummaries([]); setFarms([]); setLoadError(t(e.message || 'Sem internet e sem cópia guardada neste aparelho. Abra esta tela uma vez com sinal.')); setLoading(false) })
      return
    }
    cachedGet<Farm[]>('cache_fazendas', '/api/farms')
      .then(({ data, fromCache }) => { setFarms(Array.isArray(data) ? data : []); setFromCache(fromCache); setLoadError(''); setLoading(false) })
      .catch((e: Error) => { setFarms([]); setLoadError(t(e.message || 'Sem internet e sem cópia guardada neste aparelho. Abra esta tela uma vez com sinal.')); setLoading(false) })
  }

  // Só busca depois de saber quem é: o administrador usa outra lista
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user) fetchFarms() }, [user?.id, user?.role])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Propriedade nova já abre: com anotações pendentes no celular, elas iriam para a propriedade errada
    if (!editingId && !isAdmin && hasPendingOnDevice()) { setError(t(PENDING_MESSAGE)); return }
    setSaving(true)
    setError('')

    try {
    const res = await fetchWithTimeout(editingId ? `/api/farms/${editingId}` : '/api/farms', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) { setError(t(data.error || 'Erro ao salvar')); setSaving(false); return }

    // O produtor que cadastra outra propriedade passa a usar a nova
    if (!editingId && !isAdmin) return reloadInFarm()
    setSaving(false)
    setShowForm(false)
    setForm(EMPTY)
    setEditingId(null)
    refresh()
    fetchFarms()
    } catch {
      setError(t(OFFLINE_ACTION))
    } finally {
      setSaving(false)
    }
  }

  function handleEdit(farm: Farm) {
    setEditingId(farm.id)
    setForm(Object.fromEntries(Object.entries(EMPTY).map(([key, fallback]) => [key, farm[key as keyof Farm] ?? fallback])) as typeof EMPTY)
    setError('')
    setShowForm(true)
  }

  async function openFarm(farmId: string) {
    setOpening(farmId)
    const failure = await switchFarm(farmId)
    setOpening(null)
    if (failure) await notify(t('Não foi possível abrir'), t(failure))
  }

  async function handleDelete(farmId: string) {
    if (!(await confirm({ title: t('Excluir esta propriedade?'), message: t('Se ela já tiver registros, será apenas desativada e nada se perde.'), confirmLabel: t('Excluir'), danger: true }))) return
    setDeleting(farmId)

    let res: Response
    try { res = await fetchWithTimeout(`/api/farms/${farmId}/delete`, { method: 'DELETE' }) } catch { setDeleting(null); await notify(t('Não foi possível excluir'), t(OFFLINE_ACTION)); return }
    const data = await res.json().catch(() => ({}))

    setDeleting(null)
    if (!res.ok) {
      await notify(t('Não foi possível excluir'), data.error ? t(data.error) : undefined)
      return
    }
    
    await notify(t(data.action === 'inactivated' ? 'Propriedade desativada' : 'Propriedade excluída'))
    // Se era a propriedade aberta, o servidor já abriu outra
    if (!isAdmin && farmId === user?.farmId) return reloadInFarm()
    refresh()
    fetchFarms()
  }

  return (
    <PermissionGuard module="fazendas">
      <div>
      <div className="page-toolbar flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('Propriedades')}</h1>
        <button
          onClick={() => { setEditingId(null); setForm(EMPTY); setShowForm(true); setError('') }}
          disabled={!canManage}
          className="bg-green-800 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-semibold px-4 py-2 rounded-lg"
        >
          {t('Cadastrar propriedade')}
        </button>
      </div>

      {fromCache && <p role="status" className="mb-4 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">{t('Sinal fraco ou sem internet: mostrando a última cópia guardada neste aparelho.')}</p>}
      {loading ? (
        <p className="text-gray-400 text-sm">{t('Carregando...')}</p>
      ) : loadError && farms.length === 0 ? (
        <p className="text-gray-500 text-sm">{loadError}</p>
      ) : isAdmin && summaries.length > 0 ? (
        <OwnerGroups farms={summaries} activeFarmId={user?.farmId} onOpen={(f) => void openFarm(f.id)} openingId={opening}
          onEdit={(f) => handleEdit(f)} onDelete={(f) => void handleDelete(f.id)} deletingId={deleting} />
      ) : farms.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">{t('Nenhuma propriedade cadastrada')}</p>
          <p className="text-sm mt-1">{t('Clique em "Cadastrar propriedade" para começar')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {farms.filter(f => f.isActive !== false).map((f) => (
            <div key={f.id} className={`bg-white rounded-xl shadow-sm border p-5 pt-6 relative overflow-hidden ${f.id === user?.farmId ? 'border-green-300' : 'border-gray-100'}`}>
              <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 ${typeBar[f.propertyType ?? ''] ?? 'bg-gray-300'}`} />
              <div className="flex items-start justify-between gap-2 mb-2">
                <h2 className="font-bold text-gray-800 text-lg leading-tight">{f.name}</h2>
                <div className="flex items-center gap-2 shrink-0">
                  {f.propertyType && (
                    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none ${typeColor[f.propertyType] ?? 'bg-gray-100 text-gray-800'}`}>
                      {t(f.propertyType)}
                    </span>
                  )}
                  <button
                    onClick={() => handleDelete(f.id)}
                    disabled={!canManage || deleting === f.id}
                    className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50 transition-colors disabled:opacity-50"
                    title={t('Excluir propriedade')}
                    aria-label={t('Excluir propriedade {name}', { name: f.name })}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.75" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
              {(f.documentType || f.documentNumber) && (
                <p className="text-sm text-gray-500">{f.documentType}: {f.documentNumber}</p>
              )}
              {f.owner && <p className="text-sm text-gray-500">{t('Proprietário')}: {f.owner}</p>}
              {f.address && <p className="text-sm text-gray-500">{f.address}</p>}
              {(f.city || f.state) && (
                <p className="text-sm text-gray-500">{[f.city, f.state].filter(Boolean).join(' — ')}</p>
              )}
              {f.phone && <p className="text-sm text-gray-500 mt-1">{f.phone}</p>}
              {!!f.segments?.length && (
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {FARM_SEGMENTS.filter((s) => f.segments!.includes(s.key)).map((s) => (
                    <span key={s.key} className="rounded-full bg-teal-100 px-2.5 py-0.5 text-xs font-semibold text-teal-800">{t(s.label)}</span>
                  ))}
                </p>
              )}
              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                {!isAdmin && (f.id === user?.farmId
                  ? <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-green-600" />{t('Aberta agora')}</span>
                  : <button type="button" onClick={() => void openFarm(f.id)} className="rounded-lg bg-green-800 hover:bg-green-700 px-3 py-1.5 text-sm font-semibold text-white">{t('Abrir esta propriedade')}</button>)}
                {canManage && <button type="button" onClick={() => handleEdit(f)} className="text-sm font-semibold text-green-800 hover:underline" aria-label={t('Editar propriedade {name}', { name: f.name })}>{t('Editar cadastro')}</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="farm-form-title" className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 id="farm-form-title" className="text-lg font-bold text-gray-800 mb-4">{t(editingId ? 'Editar propriedade' : 'Cadastrar propriedade')}</h2>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">

                {/* Tipo de propriedade */}
                <div>
                  <label className="text-xs font-medium text-gray-600">{t('Tipo de Propriedade')} *</label>
                  <div className="mt-1 flex gap-2">
                    {['Fazenda', 'Sítio'].map((tipo) => (
                      <button
                        key={tipo}
                        type="button"
                        onClick={() => setForm({ ...form, propertyType: tipo })}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          form.propertyType === tipo
                            ? 'bg-green-800 border-green-800 text-white'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {t(tipo)}
                      </button>
                    ))}
                  </div>
                </div>

                <fieldset>
                  <legend className="text-xs font-medium text-gray-600">{t('O que a propriedade faz? (pode marcar mais de um)')}</legend>
                  <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {FARM_SEGMENTS.map((seg) => {
                      const on = form.segments.includes(seg.key)
                      return (
                        <button key={seg.key} type="button" aria-pressed={on}
                          onClick={() => setForm({ ...form, segments: on ? form.segments.filter((k) => k !== seg.key) : [...form.segments, seg.key] })}
                          className={`py-2 rounded-lg text-sm font-medium border transition-colors ${on ? 'bg-green-800 border-green-800 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                          {t(seg.label)}
                        </button>
                      )
                    })}
                  </div>
                </fieldset>

                {form.segments.includes('leite') || !form.segments.length ? (
                  <div>
                    <label className="text-xs font-medium text-gray-600">{t('Meta de vacas em lactação (opcional)')}</label>
                    <input inputMode="numeric" value={form.lactatingGoal ?? ''} onChange={(e) => setForm({ ...form, lactatingGoal: e.target.value.replace(/\D/g, '') })} placeholder={t('Ex.: 100')}
                      className="mt-1 w-40 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                    <p className="mt-1 text-xs text-gray-500">{t('O Dashboard mostra quantas vacas estão em lactação e quanto falta para a meta.')}</p>
                  </div>
                ) : null}

                <div>
                  <label className="text-xs font-medium text-gray-600">{t('Nome')} *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    placeholder={t(form.propertyType === 'Sítio' ? 'Nome do Sítio' : 'Nome da Fazenda')}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">{t('Proprietário')}</label>
                  <input
                    value={form.owner}
                    onChange={(e) => setForm({ ...form, owner: e.target.value })}
                    placeholder={t('Nome do proprietário')}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">{t('Doc. Tipo')}</label>
                    <select
                      value={form.documentType}
                      onChange={(e) => setForm({ ...form, documentType: e.target.value, documentNumber: maskDocument(form.documentNumber, e.target.value) })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    >
                      <option value="CNPJ">CNPJ</option>
                      <option value="CPF">CPF</option>
                      <option value="RUC">RUC (Paraguay)</option>
                      <option value="CI">CI (Paraguay)</option>
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-medium text-gray-600">{t('Documento')}</label>
                    <input
                      value={form.documentNumber}
                      onChange={(e) => setForm({ ...form, documentNumber: maskDocument(e.target.value, form.documentType) })}
                      inputMode="numeric"
                      placeholder={DOCUMENT_PLACEHOLDER[form.documentType] ?? DOCUMENT_PLACEHOLDER.CPF}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">{t('Telefone')}</label>
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })}
                      inputMode="tel"
                      placeholder={es ? '0981 123456' : '(35) 99999-0000'}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">{t('Endereço')}</label>
                  <input
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">{t('Cidade')}</label>
                    <input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">{t('Estado')}</label>
                    <input
                      value={form.state}
                      onChange={(e) => setForm({ ...form, state: e.target.value })}
                      placeholder={es ? 'Central' : 'SP'}
                      maxLength={es ? 40 : 2}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => setShowForm(false)}
                    className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
                  >
                    {t('Cancelar')}
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-green-800 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-medium py-2 rounded-lg"
                  >
                    {t(saving ? 'Salvando...' : 'Salvar')}
                  </button>
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
