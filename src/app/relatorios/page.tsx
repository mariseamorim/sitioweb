'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { REPORT_TYPES, Report } from '@/lib/reports'
import { exportCSV, exportPDF } from '@/lib/reportExport'
import { todayISO } from '@/lib/utils'
import { cellSortValue, compareValues } from '@/lib/useSort'
import { HttpError, cachedGet } from '@/lib/offlineData'
import { loadHerd } from '@/lib/herdCache'
import { useT, type Vars } from '@/lib/i18n'

/**
 * O relatório vem do servidor em português: títulos, colunas e textos das células passam pelo dicionário
 * (o que não estiver nele fica como veio). A mesma cópia traduzida vai para o PDF e a planilha.
 */
function translateReport(report: Report, t: (text: string, vars?: Vars) => string): Report {
  const cell = <V,>(v: V): V => (typeof v === 'string' ? (t(v) as V) : v)
  const animalSheet = report.title.match(/^Ficha do animal: (.*)$/)
  const late = report.sections.map((s) => s.title?.match(/^Demorando para criar \(mais de (\d+) meses sem parir, sem prenhez anotada\)$/))
  return {
    ...report,
    title: animalSheet ? t('Ficha do animal: {animal}', { animal: animalSheet[1] }) : t(report.title),
    subtitle: report.subtitle.replace(/^(Emitido em|Posição em)/, (m) => t(m)),
    sections: report.sections.map((s, i) => ({
      ...s,
      title: s.title ? (late[i] ? t('Demorando para criar (mais de {n} meses sem parir, sem prenhez anotada)', { n: late[i]![1] }) : t(s.title)) : s.title,
      columns: s.columns.map((c) => t(c)),
      rows: s.rows.map((row) => row.map(cell)),
      ...(s.footer ? { footer: s.footer.map(cell) } : {}),
    })),
  }
}

type Preset = 'mes' | 'mes-passado' | 'ano' | 'outro'

function iso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function presetRange(preset: Exclude<Preset, 'outro'>): [string, string] {
  const now = new Date()
  if (preset === 'mes') return [iso(new Date(now.getFullYear(), now.getMonth(), 1)), todayISO()]
  if (preset === 'mes-passado') {
    return [iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), iso(new Date(now.getFullYear(), now.getMonth(), 0))]
  }
  return [iso(new Date(now.getFullYear(), 0, 1)), todayISO()]
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'mes', label: 'Este mês' },
  { key: 'mes-passado', label: 'Mês passado' },
  { key: 'ano', label: 'Este ano' },
  { key: 'outro', label: 'Outro período' },
]

export default function RelatoriosPage() {
  const t = useT()
  const { canAccess, loading: userLoading, user } = useUser()
  const farmId = user?.farmId ?? ''
  const types = useMemo(() => REPORT_TYPES.filter((rt) => canAccess(rt.module)), [canAccess])

  const [typeKey, setTypeKey] = useState('')
  const [preset, setPreset] = useState<Preset>('mes')
  const [[from, to], setRange] = useState<[string, string]>(presetRange('mes'))
  const [animals, setAnimals] = useState<{ id: string; code: string; name: string }[]>([])
  const [animalId, setAnimalId] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')
  // O relatório mostrado veio da cópia guardada no aparelho (sem internet ou sinal fraco)
  const [fromCache, setFromCache] = useState(false)

  const type = types.find((rt) => rt.key === typeKey)
  const shown = useMemo(() => (report ? translateReport(report, t) : null), [report, t])

  useEffect(() => {
    if (!type?.needsAnimal || animals.length || !farmId) return
    // Rebanho com cópia no aparelho: a lista de animais abre mesmo sem internet
    loadHerd<{ id: string; code: string; name: string }>(farmId)
      .then((r) => setAnimals(Array.isArray(r.data) ? r.data : []))
      .catch(() => setAnimals([]))
  }, [type, animals.length, farmId])

  function choosePreset(p: Preset) {
    setPreset(p)
    if (p !== 'outro') setRange(presetRange(p))
  }

  function chooseType(key: string) {
    setTypeKey(key)
    setReport(null)
    setError('')
  }

  async function generate() {
    if (!type) return
    setError('')
    setReport(null)
    setFromCache(false)
    const params = new URLSearchParams({ tipo: type.key })
    if (type.needsPeriod) { params.set('from', from); params.set('to', to) }
    if (type.needsAnimal) params.set('animalId', animalId)

    setLoading(true)
    try {
      // Cada relatório gerado fica guardado no aparelho por tipo e período: sem internet, abre o último gerado
      const r = await cachedGet<Report>(`cache_relatorio_${type.key}_${from}_${to}_${animalId}`, `/api/relatorios?${params}`)
      setReport(r.data)
      setFromCache(r.fromCache)
    } catch (err) {
      if (err instanceof HttpError) setError(t(err.message || 'Não foi possível gerar o relatório.'))
      else if (navigator.onLine) setError(t('Não foi possível gerar o relatório agora. Tente de novo em instantes.'))
      else setError(t('Os relatórios precisam de internet. Este período ainda não foi gerado neste aparelho; conecte-se e tente de novo.'))
    } finally {
      setLoading(false)
    }
  }

  async function handlePDF() {
    if (!shown) return
    setExporting(true)
    try { await exportPDF(shown) } finally { setExporting(false) }
  }

  const canGenerate = !!type && (!type.needsAnimal || !!animalId) && (!type.needsPeriod || (from && to && from <= to))

  if (userLoading) return <p className="text-gray-400 text-sm mt-8">{t('Carregando...')}</p>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{t('Relatórios')}</h1>
        <p className="text-gray-500 text-sm mt-1">{t('Escolha o relatório, veja na tela e baixe em PDF ou planilha.')}</p>
      </div>

      {types.length === 0 ? (
        <p className="text-gray-500">{t('Você não tem acesso a nenhum relatório. Peça ao administrador.')}</p>
      ) : (
        <>
          {/* 1. Tipo */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {types.map((rt) => (
              <button
                key={rt.key}
                type="button"
                onClick={() => chooseType(rt.key)}
                aria-pressed={typeKey === rt.key}
                className={`text-left rounded-xl border-2 p-4 transition-colors ${
                  typeKey === rt.key ? 'border-green-600 bg-green-50' : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <p className="text-base font-semibold text-gray-900">{t(rt.label)}</p>
                <p className="mt-1 text-sm text-gray-500 leading-snug">{t(rt.description)}</p>
              </button>
            ))}
          </div>

          {/* 2. Opções */}
          {type && (
            <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 flex flex-col gap-4">
              {type.needsPeriod && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">{t('Período')}</p>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => choosePreset(p.key)}
                        className={`px-4 py-2.5 rounded-lg text-sm font-medium border ${
                          preset === p.key ? 'bg-green-700 border-green-700 text-white' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {t(p.label)}
                      </button>
                    ))}
                  </div>
                  {preset === 'outro' && (
                    <div className="mt-3 grid grid-cols-2 gap-3 max-w-md">
                      <label className="text-sm text-gray-600">
                        {t('De')}
                        <input type="date" value={from} onChange={(e) => setRange([e.target.value, to])}
                          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                      </label>
                      <label className="text-sm text-gray-600">
                        {t('Até')}
                        <input type="date" value={to} onChange={(e) => setRange([from, e.target.value])}
                          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {type.needsAnimal && (
                <label className="text-sm font-medium text-gray-700 max-w-md">
                  {t('Animal')}
                  <select value={animalId} onChange={(e) => setAnimalId(e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-green-600">
                    <option value="">{t('— Selecione —')}</option>
                    {animals.map((a) => <option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}
                  </select>
                </label>
              )}

              <div>
                <button
                  type="button"
                  onClick={generate}
                  disabled={!canGenerate || loading}
                  className="w-full sm:w-auto bg-green-700 hover:bg-green-600 disabled:bg-gray-300 text-white text-base font-semibold px-6 py-3 rounded-lg"
                >
                  {t(loading ? 'Gerando...' : 'Ver relatório')}
                </button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {/* 3. Resultado */}
          {shown && fromCache && (
            <p role="status" className="mt-5 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              {t('Sem internet: este é o último relatório gerado neste aparelho para este período. Pode estar desatualizado.')}
            </p>
          )}
          {shown && (
            <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{shown.title}</h2>
                  <p className="text-sm text-gray-500">{shown.subtitle}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handlePDF} disabled={exporting}
                    className="flex-1 sm:flex-none bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
                    {t(exporting ? 'Gerando PDF...' : 'Baixar PDF')}
                  </button>
                  <button onClick={() => exportCSV(shown)}
                    className="flex-1 sm:flex-none border-2 border-green-700 text-green-700 hover:bg-green-50 text-sm font-semibold px-4 py-2 rounded-lg">
                    {t('Baixar planilha')}
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex flex-col gap-6">
                {shown.sections.map((section, i) => (
                  <div key={i}>
                    {section.title && <h3 className="text-sm font-semibold text-gray-700 mb-2">{section.title}</h3>}
                    <SortableReportTable section={section} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
// Tabela do relatório: tocar no título da coluna ordena (datas, números e valores em R$ entendidos)
function SortableReportTable({ section }: { section: Report['sections'][number] }) {
  const t = useT()
  const [sortCol, setSortCol] = useState<{ col: number; dir: 'asc' | 'desc' } | null>(null)
  const rows = useMemo(() => {
    if (!sortCol) return section.rows
    return section.rows
      .map((row, i) => ({ row, i }))
      .sort((a, b) => compareValues(cellSortValue(a.row[sortCol.col]), cellSortValue(b.row[sortCol.col]), sortCol.dir) || a.i - b.i)
      .map((x) => x.row)
  }, [section.rows, sortCol])
  const toggle = (col: number) => setSortCol((s) => (s?.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-100">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
          <tr>
            {section.columns.map((c, j) => {
              const right = section.numeric?.includes(j)
              const active = sortCol?.col === j
              return (
                <th key={j} aria-sort={active ? (sortCol.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  className={`px-3 py-2 whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}>
                  <button type="button" onClick={() => toggle(j)} title={t('Ordenar por {col}', { col: c.toLowerCase() })}
                    className={`inline-flex items-center gap-1 uppercase hover:text-gray-800 ${right ? 'flex-row-reverse' : ''} ${active ? 'text-gray-800' : ''}`}>
                    {c}
                    <span aria-hidden="true" className={`text-[10px] ${active ? '' : 'text-gray-300'}`}>{active ? (sortCol.dir === 'asc' ? '▲' : '▼') : '▲▼'}</span>
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr><td colSpan={section.columns.length} className="px-3 py-6 text-center text-gray-400">{t('Nenhum registro')}</td></tr>
          ) : rows.map((row, r) => (
            <tr key={r}>
              {row.map((v, j) => (
                <td key={j} className={`px-3 py-2 text-gray-700 ${section.numeric?.includes(j) ? 'text-right whitespace-nowrap' : ''}`}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {section.footer && (
          <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-semibold text-gray-800">
            <tr>
              {section.footer.map((v, j) => (
                <td key={j} className={`px-3 py-2 ${section.numeric?.includes(j) ? 'text-right whitespace-nowrap' : ''}`}>{v}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}
