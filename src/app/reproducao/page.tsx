'use client'
import { AnimalPicker } from '@/components/AnimalPicker'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'
import { animalSearchText } from '@/lib/animalCode'
import { useSort } from '@/lib/useSort'
import { SortTh } from '@/components/SortTh'

import { useCallback, useEffect, useState, useMemo } from 'react'
import { removePendingRecord, type OfflineRecord } from '@/lib/offlineStorage'
import { cachedGet, isPendingId, pendingIdOf, pendingItemId, pendingOf, sendOrQueue, updatePending, withPending, type PendingRequest, type QueuedRequest } from '@/lib/offlineData'
import { useOfflineModule } from '@/lib/useOffline'
import { loadHerd } from '@/lib/herdCache'
import { useDialog } from '@/components/DialogProvider'
import { todayISO } from '@/lib/utils'
import { SemSinalIcon, SincronizarIcon, FecharIcon, ReproducaoIcon } from '@/components/ModuleIcons'
import { HerdCalvingPanel, PregnancyCheckPanel } from '@/components/HerdCalvingPanel'
import { canBreed } from '@/lib/animalRules'
import { isInRearing } from '@/lib/rearing'
import { pregnancyChecks, type PregnancyCheck } from '@/lib/calving'
import { AddCalfForm } from '@/components/CalfSection'
import { QuickFilterChip, useQuickFilter } from '@/components/QuickFilter'
import { COVERAGE_METHODS, EMPTY_COVERAGE, GESTATION_DAYS, gestation, isInsemination, methodLabel, plusDays, repeatCoverage, repeatedFields, type CoverageForm } from '@/lib/coverage'

interface Animal { id: string; name: string; code: string; species: string; gender: string; status: string; birthDate: string; motherId?: string | null; rearingStart?: string | null; rearingEnd?: string | null }

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

const MODULE = 'reproducao'

/** Cobertura guardada sem internet, como aparece na lista. Registros antigos da fila têm os campos soltos (sem _body nem _type). */
function pendingReproduction(p: PendingRequest, herd: Animal[]): Reproduction | null {
  if ((p._type ?? 'create') !== 'create') return null
  const b = (p._body ?? p) as Record<string, string | null | undefined>
  const femaleId = b.femaleId ?? ''
  const female = (p.female as Animal | undefined) ?? herd.find(a => a.id === femaleId) ?? { id: femaleId, name: '(sem internet)', code: '', species: '', gender: 'Fêmea', status: 'Vivo', birthDate: '' }
  return {
    id: pendingItemId(p), femaleId, female, maleName: b.maleName || null, coverageDate: b.coverageDate ?? '',
    // O servidor calcula o parto previsto; aqui a mesma conta, para a lista e o painel de partos
    expectedBirthDate: b.expectedBirthDate || (b.coverageDate ? plusDays(b.coverageDate, GESTATION_DAYS) : null),
    actualBirthDate: b.actualBirthDate || null, status: b.status || 'Coberta', calfId: null, observations: b.observations || null,
    method: b.method || null, heatDate: b.heatDate || null, semenBatch: b.semenBatch || null, bullRegistry: b.bullRegistry || null, inseminator: b.inseminator || null,
  }
}

/** Fila antiga (antes de cada pedido levar a própria URL): era sempre um POST com os campos soltos mais a fêmea */
const legacyRequest = (r: OfflineRecord): QueuedRequest => {
  const data = Object.fromEntries(Object.entries(r).filter(([k]) => !['_pendingId', '_type', 'female'].includes(k)))
  return { url: '/api/reproducao', method: 'POST', body: data }
}

export default function ReproducaoPage() {
  const { confirm } = useDialog()
  const { user } = useUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const farmId = user?.farmId ?? ''
  const [reproductions, setReproductions] = useState<Reproduction[]>([])
  const [females, setFemales] = useState<Animal[]>([])
  const [animalSearch, setAnimalSearch] = useState('')
  const [herd, setHerd] = useState<Animal[]>([])
  const [registeringBirth, setRegisteringBirth] = useState(false)
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [notice, setNotice] = useState('')
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

  // Lista e rebanho com cópia no aparelho; a fila (coberturas, correções e exclusões sem internet) entra por cima
  const loadData = useCallback(async (fid: string) => {
    const [repros, herdLoaded] = await Promise.all([
      cachedGet<Reproduction[]>(`cache_reproducao_${fid}`, `/api/reproducao?farmId=${fid}`).catch(() => null),
      loadHerd<Animal>(fid).catch(() => null),
    ])
    const anims = Array.isArray(herdLoaded?.data) ? herdLoaded.data : []
    const list = Array.isArray(repros?.data) ? repros.data : []
    setHerd(anims)
    // Só fêmeas vivas e, se bovinas, com 2 anos ou mais
    setFemales(anims.filter(a => canBreed(a, undefined, { inRearingLot: isInRearing(a) })))
    setReproductions(withPending(list, pendingOf(MODULE, p => p.farmId === fid), p => pendingReproduction(p, anims)))
    setFromCache(!!(repros?.fromCache || herdLoaded?.fromCache))
    setLoading(false)
  }, [])
  const reload = useCallback(() => { if (farmId) void loadData(farmId) }, [farmId, loadData])
  const net = useOfflineModule(MODULE, reload, legacyRequest)
  useEffect(() => { void Promise.resolve().then(reload) }, [reload])

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

  // Depois de guardar ou enviar: a lista mostra na hora e a barra do topo atualiza a contagem
  const afterChange = (queued: boolean) => {
    setNotice(queued ? net.queuedMessage : '')
    net.refresh()
    reload()
  }

  // Resposta do "Confirmar prenhez": atualiza a cobertura anotada depois do parto ou cria o registro
  async function answerPregnancyCheck(check: PregnancyCheck, answer: 'Prenha' | 'Vazia') {
    let r
    if (check.openCoverage) {
      r = await sendOrQueue(MODULE, { type: 'update', id: check.openCoverage.id, url: `/api/reproducao/${check.openCoverage.id}`, method: 'PUT', body: { status: answer, observations: check.openCoverage.observations ?? null }, local: { farmId } })
    } else if (answer === 'Vazia') {
      const body = { femaleId: check.cow.id, coverageDate: todayISO(), status: 'Vazia', observations: 'Confirmada vazia depois do parto', farmId }
      r = await sendOrQueue(MODULE, { type: 'create', url: '/api/reproducao', method: 'POST', body, local: { farmId, female: check.cow } })
    } else {
      // Prenha sem cobertura anotada: abre o registro já preenchido para informar a data da cobertura
      setForm({ ...EMPTY_COVERAGE, femaleId: check.cow.id, coverageDate: '', status: 'Prenha' })
      openRegister()
      return
    }
    if (r.status === 'rejected') setNotice(r.error)
    else afterChange(r.status === 'queued')
  }

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (!(await confirm({ title: 'Excluir este registro de reprodução?', confirmLabel: 'Excluir', danger: true }))) return
    setDetail(null)
    if (isPendingId(id)) {
      // Ainda não foi enviado: sai da fila do aparelho
      removePendingRecord(MODULE, pendingIdOf(id))
      return afterChange(false)
    }
    const r = await sendOrQueue(MODULE, { type: 'delete', id, url: `/api/reproducao/${id}`, method: 'DELETE', local: { farmId } })
    if (r.status === 'rejected') setNotice(r.error)
    else afterChange(r.status === 'queued')
  }

  async function handleUpdateStatus() {
    if (!detail) return
    const body = { status: editStatus || detail.status, actualBirthDate: editBirthDate || null }
    setDetail(null)
    setEditStatus('')
    setEditBirthDate('')
    if (isPendingId(detail.id)) {
      // Ainda na fila: o status novo vai junto quando for enviada
      updatePending(MODULE, pendingIdOf(detail.id), p => (p._body ? { ...p, _body: { ...(p._body as object), ...body } } : { ...p, ...body }))
      return afterChange(true)
    }
    const r = await sendOrQueue(MODULE, { type: 'update', id: detail.id, url: `/api/reproducao/${detail.id}`, method: 'PUT', body, local: { farmId } })
    if (r.status === 'rejected') setNotice(r.error)
    else afterChange(r.status === 'queued')
  }

  function openRegister() {
    setRepeated(null)
    setError('')
    setShowRegister(true)
  }

  function closeRegister() {
    setShowRegister(false)
    setForm({ ...EMPTY_COVERAGE, coverageDate: todayISO() })
    if (repeated) reload()
  }

  // Salva a cobertura. Com `repeat`, mantém data, tipo, touro, partida e inseminador e limpa só a fêmea:
  // é o dia de IATF, em que a fila toda leva o mesmo sêmen e só muda o brinco.
  async function handleSave(repeat: boolean) {
    if (!form.femaleId) return setError('Escolha a fêmea')
    if (!form.coverageDate) return setError('Informe a data da cobertura')
    setSaving(true)
    setError('')
    const payload = { ...form, farmId, maleName: form.maleName || null, observations: form.observations || null }
    const female = females.find(f => f.id === form.femaleId)
    const r = await sendOrQueue(MODULE, { type: 'create', url: '/api/reproducao', method: 'POST', body: payload, local: { farmId, female } })
    setSaving(false)
    if (r.status === 'rejected') return setError(r.error)
    const queued = r.status === 'queued'
    net.refresh()

    if (repeat) {
      setForm(repeatCoverage(form))
      setRepeated((prev) => ({ count: (prev?.count ?? 0) + 1, kept: repeatedFields(form) }))
      if (queued) { setNotice(net.queuedMessage); reload() }
      return
    }
    setShowRegister(false)
    setForm({ ...EMPTY_COVERAGE, coverageDate: todayISO() })
    setRepeated(null)
    afterChange(queued)
  }

  // Datas gravadas à meia-noite UTC: mostrar em UTC para não cair no dia anterior no horário de Brasília
  const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  // Cobertura em aberto: dá para registrar o parto anotando a cria
  const birthMother = detail && canEdit && !detail.actualBirthDate && !isPendingId(detail.id) && (detail.status === 'Coberta' || detail.status === 'Prenha')
    ? herd.find((a) => a.id === detail.femaleId)
    : undefined

  return (
    <PermissionGuard module="reproducao">
      <div>
      <div className="flex items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reprodução</h1>
          <p className="text-gray-500 text-sm mt-1">Coberturas, prenhez e partos</p>
        </div>
        <button onClick={openRegister} disabled={!canEdit} className={`text-white text-sm font-medium px-4 py-2 rounded-lg shrink-0 whitespace-nowrap ${canEdit ? 'bg-green-700 hover:bg-green-600' : 'bg-gray-400 cursor-not-allowed'}`}>
          + Registrar
        </button>
      </div>

      {/* Sem internet / fila / aviso */}
      {(!net.online || fromCache) && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <SemSinalIcon className="w-5 h-5 shrink-0" />
          <span>{net.online ? 'Sinal fraco: mostrando a última cópia guardada neste aparelho.' : 'Sem internet.'} O que você registrar fica salvo no aparelho e é enviado quando a conexão voltar.</span>
        </div>
      )}
      {net.online && net.pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><SincronizarIcon className="w-5 h-5 shrink-0" />{net.pendingCount} registro{net.pendingCount > 1 ? 's' : ''} para enviar</span>
          <button
            onClick={() => void net.sync()}
            disabled={net.syncing}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
          >
            {net.syncing ? 'Enviando...' : 'Enviar agora'}
          </button>
        </div>
      )}
      {notice && (
        <div role="status" className="bg-green-50 border border-green-200 text-green-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-2">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="text-green-700 hover:text-green-900 p-1" aria-label="Fechar aviso"><FecharIcon /></button>
        </div>
      )}
      </div>

      {!loading && (
        <PregnancyCheckPanel checks={pregnancyChecks(herd, reproductions.filter(r => !isPendingId(r.id)))} canEdit={canEdit}
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
                  <td className="px-4 py-3 font-medium text-gray-800">{r.female.name}{isPendingId(r.id) && <span className="ml-2 text-xs font-normal text-blue-700">a enviar</span>}</td>
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
                  <p className="text-xs text-gray-500">Cobertura: {fmt(detail.coverageDate)}{isPendingId(detail.id) ? ' · a enviar' : ''}</p>
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
                    <AddCalfForm mother={birthMother} animals={herd} farmId={farmId} isOnline={net.online}
                      onCancel={() => setRegisteringBirth(false)}
                      onSaved={() => { setRegisteringBirth(false); setDetail(null); reload() }} />
                  </div>
                ) : (
                  <button type="button" onClick={() => setRegisteringBirth(true)}
                    className="mb-4 w-full bg-green-700 hover:bg-green-600 text-white font-semibold py-3 rounded-lg">
                    Registrar parto e anotar a cria
                  </button>
                )
              )}

              {canEdit && !isPendingId(detail.id) && (editingRecord
                ? <RecordEditor record={detail} farmId={farmId} onCancel={() => setEditingRecord(false)} onSaved={(queued) => { setEditingRecord(false); setDetail(null); afterChange(queued) }} />
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
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
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

/** Corrigir a cobertura: datas, reprodutor, inseminação ou monta, sêmen, registro do touro e observações. Sem internet, a correção fica na fila. */
function RecordEditor({ record, farmId, onCancel, onSaved }: { record: Reproduction; farmId: string; onCancel: () => void; onSaved: (queued: boolean) => void }) {
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
    // A data da cobertura recalcula o parto previsto; a previsão digitada vale por cima
    const body = { ...form, method: form.method || null, status: record.status }
    const r = await sendOrQueue(MODULE, { type: 'update', id: record.id, url: `/api/reproducao/${record.id}`, method: 'PUT', body, local: { farmId } })
    setSaving(false)
    if (r.status === 'rejected') return setError(r.error)
    onSaved(r.status === 'queued')
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
