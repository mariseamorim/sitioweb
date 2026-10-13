'use client'

import { type DairyPanel, fmtDay, fmtL } from './types'

export function PeriodPicker({ period, onPeriod }: { period: { from: string; to: string }; onPeriod: (p: { from: string; to: string }) => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-end gap-3">
      <label className="text-sm font-medium text-gray-700">De
        <input type="date" value={period.from} max={period.to} onChange={(e) => e.target.value && onPeriod({ ...period, from: e.target.value })}
          className="mt-1 block border border-gray-300 rounded-lg px-3 py-2 text-base" />
      </label>
      <label className="text-sm font-medium text-gray-700">Até
        <input type="date" value={period.to} min={period.from} onChange={(e) => e.target.value && onPeriod({ ...period, to: e.target.value })}
          className="mt-1 block border border-gray-300 rounded-lg px-3 py-2 text-base" />
      </label>
    </div>
  )
}

function Totals({ title, rows }: { title: string; rows: [string, number][] }) {
  const sorted = [...rows].sort((a, b) => b[1] - a[1])
  const total = rows.reduce((s, [, l]) => s + l, 0)
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <h2 className="border-b border-gray-100 px-4 py-3 font-semibold text-gray-900">{title}</h2>
      {sorted.length === 0 ? <p className="px-4 py-3 text-sm text-gray-500">Nenhuma coleta.</p> : (
        <ul className="divide-y divide-gray-100">
          {sorted.map(([name, liters]) => (
            <li key={name} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <span className="text-gray-800">{name}</span>
              <span className="flex items-center gap-2">
                <span className="hidden h-2 rounded-full bg-green-600 sm:block" style={{ width: `${total ? Math.max(4, (liters / total) * 120) : 0}px` }} />
                <span className="font-semibold text-gray-900">{fmtL(liters)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// Painel: litros coletados por dia, rota, motorista e produtor (ponto de coleta)
export function CollectionsSection({ panel, period, onPeriod }: { panel: DairyPanel; period: { from: string; to: string }; onPeriod: (p: { from: string; to: string }) => void }) {
  const pointName = new Map(panel.points.map((p) => [p.id, p.name]))
  const routeOf = new Map<string, string>()
  for (const r of panel.routes) for (const s of r.stops) if (!routeOf.has(s.pointId)) routeOf.set(s.pointId, r.name)

  const sum = (key: (e: DairyPanel['entries'][number]) => string) => {
    const map = new Map<string, number>()
    for (const e of panel.entries) if (!e.skipReason) map.set(key(e), (map.get(key(e)) ?? 0) + e.liters)
    return [...map.entries()]
  }
  const byDay = sum((e) => e.date).sort((a, b) => b[0].localeCompare(a[0])).map(([d, l]) => [fmtDay(d), l] as [string, number])
  const skips = panel.entries.filter((e) => e.skipReason)
  const total = panel.entries.reduce((s, e) => s + (e.skipReason ? 0 : e.liters), 0)

  return (
    <div>
      <PeriodPicker period={period} onPeriod={onPeriod} />
      <p className="mb-4 text-sm text-gray-600">
        <strong className="text-lg text-gray-900">{fmtL(total)}</strong> coletados de {fmtDay(panel.period.from)} a {fmtDay(panel.period.to)}
        {' '}· produção, coleta e recebimento são registros separados.
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-gray-200 bg-white">
          <h2 className="border-b border-gray-100 px-4 py-3 font-semibold text-gray-900">Por dia</h2>
          {byDay.length === 0 ? <p className="px-4 py-3 text-sm text-gray-500">Nenhuma coleta.</p> : (
            <ul className="divide-y divide-gray-100">
              {byDay.map(([day, liters]) => (
                <li key={day} className="flex justify-between px-4 py-2 text-sm"><span>{day}</span><span className="font-semibold">{fmtL(liters)}</span></li>
              ))}
            </ul>
          )}
        </section>
        <Totals title="Por rota" rows={sum((e) => routeOf.get(e.pointId) ?? 'Fora de rota')} />
        <Totals title="Por motorista" rows={sum((e) => e.collectedBy?.name ?? 'Sem motorista')} />
        <Totals title="Por produtor (ponto de coleta)" rows={sum((e) => pointName.get(e.pointId) ?? '—')} />
      </div>

      {skips.length > 0 && (
        <section className="mt-4 rounded-xl border border-red-200 bg-white">
          <h2 className="border-b border-red-100 px-4 py-3 font-semibold text-red-800">Coletas não realizadas</h2>
          <ul className="divide-y divide-gray-100">
            {skips.map((e) => (
              <li key={`${e.pointId}|${e.date}`} className="flex flex-wrap justify-between gap-2 px-4 py-2 text-sm">
                <span>{fmtDay(e.date)} · {pointName.get(e.pointId) ?? '—'}{e.collectedBy && ` · ${e.collectedBy.name}`}</span>
                <span className="font-semibold text-red-800">{e.skipReason}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
