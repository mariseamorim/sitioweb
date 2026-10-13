'use client'

import { useState } from 'react'
import type { LitePoint } from '@/lib/lite'
import { SKIP_REASONS } from '@/lib/organizations'

// Parada da rota do laticínio no Anota Aí Leite: contato, como chegar e "não coletado" com motivo
export function RouteStopInfo({ point, skipReason, canWrite, hasLiters, onSkip }: {
  point: LitePoint
  skipReason: string | null
  canWrite: boolean
  hasLiters: boolean
  onSkip: (reason: string | null) => void
}) {
  const [choosing, setChoosing] = useState(false)
  const tel = point.phone?.replace(/[^\d+]/g, '')

  return (
    <div className="mt-2 space-y-1 border-t border-gray-100 pt-2 text-sm text-gray-600">
      {(point.contactName || point.phone) && (
        <p>
          {point.contactName}
          {point.phone && <> · <a href={`tel:${tel}`} className="font-semibold text-green-700 underline">{point.phone}</a></>}
        </p>
      )}
      {point.address && <p>{point.address}</p>}
      {point.accessNotes && <p className="rounded-lg bg-amber-50 px-2 py-1 text-amber-900">Acesso: {point.accessNotes}</p>}

      {skipReason ? (
        <p className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 font-semibold text-red-800">
          Não coletado: {skipReason}
          {canWrite && <button type="button" onClick={() => onSkip(null)} className="font-semibold text-red-700 underline">Desfazer</button>}
        </p>
      ) : canWrite && !hasLiters && (
        choosing ? (
          <div className="rounded-lg border border-gray-200 p-2">
            <p className="mb-1 font-medium text-gray-700">Por que não coletou?</p>
            <div className="flex flex-wrap gap-2">
              {SKIP_REASONS.map((reason) => (
                <button key={reason} type="button" onClick={() => { setChoosing(false); onSkip(reason) }}
                  className="rounded-full border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  {reason}
                </button>
              ))}
              <button type="button" onClick={() => setChoosing(false)} className="px-2 py-1.5 text-sm text-gray-500 underline">Cancelar</button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setChoosing(true)} className="text-sm font-semibold text-gray-600 underline">Não coletado</button>
        )
      )}
    </div>
  )
}
