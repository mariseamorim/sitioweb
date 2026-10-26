'use client'
import { AnimalPicker } from '@/components/AnimalPicker'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'
import { animalSearchText } from '@/lib/animalCode'
import { useSort } from '@/lib/useSort'
import { SortTh } from '@/components/SortTh'

import { useEffect, useState, useMemo } from 'react'
import { getPendingRecords, addPendingRecord, clearPendingRecords } from '@/lib/offlineStorage'
import { readHerdCache, writeHerdCache } from '@/lib/herdCache'
import { useDialog } from '@/components/DialogProvider'
import { todayISO } from '@/lib/utils'
import { SemSinalIcon, SincronizarIcon, FecharIcon, ReproducaoIcon } from '@/components/ModuleIcons'
import { HerdCalvingPanel, PregnancyCheckPanel } from '@/components/HerdCalvingPanel'
import { canBreed } from '@/lib/animalRules'
import { pregnancyChecks, type PregnancyCheck } from '@/lib/calving'
import { AddCalfForm } from '@/components/CalfSection'
import { QuickFilterChip, useQuickFilter } from '@/components/QuickFilter'
import { COVERAGE_METHODS, EMPTY_COVERAGE, gestation, isInsemination, methodLabel, repeatCoverage, repeatedFields, type CoverageForm } from '@/lib/coverage'

interface Animal { id: string; name: string; code: string; species: string; gender: string; status: string; birthDate: string; motherId?: string | null }

interface Reproduction {
  id: string
  femaleId: string
  female: Animal
  maleName?: string | null
  coverageDate: string
  expectedBirthDate?: string | null
  actualBirthDate?: string | null
  status: string
  calfId?: string | null
  observations?: string | null
  /** Cobertura: cio, inseminação ("ia") ou monta ("natural"), sêmen e registro do touro */
  method?: string | null
  heatDate?: string | null
  semenBatch?: string | null
  bullRegistry?: string | null
  inseminator?: string | null
}

const STATUS_LIST = ['Coberta', 'Prenha', 'Parida', 'Vazia', 'Perdida']
const FIELD = 'mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600'
const STATUS_COLOR: Record<string, string> = {
  Coberta: 'bg-blue-100 text-blue-700',
  Prenha: 'bg-purple-100 text-purple-700',
  Parida: 'bg-green-100 text-green-700',
  Vazia: 'bg-gray-100 text-gray-600',
  Perdida: 'bg-red-100 text-red-700',
}

export default function ReproducaoPage() {
  const { confirm } = useDialog()
  const { user } = useUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const [reproductions, setReproductions] = useState<Reproduction[]>([])
  const [females, setFemales] = useState<Animal[]>([])
  const [animalSearch, setAnimalSearch] = useState('')
  const [herd, setHerd] = useState<Animal[]>([])
  const [registeringBirth, setRegisteringBirth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [farmId, setFarmId] = useState('')
  const [filterStatus, setFilterStatus] = useState('Todas')
  const [quick, setQuick] = useQuickFilter(['partos'] as const)
  const [detail, setDetail] = useState<Reproduction | null>(null)
  const [editingRecord, setEditingRecord] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<CoverageForm>({ ...EMPTY_COVERAGE, coverageDate: todayISO() })
  // "Salvar e repetir": quantas fêmeas já foram salvas nesta fila e o que ficou preenchido para a próxima
  const [repeated, setRepeated] = useState<{ count: number; kept: string[] } | null>(null)
  const [error, setError] = useState('')
  const [editStatus, setEditStatus] = useState('')
  const [editBirthDate, setEditBirthDate] = useState('')
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setPendingCount(getPendingRecords('reproducao').length)
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(data => {
      if (!data.farmId) return
      setFarmId(data.farmId)
      loadData(data.farmId)
    })
  }, [])

  function loadData(fid: string) {
    setLoading(true)
    const mapPending = () =>
      getPendingRecords('reproducao')
        .filter(r => r.farmId === fid && r._type === 'create')
        .map(r => ({
          id: `pending_${r._pendingId}`,
          femaleId: r.femaleId,
          female: r.female || { id: r.femaleId, name: '(Offline)', code: '', species: '', gender: 'Fêmea' },
          maleName: r.maleName ?? null,
          coverageDate: r.coverageDate,
          expectedBirthDate: r.expectedBirthDate ?? null,
          actualBirthDate: r.actualBirthDate ?? null,
          status: r.status,
          calfId: r.calfId ?? null,
          observations: r.observations ?? null,
          method: r.method || null,
          heatDate: r.heatDate || null,
          semenBatch: r.semenBatch || null,
          bullRegistry: r.bullRegistry || null,
          inseminator: r.inseminator || null,
        }))

    // Sem internet: as fêmeas vêm do rebanho guardado no aparelho (pela tela Animais ou por esta), e a lista são os registros pendentes
    const offline = () => {
      const pending = mapPending()
      const cached = readHerdCache<Animal>(fid)
      setReproductions(pending)
      setHerd(cached)
      setFemales(cached.length ? cached.filter(a => canBreed(a)) : pending.map(p => p.female))
      setLoading(false)
    }
    if (!navigator.onLine) return offline()
    
    Promise.all([
      fetch(`/api/reproducao?farmId=${fid}`).then(r => r.json()).catch(() => []),
      fetch(`/api/animals?farmId=${fid}`).then(r => r.json()).catch(() => []),
    ]).then(([repros, anims]) => {
      const pending = mapPending()
      setReproductions(Array.isArray(repros) ? [...repros, ...pending] : pending)
      // Só fêmeas vivas e, se bovinas, com 2 anos ou mais
      setFemales(Array.isArray(anims) ? anims.filter((a: Animal) => canBreed(a)) : [])
      setHerd(Array.isArray(anims) ? anims : [])
      if (Array.isArray(anims) && anims.length) writeHerdCache(fid, anims)
      setLoading(false)
    }).catch(offline)
  }

  const filtered = useMemo(() => {
    const term = animalSearch.trim().toLowerCase()
    const in30 = new Date(); in30.setDate(in30.getDate() + 30)
    const birthSoon = (r: Reproduction) => (r.status === 'Coberta' || r.status === 'Prenha') && !!r.expectedBirthDate && !r.actualBirthDate && new Date(r.expectedBirthDate) <= in30
    return reproductions.filter(r => (quick ? birthSoon(r) : filterStatus === 'Todas' || r.status === filterStatus) && animalSearchText(r.female).includes(term))
  }, [reproductions, filterStatus, animalSearch, quick])
  const { rows: sortedReproductions, sort } = useSort(filtered, {
    female: r => r.female.name, male: r => r.maleName ?? '', coverage: r => new Date(r.coverageDate),
    expected: r => (r.expectedBirthDate ? new Date(r.expectedBirthDate) : null), status: r => r.status,
  })

  const upcomingBirths = useMemo(() => {
    const in30 = new Date(); in30.setDate(in30.getDate() + 30)
    return reproductions.filter(r => (r.status === 'Coberta' || r.status === 'Prenha') && r.expectedBirthDate && !r.actualBirthDate && new Date(r.expectedBirthDate) <= in30).length
  }, [reproductions])

  // Resposta do "Confirmar prenhez": atualiza a cobertura anotada depois do parto ou cria o registro
  async function answerPregnancyCheck(check: PregnancyCheck, answer: 'Prenha' | 'Vazia') {
    if (check.openCoverage) {
      await fetch(`/api/reproducao/${check.openCoverage.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: answer, observations: check.openCoverage.observations ?? null }),
      })
    } else if (answer === 'Vazia') {
      await fetch('/api/reproducao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ femaleId: check.cow.id, coverageDate: todayISO(), status: 'Vazia', observations: 'Confirmada vazia depois do parto' }),
      })
    } else {
      // Prenha sem cobertura anotada: abre o registro já preenchido para informar a data da cobertura
      setForm({ ...EMPTY_COVERAGE, femaleId: check.cow.id, coverageDate: '', status: 'Prenha' })
      openRegister()
      return
    }
    loadData(farmId)
  }

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (!(await confirm({ title: 'Excluir este registro de reprodução?', confirmLabel: 'Excluir', danger: true }))) return
    await fetch(`/api/reproducao/${id}`, { method: 'DELETE' })
    setDetail(null)
    loadData(farmId)
  }

  async function handleSync() {
    const pending = getPendingRecords('reproducao')
    if (!pending.length) return
    setSyncing(true)
    for (const record of pending) {
      const { _pendingId, _type, farmId: _, ...data } = record
      await fetch('/api/reproducao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, farmId }),
      })
    }
    clearPendingRecords('reproducao')
    setPendingCount(0)
    setSyncing(false)
    loadData(farmId)
  }

  async function handleUpdateStatus() {
    if (!detail) return
    await fetch(`/api/reproducao/${detail.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: editStatus || detail.status, actualBirthDate: editBirthDate || null }),
    })
    setDetail(null)
    setEditStatus('')
    setEditBirthDate('')
    loadData(farmId)
  }

  function openRegister() {
    setRepeated(null)
    setError('')
    setShowRegister(true)
  }

  function closeRegister() {
    setShowRegister(false)
    setForm({ ...EMPTY_COVERAGE, coverageDate: todayISO() })
    if (repeated) loadData(farmId)
  }

  // Salva a cobertura. Com `repeat`, mantém data, tipo, touro, partida e inseminador e limpa só a fêmea:
  // é o dia de IATF, em que a fila toda leva o mesmo sêmen e só muda o brinco.
  async function handleSave(repeat: boolean) {
    if (!form.femaleId) return setError('Escolha a fêmea')
    if (!form.coverageDate) return setError('Informe a data da cobertura')
    setSaving(true)
    setError('')
    const payload = { ...form, farmId, maleName: form.maleName || null, observations: form.observations || null }

    try {
      if (!isOnline) {
        // Sem internet: fica na fila do aparelho e vai para o servidor em "Sincronizar"
        const female = females.find(f => f.id === form.femaleId)
        addPendingRecord('reproducao', { ...payload, female: female || undefined })
        setPendingCount(getPendingRecords('reproducao').length)
      } else {
        const res = await fetch('/api/reproducao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Não foi possível salvar')
      }
    } catch (err) {
      setError((err as Error).message)
      setSaving(false)
      return
    }
    setSaving(false)

    if (repeat) {
      setForm(repeatCoverage(form))
      setRepeated((r) => ({ count: (r?.count ?? 0) + 1, kept: repeatedFields(form) }))
      if (!isOnline) loadData(farmId)
      return
    }
    setShowRegister(false)
    setForm({ ...EMPTY_COVERAGE, coverageDate: todayISO() })
    setRepeated(null)
    loadData(farmId)
  }

  // Datas gravadas à meia-noite UTC: mostrar em UTC para não cair no dia anterior no horário de Brasília
  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  // Cobertura em aberto: dá para registrar o parto anotando a cria
  const birthMother = detail && canEdit && !detail.actualBirthDate && !detail.id.startsWith('pending_') && (detail.status === 'Coberta' || detail.status === 'Prenha')
    ? herd.find((a) => a.id === detail.femaleId)
    : undefined

  return (
    <PermissionGuard module="reproducao">
      <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reprodução</h1>
          <p className="text-gray-500 text-sm mt-1">Coberturas, prenhez e partos</p>
        </div>
        <button onClick={openRegister} disabled={!canEdit} className={`text-white text-sm font-medium px-4 py-2 rounded-lg ${canEdit ? 'bg-green-700 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'}`}>
          + Registrar
        </button>
      </div>

      {/* Offline / sync banner */}
      {!isOnline && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <SemSinalIcon className="w-5 h-5 shrink-0" />
          <span>Você está offline. Os registros serão salvos localmente e sincronizados quando reconectar.</span>
        </div>
      )}
      {isOnline && pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><SincronizarIcon className="w-5 h-5 shrink-0" />{pendingCount} reprodução{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''} para sincronizar</span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
          >
            {syncing ? 'Sincronizando...' : 'Sincronizar'}
          </button>
        </div>
      )}      </div>

      {!loading && (
        <PregnancyCheckPanel checks={pregnancyChecks(herd, reproductions.filter(r => !r.id.startsWith('pending_')))} canEdit={canEdit && isOnline}
          onAnswer={answerPregnancyCheck} />
      )}
      {!loading && <HerdCalvingPanel herd={herd} reproductions={reproductions} />}

      {upcomingBirths > 0 && (
        <div className="bg-purple-50 border border-purple-200 text-purple-800 rounded-xl px-4 py-3 mb-6 text-sm flex items-center gap-2">
          <ReproducaoIcon className="w-5 h-5 shrink-0" />
          <span><strong>{upcomingBirths}</strong> parto{upcomingBirths > 1 ? 's' : ''} esperado{upcomingBirths > 1 ? 's' : ''} nos próximos 30 dias</span>
        </div>
      )}

      {quick && <QuickFilterChip label="partos esperados nos próximos 30 dias" count={filtered.length} onClear={() => setQuick(null)} />}
      <div className="flex flex-wrap gap-2 mb-4">
        {(['Todas', ...STATUS_LIST]).map(s => (
          <button key={s} onClick={() => { setQuick(null); setFilterStatus(s) }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterStatus === s ? 'bg-green-700 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
            {s}
          </button>
        ))}
      </div>

      <label className="mb-4 block text-xs font-medium text-gray-600">Buscar animal por nome, código ou brinco
        <input type="search" value={animalSearch} onChange={e => setAnimalSearch(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
      </label>
      {loading ? <p className="text-gray-400 text-sm">Carregando...</p> : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhum registro encontrado</p>
          <p className="text-sm mt-1">Clique em &quot;+ Registrar&quot; para começar</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <SortTh label="Fêmea" sortKey="female" sort={sort} className="px-4 py-3 text-left" />
                <SortTh label="Reprodutor" sortKey="male" sort={sort} className="hidden sm:table-cell px-4 py-3 text-left" />
                <SortTh label="Cobertura" sortKey="coverage" sort={sort} className="px-4 py-3 text-left" />
                <SortTh label="Parto Esperado" sortKey="expected" sort={sort} className="hidden sm:table-cell px-4 py-3 text-left" />
                <SortTh label="Status" sortKey="status" sort={sort} className="px-4 py-3 text-left" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedReproductions.map(r => (
                <tr key={r.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setDetail(r); setEditingRecord(false); setRegisteringBirth(false); setEditStatus(r.status); setEditBirthDate(r.actualBirthDate?.slice(0, 10) || '') }}>
                  <td className="px-4 py-3 font-medium text-gray-800">{r.female.name}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-gray-600">{r.maleName || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{fmt(r.coverageDate)}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-gray-600">{r.expectedBirthDate ? fmt(r.expectedBirthDate) : '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${STATUS_COLOR[r.status] || 'bg-gray-100 text-gray-600'}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Detail modal */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{detail.female.name}</h2>
                  <p className="text-xs text-gray-500">Cobertura: {fmt(detail.coverageDate)}</p>
                </div>
                <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-4">
                <div><p className="text-xs text-gray-500">Touro</p><p className="font-medium text-gray-800">{detail.maleName || '—'}{detail.bullRegistry ? ` · ${detail.bullRegistry}` : ''}</p></div>
                {detail.method && <div><p className="text-xs text-gray-500">Como foi</p><p className="font-medium text-gray-800">{methodLabel(detail.method)}{detail.semenBatch ? ` · partida ${detail.semenBatch}` : ''}</p></div>}
                {detail.inseminator && <div><p className="text-xs text-gray-500">Inseminador</p><p className="font-medium text-gray-800">{detail.inseminator}</p></div>}
                {detail.heatDate && <div><p className="text-xs text-gray-500">Cio</p><p className="font-medium text-gray-800">{fmt(detail.heatDate)}</p></div>}
                <div><p className="text-xs text-gray-500">Parto Esperado</p><p className="font-medium text-gray-800">{detail.expectedBirthDate ? fmt(detail.expectedBirthDate) : '—'}</p></div>
                {!detail.actualBirthDate && (detail.status === 'Coberta' || detail.status === 'Prenha') && (() => {
                  const g = gestation(detail.coverageDate, detail.expectedBirthDate, todayISO())
                  return g && (
                    <div className="sm:col-span-2">
                      <p className="text-xs text-gray-500">Gestação</p>
                      <p className="font-medium text-gray-800">{g.days} dia{g.days === 1 ? '' : 's'} · {g.toBirth >= 0 ? `faltam ${g.toBirth} dia${g.toBirth === 1 ? '' : 's'} para o parto` : `parto atrasado ${-g.toBirth} dia${g.toBirth === -1 ? '' : 's'}`}</p>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100" aria-hidden="true"><div className="h-full rounded-full bg-purple-500" style={{ width: `${g.percent}%` }} /></div>
                    </div>
                  )
                })()}
                {detail.actualBirthDate && <div><p className="text-xs text-gray-500">Parto Real</p><p className="font-medium text-green-700">{fmt(detail.actualBirthDate)}</p></div>}
                {detail.observations && <div className="sm:col-span-2"><p className="text-xs text-gray-500">Observações</p><p className="text-gray-700">{detail.observations}</p></div>}
              </div>

              {/* Parto: anota a cria (ela entra no rebanho, ligada à mãe) e a cobertura fecha sozinha */}
              {birthMother && (
                registeringBirth ? (
                  <div className="mb-4">
                    <AddCalfForm mother={birthMother} animals={herd} farmId={farmId} isOnline={isOnline}
                      onCancel={() => setRegisteringBirth(false)}
                      onSaved={() => { setRegisteringBirth(false); setDetail(null); loadData(farmId) }} />
                  </div>
                ) : (
                  <button type="button" onClick={() => setRegisteringBirth(true)}
                    className="mb-4 w-full bg-green-700 hover:bg-green-600 text-white font-semibold py-3 rounded-lg">
                    Registrar parto e anotar a cria
                  </button>
                )
              )}

              {canEdit && !detail.id.startsWith('pending_') && (editingRecord
                ? <RecordEditor record={detail} onCancel={() => setEditingRecord(false)} onSaved={() => { setEditingRecord(false); setDetail(null); loadData(farmId) }} />
                : <button type="button" onClick={() => setEditingRecord(true)} className="mb-4 w-full border border-gray-300 text-gray-700 font-semibold py-2.5 rounded-lg hover:bg-gray-50">Editar registro</button>)}

              <div className="border-t border-gray-100 pt-4 mb-4">
                <p className="text-xs font-semibold text-gray-600 mb-2">Atualizar status</p>
                <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-green-600">
                  {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
                </select>
                {editStatus === 'Parida' && (
                  <div>
                    <label className="text-xs text-gray-600">Data do Parto</label>
                    <input type="date" value={editBirthDate} onChange={e => setEditBirthDate(e.target.value)}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={handleUpdateStatus} className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm font-medium py-2 rounded-lg">Salvar</button>
                <button onClick={() => handleDelete(detail.id)} className="flex-1 border border-red-200 text-red-500 hover:bg-red-50 text-sm font-medium py-2 rounded-lg">Excluir</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Register modal */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Registrar cobertura</h2>
                <button onClick={closeRegister} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>
              {repeated && (
                <p role="status" className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
                  <strong>{repeated.count} cobertura{repeated.count === 1 ? '' : 's'} salva{repeated.count === 1 ? '' : 's'}.</strong> Mantido para a próxima fêmea: {repeated.kept.join(', ')}.
                </p>
              )}
              <form onSubmit={e => { e.preventDefault(); void handleSave(false) }} className="flex flex-col gap-3">
                <AnimalPicker animals={females} value={form.femaleId} onChange={id => setForm({ ...form, femaleId: id })} label="Fêmea" />
                <fieldset>
                  <legend className="text-xs font-medium text-gray-600">Como foi</legend>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {COVERAGE_METHODS.map(m => (
                      <button key={m.key} type="button" aria-pressed={form.method === m.key} onClick={() => setForm({ ...form, method: form.method === m.key ? '' : m.key })}
                        className={`rounded-xl border-2 px-2 py-2 text-left ${form.method === m.key ? 'border-green-700 bg-green-50' : 'border-gray-200'}`}>
                        <span className={`block text-sm font-semibold ${form.method === m.key ? 'text-green-800' : 'text-gray-700'}`}>{m.label}</span>
                        <span className="block text-xs text-gray-500">{m.hint}</span>
                      </button>
                    ))}
                  </div>
                </fieldset>
                <div>
                  <label className="text-xs font-medium text-gray-600">Touro</label>
                  <input type="text" value={form.maleName} onChange={e => setForm({ ...form, maleName: e.target.value })} placeholder="Nome ou código do touro"
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-600">Data Cobertura *</label>
                    <input type="date" value={form.coverageDate} onChange={e => setForm({ ...form, coverageDate: e.target.value })} required max={todayISO()}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                    {form.status === 'Prenha' && !form.coverageDate && (
                      <p className="mt-1 text-xs text-amber-800">Se não souber o dia certo, coloque uma data aproximada: ela define a previsão do parto.</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600">Status</label>
                    <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
                      className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600">
                      {STATUS_LIST.map(s => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                {/* Detalhes recolhidos: o registro rápido é fêmea, como foi, touro e data */}
                <details className="rounded-lg border border-gray-200 px-3 py-2" open={!!(form.semenBatch || form.inseminator || form.bullRegistry || form.heatDate)}>
                  <summary className="cursor-pointer text-sm font-medium text-gray-700">Mais detalhes (opcional)</summary>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {isInsemination(form.method) && (
                      <>
                        <label className="text-xs font-medium text-gray-600">Partida do sêmen
                          <input value={form.semenBatch} onChange={e => setForm({ ...form, semenBatch: e.target.value })} placeholder="Ex.: 2412-A" className={FIELD} />
                        </label>
                        <label className="text-xs font-medium text-gray-600">Inseminador
                          <input value={form.inseminator} onChange={e => setForm({ ...form, inseminator: e.target.value })} placeholder="Quem inseminou" className={FIELD} />
                        </label>
                      </>
                    )}
                    <label className="text-xs font-medium text-gray-600">Registro do touro
                      <input value={form.bullRegistry} onChange={e => setForm({ ...form, bullRegistry: e.target.value })} placeholder="Ex.: RGD 12345" className={FIELD} />
                    </label>
                    <label className="text-xs font-medium text-gray-600">Data do cio
                      <input type="date" max={todayISO()} value={form.heatDate} onChange={e => setForm({ ...form, heatDate: e.target.value })} className={FIELD} />
                    </label>
                    <label className="text-xs font-medium text-gray-600 sm:col-span-2">Observações
                      <textarea value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} rows={2} className={`${FIELD} resize-none`} />
                    </label>
                  </div>
                </details>
                {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}
                <div className="flex flex-col gap-2 pt-1 sm:flex-row">
                  <button type="button" onClick={closeRegister} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50">{repeated ? 'Fechar' : 'Cancelar'}</button>
                  <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-medium py-2.5 rounded-lg">{saving ? 'Salvando...' : 'Salvar'}</button>
                </div>
                <button type="button" disabled={saving} onClick={() => void handleSave(true)}
                  className="rounded-lg border-2 border-green-700 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-50 disabled:opacity-50">
                  Salvar e repetir para outra fêmea
                </button>
                <p className="text-xs text-gray-500">Para o dia de inseminação: a data, o tipo, o touro, a partida e o inseminador ficam preenchidos e só a fêmea muda.</p>
              </form>
            </div>
          </div>
        </div>
      )}
    </PermissionGuard>
  )
}

/** Corrigir a cobertura: datas, reprodutor, inseminação ou monta, sêmen, registro do touro e observações */
function RecordEditor({ record, onCancel, onSaved }: { record: Reproduction; onCancel: () => void; onSaved: () => void }) {
  const day = (v?: string | null) => (v ? v.slice(0, 10) : '')
  const [form, setForm] = useState({
    coverageDate: day(record.coverageDate), expectedBirthDate: day(record.expectedBirthDate), heatDate: day(record.heatDate),
    method: record.method ?? '', maleName: record.maleName ?? '', bullRegistry: record.bullRegistry ?? '', semenBatch: record.semenBatch ?? '',
    inseminator: record.inseminator ?? '', observations: record.observations ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const field = 'mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600'

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      // A data da cobertura recalcula o parto previsto; a previsão digitada vale por cima
      const res = await fetch(`/api/reproducao/${record.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, method: form.method || null, status: record.status }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Não foi possível salvar')
      onSaved()
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : 'Sem internet. Tente de novo quando houver sinal.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={save} className="mb-4 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 p-3 sm:grid-cols-2">
      <label className="text-xs font-medium text-gray-600">Data da cobertura
        <input type="date" required value={form.coverageDate} onChange={e => setForm({ ...form, coverageDate: e.target.value })} className={field} />
      </label>
      <label className="text-xs font-medium text-gray-600">Parto estimado
        <input type="date" value={form.expectedBirthDate} onChange={e => setForm({ ...form, expectedBirthDate: e.target.value })} className={field} />
      </label>
      <label className="text-xs font-medium text-gray-600">Data do cio
        <input type="date" value={form.heatDate} onChange={e => setForm({ ...form, heatDate: e.target.value })} className={field} />
      </label>
      <label className="text-xs font-medium text-gray-600">Como foi
        <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} className={field}>
          <option value="">Não informado</option>
          {COVERAGE_METHODS.map(m => <option key={m.key} value={m.key}>{m.label} ({m.hint})</option>)}
        </select>
      </label>
      <label className="text-xs font-medium text-gray-600">Touro (nome)
        <input value={form.maleName} onChange={e => setForm({ ...form, maleName: e.target.value })} className={field} />
      </label>
      <label className="text-xs font-medium text-gray-600">Registro do touro
        <input value={form.bullRegistry} onChange={e => setForm({ ...form, bullRegistry: e.target.value })} className={field} />
      </label>
      {(isInsemination(form.method) || !form.method) && (
        <>
          <label className="text-xs font-medium text-gray-600">Partida do sêmen
            <input value={form.semenBatch} onChange={e => setForm({ ...form, semenBatch: e.target.value })} className={field} />
          </label>
          <label className="text-xs font-medium text-gray-600">Inseminador
            <input value={form.inseminator} onChange={e => setForm({ ...form, inseminator: e.target.value })} className={field} />
          </label>
        </>
      )}
      <label className="text-xs font-medium text-gray-600 sm:col-span-2">Observações
        <textarea value={form.observations} onChange={e => setForm({ ...form, observations: e.target.value })} rows={2} className={field} />
      </label>
      {error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="button" onClick={onCancel} className="flex-1 border border-gray-200 text-gray-600 text-sm font-medium py-2 rounded-lg">Cancelar</button>
        <button type="submit" disabled={saving} className="flex-1 bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-medium py-2 rounded-lg">{saving ? 'Salvando...' : 'Salvar alteração'}</button>
      </div>
    </form>
  )
}
