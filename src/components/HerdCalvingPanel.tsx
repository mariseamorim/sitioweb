'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { herdCalving, LATE_MONTHS, plural, type CowLike, type PregnancyCheck } from '@/lib/calving'
import { useLocale, useT } from '@/lib/i18n'
import { StatTile, type Accent } from '@/components/StatTile'

const fmtDay = (d: string | Date, locale = 'pt-BR') => new Date(d).toLocaleDateString(locale, { timeZone: 'UTC' })
type Tr = (text: string, vars?: Record<string, string | number>) => string
/** "3 meses" no idioma da tela (monthsLabel de lib/calving é só português) */
const monthsText = (n: number, t: Tr) => (n < 1 ? t('menos de 1 mês') : plural(n, t('mês'), t('meses')))

// "Confirmar prenhez": vacas que pariram há 2 meses ou mais e ainda não têm prenha/vazia anotada
export function PregnancyCheckPanel({ checks, canEdit, onAnswer }: {
  checks: PregnancyCheck[]
  canEdit: boolean
  onAnswer: (check: PregnancyCheck, answer: 'Prenha' | 'Vazia') => Promise<void>
}) {
  const t = useT()
  const locale = useLocale()
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
    <section ref={ref} id="confirmar-prenhez" className="mb-6 scroll-mt-24 rounded-xl border border-amber-300 bg-amber-50 p-4" aria-label={t('Confirmar prenhez')}>
      <h2 className="text-base font-semibold text-amber-900">{t('Confirmar prenhez')}</h2>
      <p className="text-sm text-amber-900">{t('Vacas que pariram há 2 meses ou mais. Ela está prenha de novo?')}</p>
      <ul className="mt-3 space-y-2">
        {checks.map((c) => (
          <li key={c.cow.id} className="rounded-xl border border-amber-200 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <Link href={`/animais?animal=${c.cow.id}`} className="font-semibold text-gray-900 underline-offset-2 hover:underline">{c.cow.name}</Link>
                <span className="text-sm text-gray-500"> ({c.cow.code})</span>
                <p className="text-sm text-gray-600">
                  {t('Pariu em {date}, há {months}', { date: fmtDay(c.lastCalving, locale), months: monthsText(Math.floor(c.daysSince / 30.44), t) })}
                  {c.openCoverage && ` · ${t('coberta em {date}', { date: fmtDay(c.openCoverage.coverageDate, locale) })}`}
                </p>
              </div>
              {canEdit && (
                <div className="flex gap-2">
                  <button type="button" disabled={busy === c.cow.id} onClick={() => answer(c, 'Prenha')}
                    className="rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-gray-300">{t('Prenha')}</button>
                  <button type="button" disabled={busy === c.cow.id} onClick={() => answer(c, 'Vazia')}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:text-gray-300">{t('Vazia')}</button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!canEdit && <p className="mt-2 text-xs text-amber-900">{t('Para confirmar é preciso internet e permissão de edição.')}</p>}
    </section>
  )
}

interface OpenReproduction { femaleId: string; status: string; actualBirthDate?: string | null }

// Painel da Reprodução: intervalo entre partos do rebanho, idade na primeira cria e vacas demorando para criar
export function HerdCalvingPanel({ herd, reproductions }: { herd: CowLike[]; reproductions: OpenReproduction[] }) {
  const t = useT()
  const [showNoCalf, setShowNoCalf] = useState(false)
  const pregnant = new Set(reproductions.filter((r) => !r.actualBirthDate && (r.status === 'Coberta' || r.status === 'Prenha')).map((r) => r.femaleId))
  const stats = herdCalving(herd, pregnant)
  if (stats.cows.length === 0) return null

  const late = stats.late.filter((l) => l.reason === 'sem-parir')
  const noCalf = stats.late.filter((l) => l.reason === 'sem-cria')
  // Cartões coloridos: médias em azul e verde-água; vacas atrasadas em laranja (verde quando não há nenhuma)
  const cards: [string, string, Accent, string?][] = [
    [t('Intervalo médio entre partos'), stats.averageInterval !== null ? monthsText(stats.averageInterval, t) : '—', 'blue', stats.averageInterval === null ? t('Anote pelo menos 2 crias de uma vaca') : undefined],
    [t('Idade média na 1ª cria'), stats.averageAgeAtFirst !== null ? monthsText(stats.averageAgeAtFirst, t) : '—', 'teal'],
    [t('Vacas demorando para criar'), String(late.length), late.length > 0 ? 'amber' : 'green', t('Mais de {n} meses sem parir e sem prenhez anotada', { n: LATE_MONTHS })],
  ]

  return (
    <section className="mb-6" aria-label={t('Partos do rebanho')}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {cards.map(([label, value, accent, hint]) => (
          <StatTile key={label} accent={accent} label={label} value={value} detail={hint} />
        ))}
      </div>

      {late.length > 0 && (
        <ul className="mt-3 overflow-hidden rounded-xl border border-amber-200 bg-white divide-y divide-gray-100">
          {late.map(({ stats: s }) => (
            <li key={s.cow.id} className="relative">
              {/* Faixa laranja à esquerda: vaca atrasada para criar */}
              <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-amber-500" />
              <Link href={`/animais?animal=${s.cow.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-gray-50">
                <span className="min-w-0">
                  <span className="block font-medium text-gray-900">{s.cow.name} <span className="text-sm font-normal text-gray-500">({s.cow.code})</span></span>
                  <span className="block text-sm text-gray-600">
                    {plural(s.calves, t('cria'), t('crias'))}{s.averageInterval !== null ? ` · ${t('costuma criar a cada {months}', { months: monthsText(s.averageInterval, t) })}` : ''}
                  </span>
                </span>
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">{t('{months} sem parir', { months: monthsText(s.monthsSinceLast ?? 0, t) })}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {noCalf.length > 0 && (
        <div className="mt-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
          <button type="button" onClick={() => setShowNoCalf(!showNoCalf)} aria-expanded={showNoCalf} className="w-full text-left text-sm text-gray-700">
            <span className="font-semibold">{plural(noCalf.length, t('vaca adulta'), t('vacas adultas'))} {t('sem nenhuma cria anotada')}</span>
            <span className="text-green-700 underline ml-2">{t(showNoCalf ? 'Esconder' : 'Ver')}</span>
          </button>
          {showNoCalf && (
            <>
              <p className="mt-1 text-xs text-gray-500">{t('Se ela já criou, anote as crias antigas na ficha dela para o intervalo sair certo.')}</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {noCalf.map(({ stats: s }) => (
                  <li key={s.cow.id}>
                    <Link href={`/animais?animal=${s.cow.id}`} className="inline-block rounded-full border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                      {s.cow.name} · {monthsText(s.ageMonths, t)}
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
