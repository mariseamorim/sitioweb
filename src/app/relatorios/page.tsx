'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { REPORT_TYPES, Report } from '@/lib/reports'
import { exportCSV, exportPDF } from '@/lib/reportExport'
import { todayISO } from '@/lib/utils'
import { cellSortValue, compareValues } from '@/lib/useSort'

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
  const { canAccess, loading: userLoading } = useUser()
  const types = useMemo(() => REPORT_TYPES.filter((t) => canAccess(t.module)), [canAccess])

  const [typeKey, setTypeKey] = useState('')
  const [preset, setPreset] = useState<Preset>('mes')
  const [[from, to], setRange] = useState<[string, string]>(presetRange('mes'))
  const [animals, setAnimals] = useState<{ id: string; code: string; name: string }[]>([])
  const [animalId, setAnimalId] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState('')

  const type = types.find((t) => t.key === typeKey)

  useEffect(() => {
    if (!type?.needsAnimal || animals.length) return
    fetch('/api/animals')
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => setAnimals(Array.isArray(list) ? list : []))
      .catch(() => setAnimals([]))
  }, [type, animals.length])

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
    if (!navigator.onLine) {
      setError('Os relatórios precisam de internet. Conecte-se e tente de novo.')
      return
    }
    const params = new URLSearchParams({ tipo: type.key })
    if (type.needsPeriod) { params.set('from', from); params.set('to', to) }
    if (type.needsAnimal) params.set('animalId', animalId)

    setLoading(true)
    try {
      const res = await fetch(`/api/relatorios?${params}`)
      const data = await res.json()
      if (!res.ok) setError(data.error || 'Não foi possível gerar o relatório.')
      else setReport(data)
    } catch {
      setError('Sem conexão. Tente de novo quando a internet voltar.')
    } finally {
      setLoading(false)
    }
  }

  async function handlePDF() {
    if (!report) return
    setExporting(true)
    try { await exportPDF(report) } finally { setExporting(false) }
  }

  const canGenerate = !!type && (!type.needsAnimal || !!animalId) && (!type.needsPeriod || (from && to && from <= to))

  if (userLoading) return <p className="text-gray-400 text-sm mt-8">Carregando...</p>

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Relatórios</h1>
        <p className="text-gray-500 text-sm mt-1">Escolha o relatório, veja na tela e baixe em PDF ou planilha.</p>
      </div>

      {types.length === 0 ? (
        <p className="text-gray-500">Você não tem acesso a nenhum relatório. Peça ao administrador.</p>
      ) : (
        <>
          {/* 1. Tipo */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {types.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => chooseType(t.key)}
                aria-pressed={typeKey === t.key}
                className={`text-left rounded-xl border-2 p-4 transition-colors ${
                  typeKey === t.key ? 'border-green-600 bg-green-50' : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <p className="text-base font-semibold text-gray-900">{t.label}</p>
                <p className="mt-1 text-sm text-gray-500 leading-snug">{t.description}</p>
              </button>
            ))}
          </div>

          {/* 2. Opções */}
          {type && (
            <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 flex flex-col gap-4">
              {type.needsPeriod && (
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Período</p>
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
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {preset === 'outro' && (
                    <div className="mt-3 grid grid-cols-2 gap-3 max-w-md">
                      <label className="text-sm text-gray-600">
                        De
                        <input type="date" value={from} onChange={(e) => setRange([e.target.value, to])}
                          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                      </label>
                      <label className="text-sm text-gray-600">
                        Até
                        <input type="date" value={to} onChange={(e) => setRange([from, e.target.value])}
                          className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600" />
                      </label>
                    </div>
                  )}
                </div>
              )}

              {type.needsAnimal && (
                <label className="text-sm font-medium text-gray-700 max-w-md">
                  Animal
                  <select value={animalId} onChange={(e) => setAnimalId(e.target.value)}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-normal focus:outline-none focus:ring-2 focus:ring-green-600">
                    <option value="">— Selecione —</option>
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
                  {loading ? 'Gerando...' : 'Ver relatório'}
                </button>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          )}

          {/* 3. Resultado */}
          {report && (
            <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-100">
              <div className="p-4 sm:p-5 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{report.title}</h2>
                  <p className="text-sm text-gray-500">{report.subtitle}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handlePDF} disabled={exporting}
                    className="flex-1 sm:flex-none bg-green-700 hover:bg-green-600 disabled:bg-green-400 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
                    {exporting ? 'Gerando PDF...' : 'Baixar PDF'}
                  </button>
                  <button onClick={() => exportCSV(report)}
                    className="flex-1 sm:flex-none border-2 border-green-700 text-green-700 hover:bg-green-50 text-sm font-semibold px-4 py-2 rounded-lg">
                    Baixar planilha
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex flex-col gap-6">
                {report.sections.map((section, i) => (
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
                  <button type="button" onClick={() => toggle(j)} title={`Ordenar por ${c.toLowerCase()}`}
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
            <tr><td colSpan={section.columns.length} className="px-3 py-6 text-center text-gray-400">Nenhum registro</td></tr>
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
