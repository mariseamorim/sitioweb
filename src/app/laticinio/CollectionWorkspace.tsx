'use client'

// Painel de coleta usado pelo laticínio e pela associação

import { useCallback, useEffect, useState } from 'react'
import { currentMonthRange, todayISO } from '@/lib/utils'
import { type DairyPanel, fmtL } from './types'
import { TodaySection } from './TodaySection'
import { CollectionsSection } from './CollectionsSection'
import { RoutesSection } from './RoutesSection'
import { PointsSection } from './PointsSection'
import { DriversSection } from './DriversSection'
import { ReceptionSection } from './ReceptionSection'
import type { Accent } from '@/components/StatTile'

type Tab = 'hoje' | 'coletas' | 'rotas' | 'pontos' | 'motoristas' | 'recebimento'

// Mesmas cores do StatTile, num botão (os cartões do painel também são o menu)
const NAV_ACCENT: Record<Accent, { box: string; bar: string; value: string }> = {
  green: { box: 'border-green-200 bg-green-50', bar: 'bg-green-600', value: 'text-green-900' },
  blue: { box: 'border-blue-200 bg-blue-50', bar: 'bg-blue-600', value: 'text-blue-900' },
  teal: { box: 'border-teal-200 bg-teal-50', bar: 'bg-teal-600', value: 'text-teal-900' },
  amber: { box: 'border-amber-200 bg-amber-50', bar: 'bg-amber-500', value: 'text-amber-800' },
  red: { box: 'border-red-200 bg-red-50', bar: 'bg-red-600', value: 'text-red-700' },
}

/**
 * Ferramentas de coleta: pontos de coleta → rotas → motoristas → coletas, pendências e recebimento.
 * É o painel do laticínio e também a "Coleta compartilhada" da associação (embedded: sem o título do painel).
 */
export function CollectionWorkspace({ embedded = false }: { embedded?: boolean }) {
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
  // Cor pelo significado: parada pendente = laranja; litros = verde; contagens = azul/turquesa
  const cards: [Tab, string, string, Accent][] = [
    ['hoje', 'Hoje: paradas pendentes', String(pending), pending > 0 ? 'amber' : 'green'],
    ['coletas', 'Coletado no período', fmtL(collected), 'green'],
    ['rotas', 'Rotas', String(panel.routes.filter((r) => r.active).length), 'blue'],
    ['pontos', 'Pontos de coleta', String(activePoints), 'teal'],
    ['motoristas', 'Motoristas', String(panel.drivers.length), 'blue'],
    ['recebimento', 'Recebido no período', fmtL(received), 'teal'],
  ]

  return (
    <div>
      {embedded ? (
        <p className="mb-4 text-sm text-gray-600">
          Organize a coleta do leite dos associados: pontos de coleta, rotas, motoristas e o que chegou no tanque ou no laticínio.
        </p>
      ) : (
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-gray-900">{panel.organization.name}</h1>
          <p className="text-gray-500 text-sm mt-1">Painel do laticínio</p>
        </div>
      )}

      {!embedded && panel.organization.status === 'pendente' && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
          <p className="font-semibold">Cadastro em análise</p>
          <p className="text-sm mt-0.5">Você já pode cadastrar pontos, rotas e motoristas enquanto o cadastro é aprovado.</p>
        </div>
      )}

      {/* Os cartões são o menu: cada um mostra o número e abre a sua seção */}
      <div role="navigation" aria-label="Seções do painel" className="grid grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
        {cards.map(([target, label, value, accent]) => {
          const active = tab === target
          const a = NAV_ACCENT[accent]
          return (
            <button key={target} type="button" onClick={() => setTab(target)} aria-current={active ? 'page' : undefined}
              className={`relative overflow-hidden text-left rounded-xl border p-3 pt-4 sm:p-4 sm:pt-5 ${a.box} ${active ? 'ring-2 ring-green-800 ring-offset-1' : 'hover:brightness-95'}`}>
              <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 ${a.bar}`} />
              <p className={`text-sm ${active ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>{label}</p>
              <p className={`mt-1 text-xl font-bold tabular-nums ${a.value}`}>{value}</p>
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
