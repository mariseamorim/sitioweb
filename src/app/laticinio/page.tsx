'use client'

import { useCallback, useEffect, useState } from 'react'
import { currentMonthRange, todayISO } from '@/lib/utils'
import { type DairyPanel, fmtL } from './types'
import { TodaySection } from './TodaySection'
import { CollectionsSection } from './CollectionsSection'
import { RoutesSection } from './RoutesSection'
import { PointsSection } from './PointsSection'
import { DriversSection } from './DriversSection'
import { ReceptionSection } from './ReceptionSection'

type Tab = 'hoje' | 'coletas' | 'rotas' | 'pontos' | 'motoristas' | 'recebimento'

// Painel do laticínio: pontos de coleta → rotas → motoristas → coletas, pendências e recebimento
export default function LaticinioPage() {
  const [panel, setPanel] = useState<DairyPanel | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('hoje')
  const [period, setPeriod] = useState(() => ({ from: currentMonthRange().from, to: todayISO() }))

  const load = useCallback(() => {
    fetch(`/api/laticinio?from=${period.from}&to=${period.to}`)
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw new Error(data.error)
        setPanel(data)
      })
      .catch((e: Error) => setError(e.message || 'Não foi possível carregar o painel'))
  }, [period])

  useEffect(load, [load])

  if (error) return <p className="mt-8 text-gray-500">{error}</p>
  if (!panel) return <p className="mt-8 text-gray-400 text-sm">Carregando...</p>

  const pending = panel.todayStops.filter((s) => s.status === 'pendente').length
  const collected = panel.entries.reduce((s, e) => s + (e.skipReason ? 0 : e.liters), 0)
  const received = panel.receptions.reduce((s, r) => s + r.liters, 0)
  const activePoints = panel.points.filter((p) => p.active).length
  const cards: [Tab, string, string, boolean][] = [
    ['hoje', 'Hoje: paradas pendentes', String(pending), pending > 0],
    ['coletas', 'Coletado no período', fmtL(collected), false],
    ['rotas', 'Rotas', String(panel.routes.filter((r) => r.active).length), false],
    ['pontos', 'Pontos de coleta', String(activePoints), false],
    ['motoristas', 'Motoristas', String(panel.drivers.length), false],
    ['recebimento', 'Recebido no período', fmtL(received), false],
  ]

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900">{panel.organization.name}</h1>
        <p className="text-gray-500 text-sm mt-1">Painel do laticínio</p>
      </div>

      {panel.organization.status === 'pendente' && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <p className="font-semibold">Cadastro em análise</p>
          <p className="text-sm mt-0.5">Você já pode cadastrar pontos, rotas e motoristas enquanto o cadastro é aprovado.</p>
        </div>
      )}

      {/* Os cartões são o menu: cada um mostra o número e abre a sua seção */}
      <div role="navigation" aria-label="Seções do painel" className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        {cards.map(([target, label, value, highlight]) => {
          const active = tab === target
          return (
            <button key={target} type="button" onClick={() => setTab(target)} aria-current={active ? 'page' : undefined}
              className={`text-left rounded-xl border-2 p-3 sm:p-4 ${active ? 'border-green-700 bg-green-50' : highlight ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
              <p className={`text-sm ${active ? 'font-semibold text-green-800' : 'text-gray-600'}`}>{label}</p>
              <p className={`mt-1 text-xl font-bold ${highlight ? 'text-amber-800' : 'text-gray-900'}`}>{value}</p>
            </button>
          )
        })}
      </div>

      {tab === 'hoje' && <TodaySection stops={panel.todayStops} today={panel.today} hasRoutes={panel.routes.length > 0} onGo={setTab} />}
      {tab === 'coletas' && <CollectionsSection panel={panel} period={period} onPeriod={setPeriod} />}
      {tab === 'rotas' && <RoutesSection panel={panel} onChanged={load} />}
      {tab === 'pontos' && <PointsSection points={panel.points} onChanged={load} />}
      {tab === 'motoristas' && <DriversSection drivers={panel.drivers} routes={panel.routes} onChanged={load} />}
      {tab === 'recebimento' && <ReceptionSection panel={panel} period={period} onPeriod={setPeriod} onChanged={load} />}
    </div>
  )
}
