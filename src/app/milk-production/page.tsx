'use client'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'
import { getPendingRecords, removePendingRecord } from '@/lib/offlineStorage'
import { MilkDailyEntry } from '@/components/MilkDailyEntry'
import { MilkTotalEntry } from '@/components/MilkTotalEntry'
import { MilkCollections } from '@/components/MilkCollections'

import { useEffect, useState, useMemo } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { SemSinalIcon, SincronizarIcon, FecharIcon } from '@/components/ModuleIcons'
import { fmtNumber } from '@/lib/reports'

interface Animal {
  id: string
  name: string
  code: string
}

interface Production {
  id: string
  animalId: string | null
  date: string
  quantity: number
  cowsMilked?: number | null
  observations?: string | null
  animal: Animal | null
}

type RegisterMode = 'total' | 'vaca'
const MODE_KEY = 'milk_register_mode'

/** Datas são gravadas como meia-noite UTC do dia: exibir em UTC evita mostrar o dia anterior */
const fmtDay = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
const fmtWeekday = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC', weekday: 'short' }).replace('.', '')

function readMode(): RegisterMode {
  try { return localStorage.getItem(MODE_KEY) === 'vaca' ? 'vaca' : 'total' } catch { return 'total' }
}

export default function MilkProductionPage() {
  const { confirm } = useDialog()
  const { user } = useUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const now = new Date()
  const [productions, setProductions] = useState<Production[]>([])
  const [allAnimals, setAllAnimals] = useState<Animal[]>([])
  const [loading, setLoading] = useState(true)
  const [farmId, setFarmId] = useState('')
  const [from, setFrom] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10))
  const [to, setTo] = useState(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10))
  const [view, setView] = useState<'dia' | 'vaca'>('dia')
  const [detailDay, setDetailDay] = useState<string | null>(null)
  const [detailAnimalId, setDetailAnimalId] = useState<string | null>(null)
  const [showRegister, setShowRegister] = useState(false)
  const [registerMode, setRegisterMode] = useState<RegisterMode>('total')
  const [isOnline, setIsOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    setIsOnline(navigator.onLine)
    setPendingCount(getPendingRecords('milk_productions').length)
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
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => {
        if (!data.farmId) return
        setFarmId(data.farmId)
        loadData(data.farmId)
      })
  }, [])

  function loadData(fid: string) {
    setLoading(true)
    Promise.all([
      fetch(`/api/milk-production?farmId=${fid}`).then((r) => r.json()),
      fetch(`/api/animals?farmId=${fid}`).then((r) => r.json()),
    ]).then(([prods, animals]) => {
      setProductions(Array.isArray(prods) ? prods : [])
      setAllAnimals(
        Array.isArray(animals)
          ? animals.filter(
              (a: Animal & { species: string; gender: string; status: string }) =>
                a.species.toLowerCase() === 'vaca' &&
                a.gender.toLowerCase() === 'fêmea' &&
                !['morto', 'vendido'].includes(a.status.toLowerCase())
            )
          : []
      )
      setLoading(false)
    })
  }

  function openRegister() {
    setRegisterMode(readMode())
    setShowRegister(true)
  }

  function chooseMode(mode: RegisterMode) {
    setRegisterMode(mode)
    try { localStorage.setItem(MODE_KEY, mode) } catch {}
  }

  const filtered = useMemo(() => {
    return productions.filter((p) => {
      const d = new Date(p.date)
      if (from && d < new Date(from)) return false
      if (to && d > new Date(to + 'T23:59:59')) return false
      return true
    })
  }, [productions, from, to])

  const grandTotal = filtered.reduce((s, p) => s + p.quantity, 0)

  // Por dia: soma os totais do dia e os lançamentos por vaca
  const byDay = useMemo(() => {
    const map = new Map<string, { day: string; total: number; cows: Set<string>; cowsInTotal: number; count: number }>()
    for (const p of filtered) {
      const day = p.date.slice(0, 10)
      const d = map.get(day) ?? { day, total: 0, cows: new Set<string>(), cowsInTotal: 0, count: 0 }
      d.total += p.quantity
      d.count++
      if (p.animalId) d.cows.add(p.animalId)
      else if (p.cowsMilked) d.cowsInTotal = Math.max(d.cowsInTotal, p.cowsMilked)
      map.set(day, d)
    }
    return [...map.values()].sort((a, b) => b.day.localeCompare(a.day))
  }, [filtered])

  const byCow = useMemo(() => {
    const map = new Map<string, { animal: Animal; total: number; count: number }>()
    for (const p of filtered) {
      if (!p.animal) continue
      const s = map.get(p.animal.id)
      if (s) { s.total += p.quantity; s.count++ }
      else map.set(p.animal.id, { animal: p.animal, total: p.quantity, count: 1 })
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [filtered])

  const totalsByDay = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of productions) {
      const day = p.date.slice(0, 10)
      map.set(day, (map.get(day) ?? 0) + p.quantity)
    }
    return map
  }, [productions])

  const hasCowRecords = byCow.length > 0
  const activeView = hasCowRecords ? view : 'dia'
  const average = byDay.length ? grandTotal / byDay.length : 0

  const detailDayItems = detailDay ? productions.filter((p) => p.date.slice(0, 10) === detailDay) : []
  const detailAnimal = detailAnimalId ? productions.find((p) => p.animalId === detailAnimalId)?.animal ?? null : null
  const detailAnimalItems = useMemo(() => {
    if (!detailAnimalId) return []
    return productions
      .filter((p) => p.animalId === detailAnimalId)
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [productions, detailAnimalId])
  const detailAnimalPeriodTotal = filtered
    .filter((p) => p.animalId === detailAnimalId)
    .reduce((s, p) => s + p.quantity, 0)

  async function handleDelete(id: string) {
    if (!canEdit) return
    if (!(await confirm({ title: 'Excluir este registro de leite?', confirmLabel: 'Excluir', danger: true }))) return
    await fetch(`/api/milk-production/${id}`, { method: 'DELETE' })
    loadData(farmId)
  }

  async function handleSync() {
    const pending = getPendingRecords('milk_productions')
    if (!pending.length) return
    setSyncing(true)
    for (const record of pending) {
      try {
        const pendingId = record._pendingId
        const res = await fetch('/api/milk-production', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            animalId: record.animalId, date: record.date, quantity: record.quantity,
            cowsMilked: record.cowsMilked, observations: record.observations,
          }),
        })
        if (res.ok) removePendingRecord('milk_productions', pendingId)
      } catch {
        // keep record for next sync attempt
      }
    }
    setPendingCount(getPendingRecords('milk_productions').length)
    setSyncing(false)
    if (farmId) loadData(farmId)
  }

  function onRegistered({ pending }: { pending: number }) {
    if (pending) setPendingCount(pending)
    setShowRegister(false)
    if (isOnline) loadData(farmId)
  }

  const deleteButton = (id: string) => (
    <button
      onClick={() => handleDelete(id)}
      disabled={!canEdit}
      className={`p-1 ${canEdit ? 'text-red-400 hover:text-red-600' : 'text-gray-300 cursor-not-allowed'}`}
      title="Excluir"
      aria-label="Excluir"
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6" />
      </svg>
    </button>
  )

  return (
    <PermissionGuard module="leite">
      <div>
      {/* Header */}
      <div className="page-toolbar flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Produção de Leite</h1>
          <p className="text-gray-500 text-sm mt-1">Leite produzido no período selecionado</p>
        </div>
        <button
          onClick={openRegister}
          disabled={!canEdit}
          className={`text-white text-sm font-medium px-4 py-2 rounded-lg ${
            canEdit
              ? 'bg-green-700 hover:bg-green-600'
              : 'bg-gray-400 cursor-not-allowed'
          }`}
        >
          Anotar leite
        </button>
      </div>

      {/* Offline / sync banner */}
      {!isOnline && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center gap-2">
          <SemSinalIcon className="w-5 h-5 shrink-0" />
          <span>Sem internet. Ao salvar, os registros ficam neste aparelho. Quando a internet voltar, use “Enviar registros”.</span>
        </div>
      )}
      {isOnline && pendingCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl px-4 py-3 mb-4 text-sm flex items-center justify-between gap-2">
          <span className="flex items-center gap-2"><SincronizarIcon className="w-5 h-5 shrink-0" />{pendingCount} registro{pendingCount > 1 ? 's' : ''} pendente{pendingCount > 1 ? 's' : ''} para enviar</span>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="bg-blue-700 hover:bg-blue-600 disabled:bg-blue-400 text-white text-xs font-medium px-3 py-1.5 rounded-lg shrink-0"
          >
            {syncing ? 'Enviando...' : 'Enviar registros'}
          </button>
        </div>
      )}

      {/* Period filter + total */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">De</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Até</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div className="ml-auto flex gap-6 text-right">
            <div>
              <p className="text-xs text-gray-500">Média por dia</p>
              <p className="text-2xl font-bold text-gray-800">{fmtNumber(average)} L</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Total no período</p>
              <p className="text-2xl font-bold text-green-700">{fmtNumber(grandTotal)} L</p>
            </div>
          </div>
        </div>
      </div>

      {/* Por dia / por vaca */}
      {hasCowRecords && (
        <div className="inline-grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl mb-4">
          {([['dia', 'Por dia'], ['vaca', 'Por vaca']] as const).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-5 py-2 rounded-lg text-sm font-semibold ${activeView === v ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 text-sm">Carregando...</p>
      ) : byDay.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg">Nenhuma produção registrada no período</p>
          <p className="text-sm mt-1">Ajuste o período ou clique em &quot;Anotar leite&quot;</p>
        </div>
      ) : activeView === 'dia' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Dia</th>
                <th className="px-4 py-3 text-right">Vacas</th>
                <th className="px-4 py-3 text-right">Total (L)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {byDay.map((d) => {
                const cows = d.cows.size + d.cowsInTotal
                return (
                  <tr key={d.day} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetailDay(d.day)}>
                    <td className="px-4 py-3 text-gray-800">
                      <span className="font-medium">{fmtDay(d.day)}</span>
                      <span className="ml-2 text-xs text-gray-400">{fmtWeekday(d.day)}</span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{cows || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-700">{fmtNumber(d.total)}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
              <tr>
                <td colSpan={2} className="px-4 py-3 text-xs font-bold text-gray-600 uppercase">Total ({byDay.length} dias)</td>
                <td className="px-4 py-3 text-right font-bold text-green-700">{fmtNumber(grandTotal)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Animal</th>
                <th className="hidden sm:table-cell px-4 py-3 text-left">Código</th>
                <th className="px-4 py-3 text-right">Total (L)</th>
                <th className="hidden sm:table-cell px-4 py-3 text-right">Registros</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {byCow.map(({ animal, total, count }) => (
                <tr key={animal.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setDetailAnimalId(animal.id)}>
                  <td className="px-4 py-3 font-medium text-gray-800">{animal.name}</td>
                  <td className="hidden sm:table-cell px-4 py-3 font-mono text-gray-500 text-xs">{animal.code}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">{fmtNumber(total)}</td>
                  <td className="hidden sm:table-cell px-4 py-3 text-right text-gray-500">{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {byCow.length < byDay.length && (
            <p className="px-4 py-3 text-xs text-gray-500 border-t border-gray-100">
              Lançamentos de total do dia (sem vaca) aparecem só na visão por dia.
            </p>
          )}
        </div>
      )}

      <MilkCollections from={from} to={to} canEdit={canEdit} />

      {/* Detalhe do dia */}
      {detailDay && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetailDay(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Leite de {fmtDay(detailDay)}</h2>
                <button onClick={() => setDetailDay(null)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>
              <ul className="divide-y divide-gray-100 border border-gray-100 rounded-xl">
                {detailDayItems.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-800">
                        {p.animal ? `${p.animal.name} (${p.animal.code})` : 'Total do dia'}
                      </p>
                      {(p.cowsMilked || p.observations) && (
                        <p className="text-xs text-gray-500">
                          {[p.cowsMilked ? `${p.cowsMilked} vacas` : '', p.observations].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <span className="font-semibold text-gray-800">{fmtNumber(p.quantity)} L</span>
                    {deleteButton(p.id)}
                  </li>
                ))}
              </ul>
              {detailDayItems.length === 0 && <p className="text-center py-6 text-gray-400 text-sm">Nenhum registro</p>}
            </div>
          </div>
        </div>
      )}

      {/* Detalhe da vaca */}
      {detailAnimalId && detailAnimal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetailAnimalId(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{detailAnimal.name}</h2>
                  <p className="text-xs text-gray-500">Código: {detailAnimal.code}</p>
                </div>
                <button onClick={() => setDetailAnimalId(null)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>

              <div className="bg-green-50 border border-green-100 rounded-lg px-4 py-3 mb-4 text-sm flex justify-between">
                <span className="text-gray-600">Total no período selecionado</span>
                <span className="font-bold text-green-700">{fmtNumber(detailAnimalPeriodTotal)} L</span>
              </div>

              <h3 className="text-sm font-semibold text-gray-700 mb-2">Histórico completo</h3>
              <div className="rounded-xl border border-gray-100 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">Data</th>
                      <th className="px-4 py-2 text-right">Qtd (L)</th>
                      <th className="hidden sm:table-cell px-4 py-2 text-left">Observações</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {detailAnimalItems.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700">{fmtDay(p.date)}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-800">{fmtNumber(p.quantity)}</td>
                        <td className="hidden sm:table-cell px-4 py-2 text-gray-500 text-xs">{p.observations || '—'}</td>
                        <td className="px-4 py-2 text-right">{deleteButton(p.id)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lançar leite */}
      {showRegister && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowRegister(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">Anotar leite</h2>
                <button onClick={() => setShowRegister(false)} className="text-gray-400 hover:text-gray-600 p-1" aria-label="Fechar"><FecharIcon /></button>
              </div>

              <div className="grid grid-cols-2 gap-1 bg-gray-100 p-1 rounded-xl mb-5">
                {([['total', 'Total do dia'], ['vaca', 'Por vaca']] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => chooseMode(mode)}
                    className={`py-2.5 rounded-lg text-sm font-semibold transition-colors ${
                      registerMode === mode ? 'bg-white text-green-700 shadow-sm' : 'text-gray-500'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {registerMode === 'total' ? (
                <MilkTotalEntry
                  totalsByDay={totalsByDay}
                  isOnline={isOnline}
                  onCancel={() => setShowRegister(false)}
                  onDone={onRegistered}
                />
              ) : (
                <MilkDailyEntry
                  cows={allAnimals}
                  productions={productions}
                  isOnline={isOnline}
                  onCancel={() => setShowRegister(false)}
                  onDone={onRegistered}
                />
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </PermissionGuard>
  )
}
