'use client'

import { type TodayStop, fmtDay, fmtL } from './types'

const STATUS = {
  pendente: { label: 'Pendente', style: 'bg-amber-100 text-amber-800' },
  coletado: { label: 'Coletado', style: 'bg-green-100 text-green-800' },
  'nao-coletado': { label: 'Não coletado', style: 'bg-red-100 text-red-800' },
} as const

// Rotas de hoje: cada parada coletada, não coletada (com motivo) ou ainda pendente
export function TodaySection({ stops, today, hasRoutes, onGo }: {
  stops: TodayStop[]
  today: string
  hasRoutes: boolean
  onGo: (tab: 'rotas') => void
}) {
  if (stops.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-600">
        <p>Nenhuma rota programada para hoje ({fmtDay(today)}).</p>
        <button type="button" onClick={() => onGo('rotas')} className="mt-2 font-semibold text-green-700 underline">
          {hasRoutes ? 'Ver os dias das rotas' : 'Montar a primeira rota'}
        </button>
      </div>
    )
  }

  const routes = new Map<string, TodayStop[]>()
  for (const s of stops) routes.set(s.routeId, [...(routes.get(s.routeId) ?? []), s])

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Coletas de hoje, {fmtDay(today)}. Atualiza quando o motorista envia pelo Anota Aí Leite.</p>
      {[...routes.values()].map((list) => {
        const done = list.filter((s) => s.status !== 'pendente').length
        const liters = list.reduce((sum, s) => sum + (s.liters ?? 0), 0)
        return (
          <section key={list[0].routeId} className="rounded-xl border border-gray-200 bg-white">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 px-4 py-3">
              <h2 className="font-semibold text-gray-900">{list[0].routeName}</h2>
              <p className="text-sm text-gray-600">
                {list[0].driverName ?? <span className="text-red-700">Sem motorista</span>} · {done} de {list.length} paradas · {fmtL(liters)}
              </p>
            </div>
            <ol className="divide-y divide-gray-100">
              {list.map((s) => (
                <li key={s.pointId} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                  <span className="text-gray-800"><span className="text-gray-400">{s.position + 1}.</span> {s.pointName}</span>
                  <span className="flex items-center gap-2 text-sm">
                    {s.status === 'coletado' && <span className="font-semibold text-gray-900">{fmtL(s.liters ?? 0)}</span>}
                    {s.skipReason && <span className="text-red-800">{s.skipReason}</span>}
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[s.status].style}`}>{STATUS[s.status].label}</span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )
      })}
    </div>
  )
}
