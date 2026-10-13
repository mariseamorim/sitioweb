'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { herdCalving, LATE_MONTHS, monthsLabel, plural, type CowLike, type PregnancyCheck } from '@/lib/calving'

const fmtDay = (d: string | Date) => new Date(d).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

// "Confirmar prenhez": vacas que pariram há 2 meses ou mais e ainda não têm prenha/vazia anotada
export function PregnancyCheckPanel({ checks, canEdit, onAnswer }: {
  checks: PregnancyCheck[]
  canEdit: boolean
  onAnswer: (check: PregnancyCheck, answer: 'Prenha' | 'Vazia') => Promise<void>
}) {
  const ref = useRef<HTMLElement>(null)
  const [busy, setBusy] = useState('')
  // Vindo do sino (#confirmar-prenhez): rola até o painel
  useEffect(() => {
    if (window.location.hash === '#confirmar-prenhez') ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])
  if (checks.length === 0) return null

  async function answer(check: PregnancyCheck, value: 'Prenha' | 'Vazia') {
    setBusy(check.cow.id)
    try { await onAnswer(check, value) } finally { setBusy('') }
  }

  return (
    <section ref={ref} id="confirmar-prenhez" className="mb-6 scroll-mt-24 rounded-xl border border-amber-300 bg-amber-50 p-4" aria-label="Confirmar prenhez">
      <h2 className="text-base font-semibold text-amber-900">Confirmar prenhez</h2>
      <p className="text-sm text-amber-900">Vacas que pariram há 2 meses ou mais. Ela está prenha de novo?</p>
      <ul className="mt-3 space-y-2">
        {checks.map((c) => (
          <li key={c.cow.id} className="rounded-xl border border-amber-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/animais?animal=${c.cow.id}`} className="font-semibold text-gray-900 underline-offset-2 hover:underline">{c.cow.name}</Link>
                <span className="text-sm text-gray-500"> ({c.cow.code})</span>
                <p className="text-sm text-gray-600">
                  Pariu em {fmtDay(c.lastCalving)}, há {monthsLabel(Math.floor(c.daysSince / 30.44))}
                  {c.openCoverage && ` · coberta em ${fmtDay(c.openCoverage.coverageDate)}`}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button type="button" disabled={busy === c.cow.id} onClick={() => answer(c, 'Prenha')}
                    className="rounded-lg bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:bg-gray-300">Prenha</button>
                  <button type="button" disabled={busy === c.cow.id} onClick={() => answer(c, 'Vazia')}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:text-gray-300">Vazia</button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!canEdit && <p className="mt-2 text-xs text-amber-900">Para confirmar é preciso internet e permissão de edição.</p>}
    </section>
  )
}

interface OpenReproduction { femaleId: string; status: string; actualBirthDate?: string | null }

// Painel da Reprodução: intervalo entre partos do rebanho, idade na primeira cria e vacas demorando para criar
export function HerdCalvingPanel({ herd, reproductions }: { herd: CowLike[]; reproductions: OpenReproduction[] }) {
  const [showNoCalf, setShowNoCalf] = useState(false)
  const pregnant = new Set(reproductions.filter((r) => !r.actualBirthDate && (r.status === 'Coberta' || r.status === 'Prenha')).map((r) => r.femaleId))
  const stats = herdCalving(herd, pregnant)
  if (stats.cows.length === 0) return null

  const late = stats.late.filter((l) => l.reason === 'sem-parir')
  const noCalf = stats.late.filter((l) => l.reason === 'sem-cria')
  const cards: [string, string, string?][] = [
    ['Intervalo médio entre partos', stats.averageInterval !== null ? monthsLabel(stats.averageInterval) : '—', stats.averageInterval === null ? 'Anote pelo menos 2 crias de uma vaca' : undefined],
    ['Idade média na 1ª cria', stats.averageAgeAtFirst !== null ? monthsLabel(stats.averageAgeAtFirst) : '—'],
    ['Vacas demorando para criar', String(late.length), `Mais de ${LATE_MONTHS} meses sem parir e sem prenhez anotada`],
  ]

  return (
    <section className="mb-6" aria-label="Partos do rebanho">
      {/* Lado a lado também no celular, para não empurrar a lista para baixo */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {cards.map(([label, value, hint], i) => (
          <div key={label} className={`rounded-xl border p-3 sm:p-4 ${i === 2 && late.length > 0 ? 'border-amber-300 bg-amber-50' : 'border-gray-200 bg-white'}`}>
            <p className="text-xs sm:text-sm text-gray-500">{label}</p>
            <p className={`mt-1 text-lg sm:text-2xl font-bold ${i === 2 && late.length > 0 ? 'text-amber-800' : 'text-gray-900'}`}>{value}</p>
            {hint && <p className="mt-1 hidden sm:block text-xs text-gray-500">{hint}</p>}
          </div>
        ))}
      </div>

      {late.length > 0 && (
        <ul className="mt-3 rounded-xl border border-amber-200 bg-white divide-y divide-gray-100">
          {late.map(({ stats: s }) => (
            <li key={s.cow.id}>
              <Link href={`/animais?animal=${s.cow.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                <span className="min-w-0">
                  <span className="block font-medium text-gray-900">{s.cow.name} <span className="text-sm font-normal text-gray-500">({s.cow.code})</span></span>
                  <span className="block text-sm text-gray-600">
                    {plural(s.calves, 'cria', 'crias')}{s.averageInterval !== null ? ` · costuma criar a cada ${monthsLabel(s.averageInterval)}` : ''}
                  </span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-amber-800">{monthsLabel(s.monthsSinceLast ?? 0)} sem parir</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {noCalf.length > 0 && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
          <button type="button" onClick={() => setShowNoCalf(!showNoCalf)} aria-expanded={showNoCalf} className="w-full text-left text-sm text-gray-700">
            <span className="font-semibold">{plural(noCalf.length, 'vaca adulta', 'vacas adultas')} sem nenhuma cria anotada</span>
            <span className="text-green-700 underline ml-2">{showNoCalf ? 'Esconder' : 'Ver'}</span>
          </button>
          {showNoCalf && (
            <>
              <p className="mt-1 text-xs text-gray-500">Se ela já criou, anote as crias antigas na ficha dela para o intervalo sair certo.</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {noCalf.map(({ stats: s }) => (
                  <li key={s.cow.id}>
                    <Link href={`/animais?animal=${s.cow.id}`} className="inline-block rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                      {s.cow.name} · {monthsLabel(s.ageMonths)}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  )
}
