'use client'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'

import { useEffect, useState, useCallback } from 'react'
import { ESPECIES, STATUS_LIST, type Especie, type StatusAnimal } from '@/lib/types'
import { ImagePicker } from '@/components/ImagePicker'
import { getPendingRecords, addPendingRecord, removePendingRecord } from '@/lib/offlineStorage'
import { useDialog } from '@/components/DialogProvider'
import { SemSinalIcon, SincronizarIcon, AnimalIcon, FecharIcon } from '@/components/ModuleIcons'
import { CalfSection } from '@/components/CalfSection'
import { animalCategory, animalRuleError, animalToday, canAddCalf, fixedAnimalGender, isBovine } from '@/lib/animalRules'
import { animalCodes, animalSearchText } from '@/lib/animalCode'

interface Animal {
  id: string
  code: string
  customCode?: string | null
  name: string
  species: string
  gender: string
  birthDate: string
  isCastrated?: boolean
  acquisitionType?: string
  status: string
  gta?: string
  observations?: string
  imageUrl?: string
  motherId?: string | null
}

// Rebanho guardado no aparelho, para abrir a ficha (e anotar cria) sem internet
const cacheKey = (fid: string) => `animais_cache_${fid}`
function readHerdCache(fid: string): Animal[] {
  try { return JSON.parse(localStorage.getItem(cacheKey(fid)) || '[]') } catch { return [] }
}
function writeHerdCache(fid: string, list: Animal[]) {
  try { localStorage.setItem(cacheKey(fid), JSON.stringify(list.map(a => ({ ...a, imageUrl: undefined })))) } catch {}
}

const EMPTY_FORM = {
  code: '',
  customCode: '',
  name: '',
  species: 'Bezerro' as Especie,
  gender: 'Fêmea',
  birthDate: '',
  isCastrated: false,
  acquisitionType: 'nascimento',
  status: 'Vivo' as StatusAnimal,
  gta: '',
  observations: '',
  imageUrl: '',
  motherId: '',
}

export default function AnimaisPage() {
  const { confirm } = useDialog()
  const { user } = useUser()
  const [animals, setAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [farmId, setFarmId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Animal | null>(null)
  const [selectedAnimal, setSelectedAnimal] = useState<Animal | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  const canEdit = user?.role === 'admin' || user?.role === 'editor'

  const fetchAnimals = useCallback((fid: string) => {
    setLoading(true)
    // Link de outra tela (ex.: painel da Reprodução): /animais?animal=<id> abre a ficha
    const show = (rawList: Animal[]) => {
      const list = rawList.map(a => ({ ...a, species: animalCategory(a) }))
      setAnimals(list)
      const wanted = new URLSearchParams(window.location.search).get('animal')
      if (!wanted) return
      const found = list.find((a) => a.id === wanted)
      if (found) setSelectedAnimal(found)
      window.history.replaceState(null, '', window.location.pathname)
    }
    
    // Always load pending records from localStorage
    const pending = getPendingRecords('animais')
      .filter(r => r.farmId === fid && r._type === 'create')
      .map(r => ({
        id: `pending_${r._pendingId}`,
        code: r.code,
        customCode: r.customCode || null,
        name: r.name,
        species: r.species,
        gender: r.gender,
        birthDate: r.birthDate,
        isCastrated: r.isCastrated ?? false,
        acquisitionType: r.acquisitionType ?? 'nascimento',
        status: r.status,
        gta: r.gta,
        observations: r.observations,
        imageUrl: r.imageUrl,
        motherId: r.motherId ?? null,
      }))

    // Sem internet: o rebanho guardado no aparelho mais o que ainda não foi enviado
    if (!navigator.onLine) {
      show([...readHerdCache(fid), ...pending].map(a => ({ ...a, species: animalCategory(a) })))
      setLoading(false)
      return
    }

    // Try to fetch from API, but don't fail if offline
    fetch(`/api/animals?farmId=${fid}`)
      .then((r) => {
        if (!r.ok) throw new Error('API error')
        return r.json()
      })
      .then((data) => {
        // Merge API data with pending records
        writeHerdCache(fid, data)
        show([...data, ...pending])
        setLoading(false)
      })
      .catch((err) => {
        // Sinal fraco: mostra o rebanho guardado no aparelho
        console.log('Fetch error:', err)
        show([...readHerdCache(fid), ...pending])
        setLoading(false)
      })
  }, [])

  const handleSync = useCallback(async () => {
    const pending = getPendingRecords('animais')
    if (!pending.length) return
    setSyncing(true)
    
    for (const record of pending) {
      if (record.farmId !== farmId) continue
      const { _pendingId, ...data } = record
      try {
        const res = await fetch('/api/animals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, farmId }),
        })
        if (res.ok) removePendingRecord('animais', _pendingId)
      } catch (err) {
        console.error('Sync error:', err)
      }
    }
    
    setPendingCount(getPendingRecords('animais').filter(r => r.farmId === farmId).length)
    setSyncing(false)
    fetchAnimals(farmId)
  }, [farmId, fetchAnimals])

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setPendingCount(getPendingRecords('animais').length)
    
    const handleOnline = () => {
      setIsOnline(true)
      // Auto-sync when reconnected
      if (farmId) handleSync()
    }
    const handleOffline = () => setIsOnline(false)
    
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [farmId, handleSync])

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (data.farmId) {
          setFarmId(data.farmId)
          fetchAnimals(data.farmId)
        }
      })
  }, [fetchAnimals])

  function openNew() {
    setEditing(null)
    setForm({ ...EMPTY_FORM, code: getNextCode(animals) })
    setError('')
    setShowForm(true)
  }

  function openEdit(a: Animal) {
    if (!canEdit) return
    setEditing(a)
    setForm({
      code: a.code,
      customCode: a.customCode || '',
      name: a.name,
      species: a.species as Especie,
      gender: fixedAnimalGender(a.species) ?? a.gender,
      birthDate: a.birthDate.slice(0, 10),
      isCastrated: a.isCastrated ?? ['Boi', 'Boi de engorda'].includes(a.species),
      acquisitionType: a.acquisitionType || 'existente',
      status: a.status as StatusAnimal,
      gta: a.gta || '',
      observations: a.observations || '',
      imageUrl: a.imageUrl || '',
      motherId: a.motherId || '',
    })
    setError('')
    setShowForm(true)
  }

  function openDetails(a: Animal) {
    setSelectedAnimal(a)
  }

  function closeDetails() {
    setSelectedAnimal(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const ruleError = animalRuleError(form)
    if (ruleError) { setError(ruleError); return }
    setSaving(true)

    // Se estiver offline e criando novo (não editando), salva no localStorage
    if (!isOnline && !editing) {
      addPendingRecord('animais', { ...form, farmId, _type: 'create' })
      setPendingCount(getPendingRecords('animais').length)
      setSaving(false)
      setShowForm(false)
      setForm({ ...EMPTY_FORM, code: getNextCode(animals) })
      // Atualiza a lista com o novo registro pendente
      fetchAnimals(farmId)
      return
    }

    // Se estiver editando ou online, envia para API normalmente
    const url = editing ? `/api/animals/${editing.id}` : '/api/animals'
    const method = editing ? 'PUT' : 'POST'
    const body = editing ? form : { ...form, farmId }

    try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error || 'Erro ao salvar')
      setSaving(false)
      return
    }

    setSaving(false)
    setShowForm(false)
    fetchAnimals(farmId)
    } catch {
      setError('Não foi possível salvar. Verifique a conexão e tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (!(await confirm({ title: 'Excluir este animal?', message: 'Todo o histórico dele (leite, vacinas, tratamentos) também será apagado.', confirmLabel: 'Excluir', danger: true }))) return
    await fetch(`/api/animals/${id}`, { method: 'DELETE' })
    fetchAnimals(farmId)
  }

  const mother = selectedAnimal?.motherId ? animals.find((a) => a.id === selectedAnimal.motherId) : undefined
  // Mães possíveis no formulário: fêmeas, menos o próprio animal
  const motherOptions = animals.filter((a) => canAddCalf(a) && a.id !== editing?.id && !a.id.startsWith('pending_'))

  // Busca por nome, código, outro código (brinco...) ou espécie; o id interno não entra
  const term = search.trim().toLocaleLowerCase('pt-BR')
  const filtered = animals.filter((a) => `${animalSearchText(a)} ${a.species.toLocaleLowerCase('pt-BR')}`.includes(term))

  const statusColor: Record<string, string> = {
    Vivo: 'bg-green-100 text-green-700',
    Morto: 'bg-gray-100 text-gray-600',
    Vendido: 'bg-blue-100 text-blue-700',
    Doente: 'bg-red-100 text-red-700',
    Arrendado: 'bg-yellow-100 text-yellow-700',
  }

  function getNextCode(list: Animal[]) {
    const maxNum = list.reduce((acc, item) => {
      const n = Number.parseInt(item.code, 10)
      return Number.isFinite(n) && n > acc ? n : acc
    }, 0)
    const next = maxNum + 1
    return String(next).padStart(2, '0')
  }

  return (
    <PermissionGuard module="animais">
      <div>
      <div className="page-toolbar flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Animais</h1>
        <button
          onClick={openNew}
          disabled={!canEdit}
          className={`text-white text-sm font-medium px-4 py-2 rounded-lg ${
            canEdit 
              ? 'bg-green-700 hover:bg-green-600' 
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          Cadastrar animal
        </button>
      </div>

      {/* Offline / sync banner */}
      {!isOnline && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <SemSinalIcon className="w-5 h-5 shrink-0" />
          <span>Sem internet. Ao salvar, os novos animais ficam neste aparelho. Quando a internet voltar, use “Enviar registros”.</span>
        </div>
      )}
      {isOnline && pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><SincronizarIcon className="w-5 h-5 shrink-0" />{pendingCount} animal{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''} para enviar</span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
          >
            {syncing ? 'Enviando...' : 'Enviar registros'}
          </button>
        </div>
      )}

      <div className="mb-4">
      <input
        type="text"
        aria-label="Buscar animal por nome, código, brinco ou espécie"
        placeholder="Digite o nome, código ou brinco do animal"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="min-w-0 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
      />
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">{search.trim() ? 'Nenhum animal encontrado nesta busca' : 'Nenhum animal cadastrado'}</p>
          <p className="text-sm mt-1">{search.trim() ? 'Confira o nome ou número. Você pode limpar a busca para ver todos os animais.' : 'Use “Cadastrar animal” para começar.'}</p>
          {search.trim() && <button type="button" onClick={() => setSearch('')} className="mt-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-700">Limpar busca</button>}
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-2 sm:px-4 py-3 text-left">Foto</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left">Código</th>
                <th className="px-2 sm:px-4 py-3 text-left">Nome</th>
                <th className="hidden md:table-cell px-4 py-3 text-left">Espécie</th>
                <th className="hidden lg:table-cell px-4 py-3 text-left">Sexo</th>
                <th className="hidden md:table-cell px-4 py-3 text-left">Status</th>
                <th className="px-2 sm:px-4 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((a) => (
                <tr
                  key={a.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => openDetails(a)}
                >
                  <td className="px-2 sm:px-4 py-2">
                    {a.imageUrl ? (
                      <img src={a.imageUrl} alt={a.name} className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg object-cover" />
                    ) : (
                      <div className="w-8 sm:w-10 h-8 sm:h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400"><AnimalIcon className="w-5 h-5 sm:w-6 sm:h-6" /></div>
                    )}
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 font-mono text-gray-600 text-xs sm:text-sm">
                    {a.code}
                    {a.customCode && <span className="block font-sans text-gray-500">{a.customCode}</span>}
                  </td>
                  <td className="px-2 sm:px-4 py-3 font-medium text-gray-800 text-xs sm:text-sm">
                    {a.name}
                    {/* No celular a coluna de código some: mostra os códigos embaixo do nome */}
                    <span className="block sm:hidden font-normal text-gray-500">{animalCodes(a)}</span>
                  </td>
                  <td className="hidden md:table-cell px-4 py-3 text-gray-600 text-xs sm:text-sm">{a.species}</td>
                  <td className="hidden lg:table-cell px-4 py-3 text-gray-600 text-xs sm:text-sm">{a.gender}</td>
                  <td className="hidden md:table-cell px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColor[a.status] || 'bg-gray-100 text-gray-600'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-2 sm:px-4 py-3 text-right space-x-1 sm:space-x-2">
                    <button
                      aria-label={`Editar animal ${a.name}`}
                      onClick={(e) => { e.stopPropagation(); openEdit(a) }}
                      disabled={!canEdit}
                      className={`inline-flex items-center gap-1 text-xs ${canEdit ? 'text-blue-600 hover:underline' : 'text-gray-300 cursor-not-allowed'}`}
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg><span>Editar</span>
                    </button>
                    <button
                      aria-label={`Excluir animal ${a.name}`}
                      onClick={(e) => { e.stopPropagation(); handleDelete(a.id) }}
                      disabled={!canEdit}
                      className={`inline-flex items-center gap-1 text-xs ${canEdit ? 'text-red-500 hover:underline' : 'text-gray-300 cursor-not-allowed'}`}
                    >
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18" />
                        <path d="M8 6V4h8v2" />
                        <path d="M19 6l-1 14H6L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                      </svg><span>Excluir</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedAnimal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-2 sm:p-4">
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 sm:p-6">
              <div className="flex flex-col sm:flex-row items-start justify-between gap-3 sm:gap-4">
                <div className="flex items-start gap-3">
                  {selectedAnimal.imageUrl ? (
                    <img src={selectedAnimal.imageUrl} alt={selectedAnimal.name} className="w-12 sm:w-16 h-12 sm:h-16 rounded-xl object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-12 sm:w-16 h-12 sm:h-16 rounded-xl bg-gray-100 flex items-center justify-center text-gray-400 flex-shrink-0"><AnimalIcon className="w-7 h-7 sm:w-8 sm:h-8" /></div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Código</p>
                    <p className="text-base sm:text-lg font-semibold text-gray-800 break-words">{selectedAnimal.code}</p>
                    {selectedAnimal.customCode && <p className="text-xs sm:text-sm text-gray-600 break-words">Outro código: <strong>{selectedAnimal.customCode}</strong></p>}
                    <p className="text-xs sm:text-sm text-gray-500 truncate">{selectedAnimal.species}</p>
                  </div>
                </div>
                <button
                  onClick={closeDetails}
                  className="text-gray-500 hover:text-gray-700 p-1 flex-shrink-0"
                  aria-label="Fechar"
                >
                  <FecharIcon />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4 sm:mt-6 text-sm">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Nome</p>
                  <p className="font-medium text-gray-800 truncate">{selectedAnimal.name}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Sexo</p>
                  <p className="font-medium text-gray-800">{selectedAnimal.gender}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Data de Nascimento</p>
                  <p className="font-medium text-gray-800 text-xs sm:text-sm">
                    {new Date(selectedAnimal.birthDate).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Status</p>
                  <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${statusColor[selectedAnimal.status] || 'bg-gray-100 text-gray-600'}`}>
                    {selectedAnimal.status}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">GTA</p>
                  <p className="font-medium text-gray-800 truncate text-xs sm:text-sm">{selectedAnimal.gta || '-'}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">Observações</p>
                  <p className="font-medium text-gray-800 text-xs sm:text-sm line-clamp-2">{selectedAnimal.observations || '-'}</p>
                </div>
                {mother && (
                  <div className="min-w-0">
                    <p className="text-xs text-gray-500">Mãe</p>
                    <button type="button" onClick={() => setSelectedAnimal(mother)} className="font-semibold text-green-700 underline">
                      {mother.name}{mother.code ? ` (${mother.code})` : ''}
                    </button>
                  </div>
                )}
              </div>

              {selectedAnimal.gender === 'Fêmea' && isBovine(selectedAnimal.species) && (
                <CalfSection key={selectedAnimal.id} mother={selectedAnimal} animals={animals} farmId={farmId} canEdit={canEdit} isOnline={isOnline}
                  onOpen={(calf) => setSelectedAnimal(animals.find((a) => a.id === calf.id) ?? null)}
                  onChanged={() => { setPendingCount(getPendingRecords('animais').length); fetchAnimals(farmId) }} />
              )}

              <div className="flex flex-col sm:flex-row gap-2 mt-4 sm:mt-6">
                <button
                  onClick={() => { closeDetails(); openEdit(selectedAnimal) }}
                  disabled={!canEdit}
                  className={`inline-flex items-center justify-center text-white text-sm font-medium px-3 py-2 rounded-lg flex-1 sm:flex-none ${
                    canEdit 
                      ? 'bg-green-700 hover:bg-green-600' 
                      : 'bg-gray-400 cursor-not-allowed'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => { closeDetails(); handleDelete(selectedAnimal.id) }}
                  disabled={!canEdit}
                  className={`inline-flex items-center justify-center text-sm font-medium px-3 py-2 rounded-lg flex-1 sm:flex-none ${
                    canEdit 
                      ? 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                      : 'border border-gray-200 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" />
                    <path d="M8 6V4h8v2" />
                    <path d="M19 6l-1 14H6L5 6" />
                    <path d="M10 11v6" />
                    <path d="M14 11v6" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-4">
                {editing ? 'Editar Animal' : 'Novo Animal'}
              </h2>

              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                {/* Foto */}
                <ImagePicker
                  value={form.imageUrl}
                  onChange={(base64) => setForm({ ...form, imageUrl: base64 })}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Código *</label>
                    <input
                      value={form.code}
                      onChange={(e) => setForm({ ...form, code: e.target.value })}
                      required
                      disabled={!editing}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Nome *</label>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">Outro código <span className="font-normal text-gray-400">(opcional: brinco, SISBOV ou o número que você já usa)</span>
                    <input
                      value={form.customCode}
                      onChange={(e) => setForm({ ...form, customCode: e.target.value })}
                      maxLength={40}
                      placeholder="Ex.: 4471"
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Espécie *</label>
                    <select
                      value={form.species}
                      onChange={(e) => {
                        const species = e.target.value as Especie
                        const gender = fixedAnimalGender(species) ?? form.gender
                        setForm({ ...form, species, gender, isCastrated: species === 'Boi de engorda' })
                      }}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    >
                      {ESPECIES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="animal-gender" className="text-xs font-medium text-gray-600">Sexo *</label>
                    <select
                      id="animal-gender"
                      value={form.gender}
                      disabled={fixedAnimalGender(form.species) !== null}
                      onChange={(e) => setForm({ ...form, gender: e.target.value, isCastrated: e.target.value === 'Macho' && form.isCastrated })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 disabled:bg-gray-50 disabled:text-gray-500"
                    >
                      <option>Fêmea</option>
                      <option>Macho</option>
                    </select>
                    {fixedAnimalGender(form.species) && <p className="mt-1 text-xs text-gray-500">Definido automaticamente pela espécie.</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Data de Nascimento *</label>
                    <input
                      type="date"
                      max={animalToday()}
                      value={form.birthDate}
                      onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                      required
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Status *</label>
                    <select
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as StatusAnimal })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    >
                      {STATUS_LIST.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {isBovine(form.species) && <div className="rounded-lg bg-green-50 p-3 text-sm text-green-900">
                  <p>Classificação por idade e sexo: <strong>{form.birthDate ? animalCategory(form) : 'Informe a data de nascimento'}</strong></p>
                  {form.gender === 'Macho' && <label className="mt-2 flex items-center gap-2"><input type="checkbox" checked={form.isCastrated} onChange={e => setForm({ ...form, isCastrated: e.target.checked })} />Animal castrado</label>}
                </div>}
                <label className="text-xs font-medium text-gray-600">Origem do animal
                  <select value={form.acquisitionType} onChange={e => setForm({ ...form, acquisitionType: e.target.value })} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm">
                    <option value="nascimento">Nascimento na propriedade</option><option value="compra">Compra</option><option value="existente">Já estava no rebanho</option>
                  </select>
                </label>
                {form.acquisitionType === 'compra' && form.gender === 'Fêmea' && isBovine(form.species) && <p className="text-xs text-amber-800">Uma vaca comprada deve ter pelo menos 3 anos. Fêmeas jovens são cadastradas como bezerras.</p>}
                <div>
                  <label className="text-xs font-medium text-gray-600">Mãe <span className="font-normal text-gray-400">(se for cria de uma vaca do rebanho)</span>
                    <select
                      value={form.motherId}
                      onChange={(e) => setForm({ ...form, motherId: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    >
                      <option value="">Sem mãe no rebanho</option>
                      {motherOptions.map((m) => <option key={m.id} value={m.id}>{m.name}{m.code ? ` (${m.code})` : ''}</option>)}
                    </select>
                  </label>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">GTA (Guia de Trânsito Animal)</label>
                  <input
                    value={form.gta}
                    onChange={(e) => setForm({ ...form, gta: e.target.value })}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-600">Observações</label>
                  <textarea
                    value={form.observations}
                    onChange={(e) => setForm({ ...form, observations: e.target.value })}
                    rows={2}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-medium py-2 rounded-lg"
                  >
                    {saving ? 'Salvando...' : 'Salvar'}
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
