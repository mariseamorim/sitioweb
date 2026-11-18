'use client'

// Diagnóstico de gestação em lote: todas as coberturas ainda sem resposta, com dois botões grandes por animal.
// Cada toque grava na hora (PUT /api/reproducao/{id}); "desfazer" volta para Coberta com o parto previsto de antes.
// Sem internet usa a cópia das coberturas guardada no aparelho (a mesma da tela de Reprodução) e põe o diagnóstico
// na fila do módulo, que é enviada quando a conexão volta.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { BackLink } from '@/components/BackLink'
import { useUser } from '@/contexts/UserContext'
import { cachedGet, HttpError, pendingOf, sendOrQueue, withPending } from '@/lib/offlineData'
import { useOfflineModule } from '@/lib/useOffline'
import { useT } from '@/lib/i18n'

interface Coverage {
  id: string
  status: string
  coverageDate: string
  expectedBirthDate: string | null
  maleName: string | null
  method: string | null
  female: { name: string; code: string; customCode?: string | null; species: string }
}

type Answer = 'Prenha' | 'Vazia'
const DAY = 24 * 60 * 60 * 1000
const daysSince = (iso: string) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY))
/** Antes disso o toque ou o ultrassom ainda não confirmam a gestação */
const MIN_DAYS = 28
const MODULE = 'reproducao'

export default function DiagnosticoEmLotePage() {
  const { user } = useUser()
  const t = useT()
  const [rows, setRows] = useState<Coverage[] | null>(null)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [queued, setQueued] = useState(0)
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const farmId = user?.farmId
  // Envia a fila quando a internet volta. A lista não é recarregada: as já respondidas continuam na tela para desfazer
  const net = useOfflineModule(MODULE)

  const load = useCallback(async () => {
    if (!farmId) return
    try {
      const r = await cachedGet<Coverage[]>(`cache_reproducao_${farmId}`, `/api/reproducao?farmId=${farmId}`)
      // Diagnósticos ainda na fila entram por cima da cópia, para não pedir de novo o que já foi respondido
      const list = withPending(Array.isArray(r.data) ? r.data : [], pendingOf(MODULE, (p) => p.farmId === farmId))
      // Mais antigas primeiro: são as que já dá para diagnosticar
      setRows(list.filter((c) => c.status === 'Coberta').sort((a, b) => a.coverageDate.localeCompare(b.coverageDate)))
      setFromCache(r.fromCache)
    } catch (err) {
      setError(err instanceof HttpError ? err.message : 'Sem internet, e este aparelho ainda não guardou as coberturas desta propriedade. Abra a Reprodução uma vez com conexão.')
    }
  }, [farmId])
  useEffect(() => { void load() }, [load])

  async function save(row: Coverage, status: Answer | 'Coberta') {
    setError('')
    setSaving(row.id)
    try {
      const body = status === 'Coberta' ? { status, ...(row.expectedBirthDate ? { expectedBirthDate: row.expectedBirthDate.slice(0, 10) } : {}) } : { status }
      const r = await sendOrQueue(MODULE, { type: 'update', id: row.id, url: `/api/reproducao/${row.id}`, method: 'PUT', body, local: { farmId } })
      if (r.status === 'rejected') return setError(r.error)
      if (r.status === 'queued') { setQueued((n) => n + 1); net.refresh() }
      setAnswers((current) => {
        const next = { ...current }
        if (status === 'Coberta') delete next[row.id]; else next[row.id] = status
        return next
      })
    } finally {
      setSaving(null)
    }
  }

  const done = Object.keys(answers).length
  const pregnant = useMemo(() => Object.values(answers).filter((a) => a === 'Prenha').length, [answers])

  return (
    <div className="max-w-2xl">
      <BackLink href="/reproducao" className="mb-2 -ml-2" />
      <div className="flex items-start justify-between gap-3 mb-1">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('Diagnóstico em lote')}</h1>
          <p className="text-gray-500">{user?.farmName} · {t('coberturas sem diagnóstico de gestação')}</p>
        </div>
        {rows && rows.length > 0 && <span className="shrink-0 rounded-full bg-gray-900 px-3 py-1 text-sm font-semibold text-white" aria-label={t('{done} de {total} diagnosticadas', { done, total: rows.length })}>{done}/{rows.length}</span>}
      </div>
      {done > 0 && <p role="status" className="text-sm text-gray-600 mb-3">{t(pregnant === 1 ? '{n} prenha' : '{n} prenhas', { n: pregnant })} · {t(done - pregnant === 1 ? '{n} vazia' : '{n} vazias', { n: done - pregnant })}</p>}
      {(fromCache || !net.online || queued > 0) && <p role="status" className="mb-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">{t(net.online && !fromCache ? 'Sinal fraco.' : 'Sem internet: mostrando as coberturas guardadas neste aparelho.')} {t('O que você marcar fica salvo no aparelho e é enviado quando a conexão voltar.')}</p>}
      {error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{t(error)}</p>}

      {rows === null && !error && <p className="py-12 text-center text-gray-500">{t('Carregando…')}</p>}
      {rows?.length === 0 && <p className="mt-4 bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500">{t('Nenhuma cobertura aguardando diagnóstico nesta propriedade.')}</p>}

      <ul className="mt-3 flex flex-col gap-3">
        {rows?.map((row) => {
          const answer = answers[row.id]
          const days = daysSince(row.coverageDate)
          const tone = answer === 'Prenha' ? 'border-green-300 bg-green-50' : answer === 'Vazia' ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'
          return (
            <li key={row.id} className={`rounded-xl border p-4 ${tone}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{row.female.name} <span className="font-normal text-gray-500">({row.female.customCode || row.female.code})</span></p>
                  <p className="text-sm text-gray-600">
                    {t(row.method === 'ia' ? (days === 1 ? 'Inseminada há {n} dia' : 'Inseminada há {n} dias') : (days === 1 ? 'Coberta há {n} dia' : 'Coberta há {n} dias'), { n: days })}{row.maleName ? ` · ${row.maleName}` : ''}
                    {!answer && days < MIN_DAYS ? ` · ${t('cedo para diagnosticar')}` : ''}
                  </p>
                  {answer && <p className={`mt-0.5 text-sm font-semibold ${answer === 'Prenha' ? 'text-green-800' : 'text-red-800'}`}>{answer === 'Prenha' ? `✓ ${t('Prenha')}` : `✓ ${t('Vazia')} · ${t('liberada para nova cobertura')}`}</p>}
                </div>
                {answer && canEdit && <button type="button" disabled={saving === row.id} onClick={() => save(row, 'Coberta')} className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 underline hover:bg-white/60">{t('desfazer')}</button>}
              </div>
              {!answer && canEdit && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <button type="button" disabled={saving === row.id} onClick={() => save(row, 'Prenha')} className="rounded-lg bg-green-700 py-3 text-base font-semibold text-white hover:bg-green-600 disabled:opacity-60">✓ {t('Prenha')}</button>
                  <button type="button" disabled={saving === row.id} onClick={() => save(row, 'Vazia')} className="rounded-lg bg-red-700 py-3 text-base font-semibold text-white hover:bg-red-600 disabled:opacity-60">✕ {t('Vazia')}</button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
