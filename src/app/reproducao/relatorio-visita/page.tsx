'use client'

// Relatório de visita da propriedade aberta: o que foi feito no dia e os próximos manejos (secagens, pré-partos, partos,
// diagnósticos e vacinas), numa folha para imprimir ou enviar ao produtor. O veterinário anota as recomendações,
// que ficam guardadas na visita do dia.
import { useCallback, useEffect, useState } from 'react'
import { BackLink } from '@/components/BackLink'
import { useUser } from '@/contexts/UserContext'
import { todayISO } from '@/lib/utils'

interface Named { animal: string; code: string }
interface Report {
  date: string
  farm: { name: string; owner: string | null; city: string | null; state: string | null } | null
  vet: { name: string; crmv: string | null; phone: string | null } | null
  visit: { id: string; purpose: string | null; notes: string | null } | null
  done: {
    diagnoses: (Named & { result: string; expectedBirthDate: string | null })[]
    coverages: (Named & { method: string | null; maleName: string | null })[]
    vaccines: (Named & { vaccine: string })[]
    treatments: (Named & { medicine: string; milkWithdrawalDays: number | null })[]
  }
  upcoming: (Named & { type: 'secagem' | 'pre-parto' | 'parto'; date: string })[]
  toDiagnose: (Named & { coverageDate: string; days: number })[]
  vaccinesDue: (Named & { vaccine: string; date: string; late: boolean })[]
}

const day = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
const cow = (n: Named) => `${n.animal} (${n.code})`
const TYPE = { secagem: 'Secar', 'pre-parto': 'Pré-parto', parto: 'Parto previsto' } as const
const h2 = 'mt-6 mb-2 border-b border-gray-300 pb-1 text-base font-bold text-gray-900'

export default function RelatorioVisitaPage() {
  const { user } = useUser()
  const [date, setDate] = useState(todayISO())
  const [report, setReport] = useState<Report | null>(null)
  const [notes, setNotes] = useState('')
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const farmId = user?.farmId

  const load = useCallback(async () => {
    if (!farmId) return
    try {
      const res = await fetch(`/api/reproducao/relatorio-visita?data=${date}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || 'Não foi possível montar o relatório.')
      setError('')
      setReport(data)
      setNotes(data.visit?.notes ?? '')
      setSaved('')
    } catch {
      setError('Sem internet. O relatório de visita precisa de conexão.')
    }
  }, [date, farmId])
  useEffect(() => { void Promise.resolve().then(load) }, [load])

  async function saveNotes() {
    setSaved('')
    try {
      const res = await fetch('/api/reproducao/relatorio-visita', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, notes }) })
      if (!res.ok) return setError((await res.json().catch(() => ({}))).error || 'Não foi possível guardar as recomendações.')
      setSaved('Recomendações guardadas.')
    } catch {
      setError('Sem internet: as recomendações não foram guardadas.')
    }
  }

  /** Resumo em texto, para mandar pelo WhatsApp */
  function summary(r: Report) {
    const pregnant = r.done.diagnoses.filter((d) => d.result === 'Prenha')
    const empty = r.done.diagnoses.filter((d) => d.result === 'Vazia')
    const lines = [`*Relatório de visita — ${r.farm?.name ?? ''}*`, `${day(r.date)}${r.vet ? ` · ${r.vet.name}` : ''}`, '']
    if (r.done.diagnoses.length) lines.push(`Diagnóstico de gestação: ${pregnant.length} ${pregnant.length === 1 ? 'prenha' : 'prenhas'}, ${empty.length} ${empty.length === 1 ? 'vazia' : 'vazias'}`)
    if (empty.length) lines.push(`Vazias (cobrir de novo): ${empty.map(cow).join(', ')}`)
    if (r.done.coverages.length) lines.push(`Coberturas/inseminações: ${r.done.coverages.map(cow).join(', ')}`)
    if (r.done.vaccines.length) lines.push(`Vacinas aplicadas: ${r.done.vaccines.length}`)
    if (r.done.treatments.length) lines.push(`Tratamentos: ${r.done.treatments.map((t) => `${cow(t)} — ${t.medicine}`).join('; ')}`)
    if (r.upcoming.length) lines.push('', '*Próximos manejos*', ...r.upcoming.map((u) => `${day(u.date)} · ${TYPE[u.type]}: ${cow(u)}`))
    if (r.toDiagnose.length) lines.push('', `*A diagnosticar na próxima visita:* ${r.toDiagnose.map(cow).join(', ')}`)
    if (notes.trim()) lines.push('', '*Recomendações*', notes.trim())
    return lines.join('\n')
  }

  const nothingDone = report && !report.done.diagnoses.length && !report.done.coverages.length && !report.done.vaccines.length && !report.done.treatments.length

  return (
    <div className="max-w-3xl">
      <BackLink href={user?.vet ? '/consultoria' : '/reproducao'} className="mb-2 -ml-2" />
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Relatório de visita</h1>
          <p className="text-gray-500">{user?.farmName}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm font-medium text-gray-700">Dia da visita
            <input type="date" value={date} max={todayISO()} onChange={(e) => e.target.value && setDate(e.target.value)} className="mt-1 block rounded-lg border border-gray-300 px-3 py-2 text-base" />
          </label>
          {report && <button type="button" onClick={() => window.print()} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600">Imprimir</button>}
          {report && <a href={`https://wa.me/?text=${encodeURIComponent(summary(report))}`} target="_blank" rel="noreferrer" className="rounded-lg border border-green-700 px-4 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-50">Enviar pelo WhatsApp</a>}
        </div>
      </div>
      {error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {!report && !error && <p className="py-12 text-center text-gray-500">Carregando…</p>}

      {report && (
        <article className="print-area bg-white rounded-xl border border-gray-200 p-5 sm:p-8 text-gray-900">
          <header className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-gray-900 pb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-600">Relatório de visita</p>
              <p className="text-xl font-bold">{report.farm?.name}</p>
              <p className="text-sm text-gray-700">{[report.farm?.owner, [report.farm?.city, report.farm?.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ')}</p>
            </div>
            <div className="text-right text-sm text-gray-700">
              <p className="font-semibold text-gray-900">{day(report.date)}</p>
              {report.vet && <p>{report.vet.name}{report.vet.crmv ? ` · CRMV ${report.vet.crmv}` : ''}</p>}
              {report.vet?.phone && <p>{report.vet.phone}</p>}
            </div>
          </header>

          <h2 className={h2}>Feito na visita</h2>
          {nothingDone && <p className="text-sm text-gray-600">Nenhum lançamento com a data deste dia.</p>}
          {report.done.diagnoses.length > 0 && (
            <>
              <p className="text-sm font-semibold">Diagnóstico de gestação: {report.done.diagnoses.filter((d) => d.result === 'Prenha').length} prenhas, {report.done.diagnoses.filter((d) => d.result === 'Vazia').length} vazias</p>
              <table className="mt-1 mb-3 w-full text-left text-sm">
                <thead><tr><th scope="col" className="border-b border-gray-200 py-1 pr-3 font-medium text-gray-600">Animal</th><th scope="col" className="border-b border-gray-200 py-1 pr-3 font-medium text-gray-600">Resultado</th><th scope="col" className="border-b border-gray-200 py-1 font-medium text-gray-600">Parto previsto</th></tr></thead>
                <tbody>{report.done.diagnoses.map((d, i) => <tr key={i}><td className="border-b border-gray-100 py-1 pr-3">{cow(d)}</td><td className="border-b border-gray-100 py-1 pr-3 font-semibold">{d.result}</td><td className="border-b border-gray-100 py-1">{d.expectedBirthDate ? day(d.expectedBirthDate) : d.result === 'Vazia' ? 'cobrir de novo' : '—'}</td></tr>)}</tbody>
              </table>
            </>
          )}
          {report.done.coverages.length > 0 && <p className="mb-2 text-sm"><span className="font-semibold">Coberturas e inseminações:</span> {report.done.coverages.map((c) => `${cow(c)}${c.maleName ? ` — ${c.maleName}` : ''}`).join('; ')}</p>}
          {report.done.vaccines.length > 0 && <p className="mb-2 text-sm"><span className="font-semibold">Vacinas aplicadas:</span> {report.done.vaccines.map((v) => `${cow(v)} — ${v.vaccine}`).join('; ')}</p>}
          {report.done.treatments.length > 0 && <p className="mb-2 text-sm"><span className="font-semibold">Tratamentos iniciados:</span> {report.done.treatments.map((t) => `${cow(t)} — ${t.medicine}${t.milkWithdrawalDays ? ` (carência do leite: ${t.milkWithdrawalDays} dias)` : ''}`).join('; ')}</p>}

          <h2 className={h2}>Próximos manejos (45 dias)</h2>
          {report.upcoming.length === 0 ? <p className="text-sm text-gray-600">Nenhuma secagem, pré-parto ou parto previsto no período.</p> : (
            <table className="w-full text-left text-sm">
              <thead><tr><th scope="col" className="border-b border-gray-200 py-1 pr-3 font-medium text-gray-600">Data</th><th scope="col" className="border-b border-gray-200 py-1 pr-3 font-medium text-gray-600">Manejo</th><th scope="col" className="border-b border-gray-200 py-1 font-medium text-gray-600">Animal</th></tr></thead>
              <tbody>{report.upcoming.map((u, i) => <tr key={i}><td className="border-b border-gray-100 py-1 pr-3 whitespace-nowrap">{day(u.date)}</td><td className="border-b border-gray-100 py-1 pr-3 font-semibold">{TYPE[u.type]}</td><td className="border-b border-gray-100 py-1">{cow(u)}</td></tr>)}</tbody>
            </table>
          )}

          {report.toDiagnose.length > 0 && (
            <>
              <h2 className={h2}>A diagnosticar</h2>
              <p className="text-sm">{report.toDiagnose.map((t) => `${cow(t)} — coberta há ${t.days} dias`).join('; ')}</p>
            </>
          )}
          {report.vaccinesDue.length > 0 && (
            <>
              <h2 className={h2}>Vacinas a aplicar</h2>
              <p className="text-sm">{report.vaccinesDue.map((v) => `${day(v.date)}${v.late ? ' (atrasada)' : ''} · ${cow(v)} — ${v.vaccine}`).join('; ')}</p>
            </>
          )}

          <h2 className={h2}>Recomendações</h2>
          {user?.vet ? (
            <>
              <textarea value={notes} onChange={(e) => { setNotes(e.target.value); setSaved('') }} rows={5} aria-label="Recomendações para o produtor" placeholder="O que o produtor deve fazer até a próxima visita" className="no-print w-full rounded-lg border border-gray-300 px-3 py-2 text-base" />
              <div className="no-print mt-2 flex items-center gap-3">
                <button type="button" onClick={saveNotes} className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-700">Guardar recomendações</button>
                {saved && <span role="status" className="text-sm text-green-800">{saved}</span>}
              </div>
              {/* Na folha impressa sai o texto, não a caixa de digitação */}
              <p className="hidden whitespace-pre-wrap text-sm print:block">{notes || '—'}</p>
            </>
          ) : <p className="whitespace-pre-wrap text-sm">{report.visit?.notes || '—'}</p>}

          <div className="mt-12 grid grid-cols-2 gap-8 text-center text-sm text-gray-700">
            <p className="border-t border-gray-500 pt-1">{report.vet?.name ?? 'Responsável pela visita'}</p>
            <p className="border-t border-gray-500 pt-1">{report.farm?.owner ?? 'Produtor'}</p>
          </div>
        </article>
      )}
    </div>
  )
}
