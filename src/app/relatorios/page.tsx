'use client'

import { useEffect, useMemo, useState } from 'react'
import { useUser } from '@/contexts/UserContext'
import { REPORT_TYPES, Report, badgeTone, type ReportSection, type ReportTone } from '@/lib/reports'
import { StatTile, type Accent } from '@/components/StatTile'
import { exportCSV, exportPDF } from '@/lib/reportExport'
import { todayISO } from '@/lib/utils'
import { cellSortValue, compareValues } from '@/lib/useSort'
import { HttpError, cachedGet } from '@/lib/offlineData'
import { loadHerd } from '@/lib/herdCache'
import { useT, type Vars } from '@/lib/i18n'
import {
  AnimalIcon, EstoqueIcon, EtiquetaIcon, FinanceiroIcon, LeiteIcon, RelatorioIcon, ReproducaoIcon, VacinaIcon,
} from '@/components/ModuleIcons'

// Ícone pequeno à esquerda de cada tipo de relatório (o que não estiver aqui usa o ícone de relatório)
const TYPE_ICONS: Record<string, (p: { className?: string }) => React.ReactElement> = {
  leite: LeiteIcon,
  'ficha-animal': EtiquetaIcon,
  vacinacao: VacinaIcon,
  financeiro: FinanceiroIcon,
  partos: ReproducaoIcon,
  rebanho: AnimalIcon,
  estoque: EstoqueIcon,
}

const COUNTED: Record<string, string> = {
  'meses sem parir': '{n} meses sem parir',
  registros: '{n} registros',
  aplicadas: '{n} aplicadas',
  pendentes: '{n} pendentes',
  dias: '{n} dias',
}

/**
 * O relatório vem do servidor em português: títulos, colunas e textos das células passam pelo dicionário
 * (o que não estiver nele fica como veio). A mesma cópia traduzida vai para o PDF e a planilha.
 */
function translateReport(report: Report, t: (text: string, vars?: Vars) => string): ShownReport {
  // Textos com número no meio ("18 meses sem parir", "3 registros", "Média 12,5 L/dia") viram chave com {n}
  const text = (v: string) => {
    const counted = v.match(/^(\d+) (meses sem parir|registros|aplicadas|pendentes|dias)$/)
    if (counted) return t(COUNTED[counted[2]], { n: counted[1] })
    const average = v.match(/^Média (.+) L\/dia$/)
    if (average) return t('Média {v} L/dia', { v: average[1] })
    return t(v)
  }
  const cell = <V,>(v: V): V => (typeof v === 'string' ? (text(v) as V) : v)
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
      // A cor da pílula sai da palavra em português, antes de traduzir
      ...(s.badgeColumn !== undefined ? { badgeTones: s.rows.map((row) => badgeTone(row[s.badgeColumn!])) } : {}),
      ...(s.footer ? { footer: s.footer.map(cell) } : {}),
    })),
  }
}

/** Seção já traduzida, com a cor de cada pílula guardada (a palavra traduzida não serve para escolher a cor) */
type ShownSection = ReportSection & { badgeTones?: (ReportTone | null)[] }
type ShownReport = Omit<Report, 'sections'> & { sections: ShownSection[] }

// Cores de cartão e pílula por tom; sem tom, os cartões alternam cores neutras
const TONE_ACCENT: Record<ReportTone, Accent> = { good: 'green', warn: 'amber', bad: 'red' }
const NEUTRAL_ACCENTS: Accent[] = ['blue', 'teal', 'green']
const BADGE_STYLE: Record<ReportTone | 'none', string> = {
  good: 'bg-green-100 text-green-800 border-green-200',
  warn: 'bg-amber-100 text-amber-800 border-amber-200',
  bad: 'bg-red-100 text-red-700 border-red-200',
  none: 'bg-gray-100 text-gray-700 border-gray-200',
}

function Pill({ text, tone }: { text: string | number; tone: ReportTone | null | undefined }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold ${BADGE_STYLE[tone ?? 'none']}`}>{text}</span>
  )
}

/** Seção de resumo em cartões: cada linha é [rótulo, valor] */
function SummaryCards({ section }: { section: ShownSection }) {
  const cols = section.rows.length >= 4 ? 'sm:grid-cols-4' : section.rows.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
  let neutral = 0
  return (
    <div className={`grid grid-cols-2 gap-3 ${cols}`}>
      {section.rows.map((row, i) => {
        const tone = section.tones?.[i]
        const accent = tone ? TONE_ACCENT[tone] : NEUTRAL_ACCENTS[neutral++ % NEUTRAL_ACCENTS.length]
        return <StatTile key={i} label={String(row[0])} value={String(row[1])} accent={accent} />
      })}
    </div>
  )
}

function ReportSectionView({ section }: { section: ShownSection }) {
  if (section.kind === 'cards') {
    return (
      <div>
        {section.title && <h3 className="text-sm font-bold text-gray-800 mb-2">{section.title}</h3>}
        <SummaryCards section={section} />
      </div>
    )
  }
  // Alerta só quando há linhas: sem vaca atrasada, a seção fica como as outras
  const alert = section.alert && section.rows.length ? section.alert : null
  return (
    <div className={alert === 'bad' ? 'rounded-xl border border-red-200 bg-red-50 p-3 sm:p-4' : alert === 'warn' ? 'rounded-xl border border-amber-200 bg-amber-50 p-3 sm:p-4' : ''}>
      {section.title && (
        <h3 className={`text-sm font-bold mb-2 ${alert === 'bad' ? 'text-red-800' : alert === 'warn' ? 'text-amber-900' : 'text-gray-800'}`}>
          {alert ? <span aria-hidden="true" className="mr-1">⚠</span> : null}{section.title}
        </h3>
      )}
      <SortableReportTable section={section} />
    </div>
  )
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
  // O veterinário consultor não precisa do relatório de produção de leite (é do produtor)
  const types = useMemo(() => REPORT_TYPES.filter((rt) => canAccess(rt.module) && !(user?.vet && rt.key === 'leite')), [canAccess, user?.vet])

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
          <div className="grid sm:grid-cols-2 gap-3">
            {types.map((rt) => {
              const Icon = TYPE_ICONS[rt.key] ?? RelatorioIcon
              const active = typeKey === rt.key
              return (
                <button
                  key={rt.key}
                  type="button"
                  onClick={() => chooseType(rt.key)}
                  aria-pressed={active}
                  className={`flex items-start gap-3 text-left rounded-xl border bg-white p-4 shadow-sm transition-colors ${
                    active ? 'border-green-700 ring-1 ring-green-700' : 'border-gray-200 hover:border-green-300'
                  }`}
                >
                  <span className={`shrink-0 rounded-lg p-2 ${active ? 'bg-green-800 text-white' : 'bg-green-50 text-green-800'}`}>
                    <Icon className="w-5 h-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-base font-bold text-gray-900">{t(rt.label)}</span>
                    <span className="mt-1 block text-sm text-gray-500 leading-snug">{t(rt.description)}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {/* 2. Opções */}
          {type && (
            <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-5 flex flex-col gap-4">
              {type.needsPeriod && (
                <div>
                  <h2 className="text-base font-bold text-gray-900 mb-3">{t('Período')}</h2>
                  <div className="flex flex-wrap gap-2">
                    {PRESETS.map((p) => (
                      <button
                        key={p.key}
                        type="button"
                        onClick={() => choosePreset(p.key)}
                        className={`px-4 py-2 rounded-full text-sm font-semibold border ${
                          preset === p.key ? 'bg-green-800 border-green-800 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
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
                  className="w-full sm:w-auto bg-green-800 hover:bg-green-700 disabled:bg-gray-300 text-white text-base font-semibold px-6 py-3 rounded-lg"
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
            <div className="mt-5 bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-4 sm:p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{shown.title}</h2>
                  <p className="text-sm text-gray-500">{shown.subtitle}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={handlePDF} disabled={exporting}
                    className="flex-1 sm:flex-none bg-green-800 hover:bg-green-700 disabled:bg-green-400 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
                    {t(exporting ? 'Gerando PDF...' : 'Baixar PDF')}
                  </button>
                  <button onClick={() => exportCSV(shown)}
                    className="flex-1 sm:flex-none border border-green-700 text-green-800 hover:bg-green-50 text-sm font-semibold px-4 py-2.5 rounded-lg">
                    {t('Baixar planilha')}
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-5 flex flex-col gap-6">
                {shown.sections.map((section, i) => <ReportSectionView key={i} section={section} />)}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
// Tabela do relatório: tocar no título da coluna ordena (datas, números e valores em R$ entendidos)
// Pílula na coluna de situação, números à direita e sem quebra, valor com sinal em verde/vermelho; texto quebra linha
// para a tabela caber no computador sem rolar de lado (no celular ainda pode rolar).
function SortableReportTable({ section }: { section: ShownSection }) {
  const t = useT()
  const [sortCol, setSortCol] = useState<{ col: number; dir: 'asc' | 'desc' } | null>(null)
  // Ordena os índices, para a cor da pílula acompanhar a linha
  const order = useMemo(() => {
    const idx = section.rows.map((_, i) => i)
    if (!sortCol) return idx
    return idx.sort((a, b) =>
      compareValues(cellSortValue(section.rows[a][sortCol.col]), cellSortValue(section.rows[b][sortCol.col]), sortCol.dir) || a - b)
  }, [section.rows, sortCol])
  const toggle = (col: number) => setSortCol((s) => (s?.col === col ? { col, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: 'asc' }))
  const signedClass = (v: string | number) => (String(v).trim().startsWith('-') ? 'text-red-700 font-semibold' : 'text-green-800 font-semibold')
  const cellClass = (j: number, v: string | number) => {
    if (section.numeric?.includes(j)) return `text-right whitespace-nowrap tabular-nums ${section.signedColumn === j ? signedClass(v) : ''}`
    // Datas (dd/mm/aaaa) e códigos curtos não quebram
    return /^\d{2}\/\d{2}\/\d{4}$/.test(String(v)) || String(v).length <= 6 ? 'whitespace-nowrap' : ''
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-gray-500 text-xs font-semibold uppercase tracking-wide border-b border-gray-200">
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
          {order.length === 0 ? (
            <tr><td colSpan={section.columns.length} className="px-3 py-6 text-center text-gray-400">{t('Nenhum registro')}</td></tr>
          ) : order.map((r) => (
            <tr key={r} className="hover:bg-gray-50">
              {section.rows[r].map((v, j) => (
                <td key={j} className={`px-3 py-2 text-gray-700 ${cellClass(j, v)}`}>
                  {section.badgeColumn === j && v !== '—' && v !== '' ? <Pill text={v} tone={section.badgeTones?.[r]} /> : v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {section.footer && (
          // Linha totalizadora em destaque: negrito com fundo verde-claro
          <tfoot className="bg-green-50 border-t-2 border-green-200 font-bold text-green-900">
            {/* Sem coluna numérica (vacinação), a linha vira um texto só: "2 registros · 2 aplicadas · 0 pendentes" */}
            {section.numeric?.length ? (
              <tr>
                {section.footer.map((v, j) => (
                  <td key={j} className={`px-3 py-2.5 ${section.numeric?.includes(j) ? 'text-right whitespace-nowrap tabular-nums' : ''}`}>{v}</td>
                ))}
              </tr>
            ) : (
              <tr><td colSpan={section.columns.length} className="px-3 py-2.5">{section.footer.filter((v) => v !== '').join(' · ')}</td></tr>
            )}
          </tfoot>
        )}
      </table>
    </div>
  )
}
