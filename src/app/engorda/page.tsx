'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'
import { LOT_PHASES, STOCK_WARNING_DAYS, lotSummary, projectTarget } from '@/lib/lots'
import { fmtDate, fmtNumber } from '@/lib/reports'
import { todayISO } from '@/lib/utils'
import { HttpError, cachedGet } from '@/lib/offlineData'
import { loadHerd as fetchHerd } from '@/lib/herdCache'
import { useOfflineModule } from '@/lib/useOffline'
import { useT } from '@/lib/i18n'
import { SemSinalIcon, SincronizarIcon } from '@/components/ModuleIcons'
import { StatTile } from '@/components/StatTile'
import type { LotPlan } from '@/lib/lotPlans'
import { LotDetail } from './LotDetail'
import { PlanSelect, PlansPanel, sortPlans } from './Plans'
import { RearingAnimals } from './RearingAnimals'
import {
  AnimalPicker, HerdAnimal, LOTS_MODULE, Lot, Modal, ProductForm, ProductsEditor, QUEUED_MESSAGE, Stat, SupplyRef, WeightList, averageOf, decimal, input, isQueued, kg, label,
  WeightProgress, moneyField, offlineMessage, parseKg, phaseLabel, productLines, productsPayload, send, toField,
} from './shared'

type Tab = 'todos' | 'recria' | 'engorda'
/** Lotes (com as fases) ou Planos de recria/engorda */
type View = 'lotes' | 'planos'

export default function EngordaPage() {
  const { user, canAccess, loading: userLoading } = useUser()
  const t = useT()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const [lots, setLots] = useState<Lot[] | null>(null)
  const [herd, setHerd] = useState<HerdAnimal[]>([])
  const [supplies, setSupplies] = useState<SupplyRef[]>([])
  const [error, setError] = useState('')
  const [fromCache, setFromCache] = useState(false)
  const [notice, setNotice] = useState('')
  const [tab, setTab] = useState<Tab>('todos')
  const [view, setView] = useState<View>('lotes')
  const [plans, setPlans] = useState<LotPlan[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState<{ id: string; focus?: 'pesar' | 'animais' } | null>(null)
  const [rearingCount, setRearingCount] = useState(0)
  const today = todayISO()
  // Quem está entrando vem do contexto (funciona sem internet pela cópia do aparelho); null = ainda carregando
  const farmId = userLoading ? null : (user?.farmId ?? '')
  const fid = farmId ?? ''

  // Lotes, rebanho e insumos com cópia no aparelho: sem internet ou com sinal fraco, abre a última cópia
  const loadHerd = useCallback(() => {
    if (!fid) return
    fetchHerd<HerdAnimal>(fid).then((r) => setHerd(r.data.filter((a) => a.status === 'Vivo'))).catch(() => {})
  }, [fid])
  const loadSupplies = useCallback(() => {
    if (fid && canAccess('estoque')) cachedGet<SupplyRef[]>(`cache_estoque_${fid}`, '/api/estoque').then((r) => setSupplies(r.data)).catch(() => {})
  }, [fid, canAccess])
  const load = useCallback(() => {
    if (!fid) return
    cachedGet<Lot[]>(`cache_lotes_${fid}`, '/api/lotes')
      .then((r) => { setLots(r.data); setFromCache(r.fromCache); setError('') })
      // 5xx sem cópia: o servidor falhou (banco sem as migrations, por exemplo); sem status, foi a rede e não há cópia
      .catch((err) => setError(err instanceof HttpError
        ? (err.status >= 500 ? t('O servidor não conseguiu carregar os lotes. Se o app acabou de ser atualizado, aplique as migrations do banco (npx prisma migrate deploy).') : t(err.message))
        : t('Não foi possível carregar os lotes. Confira a internet. Depois do primeiro acesso com sinal, eles ficam guardados neste aparelho.')))
    loadHerd()
  }, [fid, loadHerd, t])
  // Planos de recria/engorda, também com cópia no aparelho
  const loadPlans = useCallback(() => {
    if (fid) cachedGet<LotPlan[]>(`cache_planos_${fid}`, '/api/lotes/planos').then((r) => setPlans(r.data)).catch(() => setPlans((p) => p ?? []))
  }, [fid])
  const reload = useCallback(() => { load(); loadSupplies(); loadPlans() }, [load, loadSupplies, loadPlans])
  // Fila dos lotes: contagem, "Enviar agora" e recarga quando a barra do topo terminar de enviar
  const net = useOfflineModule(LOTS_MODULE, reload)
  useEffect(() => { void Promise.resolve().then(reload) }, [reload])
  const queued = (message: string) => { setNotice(message); net.refresh() }

  // Um animal muda de lote: o lote antigo também perde o animal na tela. O trato mexe no estoque.
  const replace = (lot: Lot) => {
    const moved = new Set(lot.animals.map((a) => a.id))
    setLots((list) => (list ?? []).map((l) => (l.id === lot.id ? lot : { ...l, animals: l.animals.filter((a) => !moved.has(a.id)) })))
    loadHerd()
    loadSupplies()
  }
  const visible = useMemo(() => (lots ?? []).filter((l) => tab === 'todos' || l.phase === tab), [lots, tab])
  const openLots = useMemo(() => visible.filter((l) => !l.endDate), [visible])
  const closed = visible.filter((l) => l.endDate)
  const current = lots?.find((l) => l.id === open?.id) ?? null
  const lotNames = useMemo(() => new Map((lots ?? []).filter((l) => !l.endDate).map((l) => [l.id, l.name])), [lots])
  const count = (phase: string) => (lots ?? []).filter((l) => l.phase === phase && !l.endDate).length + (phase === 'recria' ? rearingCount : 0)

  // Resumo dos lotes abertos da aba
  const totals = useMemo(() => {
    const summaries = openLots.map((l) => lotSummary(l.weighings, today, l.endDate))
    const heads = summaries.reduce((s, x) => s + (x.last?.headCount ?? 0), 0)
    const weight = summaries.reduce((s, x) => s + (x.last ? x.last.avgWeight * x.last.headCount : 0), 0)
    const withGmd = summaries.filter((x) => x.gmd !== null && x.last)
    const gmdHeads = withGmd.reduce((s, x) => s + x.last!.headCount, 0)
    return {
      heads,
      avgWeight: heads ? weight / heads : null,
      gmd: gmdHeads ? withGmd.reduce((s, x) => s + x.gmd! * x.last!.headCount, 0) / gmdHeads : null,
    }
  }, [openLots, today])

  return (
    <PermissionGuard module="animais">
      <div>
        <div className="page-toolbar mb-2 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-800">{t('Recria e engorda')}</h1>
          {canEdit && view === 'lotes' && <button type="button" onClick={() => setCreating(true)} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600">{t('Novo lote')}</button>}
        </div>
        <p className="mb-4 text-sm text-gray-600">{t('Na recria, acompanhe cada bezerro sozinho (desmama, pesagens, cobertura da novilha) ou em lote. Na engorda, junte os animais em lotes, pese e veja o ganho por dia, o trato e quando chegam ao peso de saída.')}</p>

        {(!net.online || fromCache) && (
          <p className="mb-3 flex items-center gap-2 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            <SemSinalIcon className="h-5 w-5 shrink-0" />
            <span>{t(net.online ? 'Sinal fraco: mostrando a última cópia dos lotes guardada neste aparelho.' : 'Sem internet: mostrando a última cópia dos lotes guardada neste aparelho.')} {t('O que você registrar fica na fila e é enviado quando a conexão voltar; o lote na tela só muda depois do envio.')}</span>
          </p>
        )}
        {net.online && net.pendingCount > 0 && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span className="flex items-center gap-2"><SincronizarIcon className="h-5 w-5 shrink-0" />{net.pendingCount === 1 ? t('1 registro de lotes para enviar') : t('{n} registros de lotes para enviar', { n: net.pendingCount })}</span>
            <button type="button" onClick={() => void net.sync()} disabled={net.syncing} className="shrink-0 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-600 disabled:bg-blue-400">{t(net.syncing ? 'Enviando...' : 'Enviar agora')}</button>
          </div>
        )}
        {notice && (
          <p role="status" className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span>{notice}</span>
            <button type="button" onClick={() => setNotice('')} className="shrink-0 text-xs font-semibold hover:underline">{t('Fechar')}</button>
          </p>
        )}

        {/* Lotes ou Planos (o plano diz o ganho esperado por etapa; o lote escolhe um plano) */}
        <div role="group" aria-label={t('Mostrar')} className="mb-4 flex flex-wrap gap-2">
          {([['lotes', t('Lotes')], ['planos', t('Planos')]] as const).map(([key, text]) => (
            <button key={key} type="button" onClick={() => setView(key)} aria-pressed={view === key}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${view === key ? 'bg-green-800 text-white' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>{text}</button>
          ))}
        </div>

        {view === 'planos' && (
          <PlansPanel plans={plans} canEdit={canEdit}
            onSaved={(plan) => { setPlans((list) => sortPlans([plan, ...(list ?? []).filter((p) => p.id !== plan.id)])); load() }}
            onDeleted={(id) => { setPlans((list) => (list ?? []).filter((p) => p.id !== id)); load() }}
            onQueued={queued} />
        )}

        {view === 'lotes' && <>
        <nav aria-label={t('Fase')} className="mb-5 inline-flex rounded-xl border border-gray-200 bg-white p-1">
          {([['todos', t('Todos')], ['recria', `${t('Recria')} (${count('recria')})`], ['engorda', `${t('Engorda')} (${count('engorda')})`]] as const).map(([key, text]) => (
            <button key={key} type="button" onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{text}</button>
          ))}
        </nav>

        {/* Números dos lotes abertos da aba, antes das listas */}
        {openLots.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile accent="blue" label={t('Ganho por dia (média)')} value={totals.gmd !== null ? <>{fmtNumber(totals.gmd, 2)} <span className="text-lg font-semibold">{t('kg/dia')}</span></> : '—'} />
            <StatTile accent="green" label={t('Peso médio')} value={totals.avgWeight !== null ? kg(totals.avgWeight) : '—'} />
            <StatTile accent="teal" label={t('Cabeças nos lotes')} value={totals.heads} />
            <StatTile accent="amber" label={t('Lotes abertos')} value={openLots.length} />
          </div>
        )}

        <RearingAnimals farmId={farmId} herd={herd} canEdit={canEdit} canBreed={canEdit && canAccess('reproducao')} today={today} visible={tab !== 'engorda'} onCount={setRearingCount} onHerdChanged={loadHerd} onQueued={net.refresh} />

        {openLots.length > 0 && <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{t('Lotes')}</h2>}

        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
        {!lots ? <p className="text-sm text-gray-400">{t('Carregando...')}</p> : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
            <p className="font-semibold text-gray-800">{tab === 'todos' ? t('Nenhum lote ainda') : t(tab === 'recria' ? 'Nenhum lote de recria' : 'Nenhum lote de engorda')}</p>
            <p className="mt-1 text-sm">{t(tab === 'recria' ? 'Para acompanhar um animal sozinho, use “Acompanhar um animal”. Para um grupo, crie um lote de recria.' : 'Crie um lote com os animais cadastrados (ou só a quantidade e o peso médio). A cada pesagem, o app mostra quanto o lote ganhou.')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {openLots.map((l) => <LotCard key={l.id} lot={l} today={today} canEdit={canEdit} onOpen={(focus) => setOpen({ id: l.id, focus })} />)}
            </div>
            {closed.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">{t('Encerrados')}</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {closed.map((l) => <LotCard key={l.id} lot={l} today={today} canEdit={false} onOpen={() => setOpen({ id: l.id })} />)}
                </div>
              </section>
            )}
          </>
        )}
        </>}

        {creating && <LotForm supplies={supplies} herd={herd} lotNames={lotNames} plans={plans ?? []} defaultPhase={tab === 'recria' ? 'recria' : 'engorda'} onClose={() => setCreating(false)}
          onSaved={(lot) => { setCreating(false); setLots((list) => [lot, ...(list ?? [])]); replace(lot) }}
          onQueued={() => { setCreating(false); queued(`${t(QUEUED_MESSAGE)} ${t('O lote aparece na lista depois do envio.')}`) }} />}
        {current && <LotDetail key={current.id} lot={current} supplies={supplies} herd={herd} lotNames={lotNames} plans={plans ?? []} canEdit={canEdit}
          canBreed={canEdit && canAccess('reproducao')} today={today} focus={open?.focus} onClose={() => setOpen(null)} onChanged={replace} onReload={load} onQueued={net.refresh}
          onDeleted={() => { setLots((list) => (list ?? []).filter((l) => l.id !== current.id)); setOpen(null); loadHerd(); loadSupplies() }} />}
      </div>
    </PermissionGuard>
  )
}

// ── Cartão do lote ──────────────────────────────────────────────────────

function LotCard({ lot, today, canEdit, onOpen }: { lot: Lot; today: string; canEdit: boolean; onOpen: (focus?: 'pesar' | 'animais') => void }) {
  const t = useT()
  const s = lotSummary(lot.weighings, today, lot.endDate)
  const projection = lot.endDate ? null : projectTarget(s, lot.targetWeight)
  const covered = lot.phase === 'recria' ? lot.animals.filter((a) => a.reproductions[0] && ['Coberta', 'Prenha'].includes(a.reproductions[0].status)).length : 0
  const females = lot.animals.filter((a) => a.gender === 'Fêmea').length
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Cabeçalho na cor da fase: azul na recria, laranja na engorda (a fase também vem escrita) */}
      <button type="button" onClick={() => onOpen()} className={`flex w-full items-start justify-between gap-2 border-b px-4 py-3 text-left ${lot.endDate ? 'border-gray-100 bg-gray-50 hover:bg-gray-100' : lot.phase === 'recria' ? 'border-sky-100 bg-sky-50 hover:bg-sky-100' : 'border-amber-100 bg-amber-50 hover:bg-amber-100'}`}>
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold text-gray-900">{lot.name}</span>
          <span className="block text-sm text-gray-600">{s.days === 1 ? t('1 dia no lote') : t('{n} dias no lote', { n: s.days })}{lot.endDate ? ` · ${t('saiu em {date}', { date: fmtDate(lot.endDate) })}` : ''}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${lot.phase === 'recria' ? 'bg-sky-100 text-sky-800 ring-sky-200' : 'bg-amber-100 text-amber-800 ring-amber-200'}`}>{t(phaseLabel(lot.phase))}</span>
      </button>
      <div className="p-4">
        {s.last && lot.targetWeight && !lot.endDate ? <div className="mb-2"><WeightProgress current={s.last.avgWeight} target={lot.targetWeight} /></div> : null}
        <div className="grid grid-cols-3 gap-2">
          <Stat title={t('Animais')} value={String(lot.animals.length || s.last?.headCount || 0)} />
          <Stat title={t('Peso médio')} value={s.last ? kg(s.last.avgWeight) : '—'} />
          <Stat title={t('Ganho/dia')} value={s.gmd !== null ? `${s.gmd >= 0 ? '+' : ''}${fmtNumber(s.gmd, 3)}` : '—'} tone="text-green-700" />
        </div>
        {s.gainKg !== null && <p className="mt-3 text-sm text-gray-700">{t('Ganhou')} <strong>{kg(s.gainKg)}</strong> {t('por cabeça desde a entrada.')}</p>}
        {projection && <p className="mt-1 text-sm text-gray-700">{t('Chega a {weight} em', { weight: kg(lot.targetWeight!) })} <strong>{t('{n} dias', { n: projection.days })}</strong> ({fmtDate(projection.date)}).</p>}
        {females > 0 && lot.phase === 'recria' && <p className="mt-1 text-sm text-gray-700">{females === 1 ? t('{covered} de 1 novilha coberta.', { covered }) : t('{covered} de {females} novilhas cobertas.', { covered, females })}</p>}
        {productLines(lot).filter((p) => p.perDay).map((p) => (
          <p key={p.id} className={`mt-1 text-xs ${p.days !== null && p.days <= STOCK_WARNING_DAYS ? 'font-semibold text-amber-700' : 'text-gray-500'}`}>
            {p.supply.name}: {kg(p.perDay!)}/{t('dia')}{p.days !== null ? ` · ${p.days === 1 ? t('estoque para 1 dia') : t('estoque para {n} dias', { n: p.days })}` : ''}
          </p>
        ))}
        {canEdit && (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
            <button type="button" onClick={() => onOpen('animais')} className="rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">+ {t('Animais')}</button>
            <button type="button" onClick={() => onOpen('pesar')} className="rounded-lg bg-green-800 py-2 text-sm font-semibold text-white hover:bg-green-700">{t('Pesar')}</button>
          </div>
        )}
      </div>
    </article>
  )
}

// ── Novo lote ───────────────────────────────────────────────────────────

function LotForm({ supplies, herd, lotNames, plans, defaultPhase, onClose, onSaved, onQueued }: {
  supplies: SupplyRef[]
  herd: HerdAnimal[]
  lotNames: Map<string, string>
  /** Planos de recria/engorda (o select mostra os ativos) */
  plans: LotPlan[]
  defaultPhase: string
  onClose: () => void
  onSaved: (lot: Lot) => void
  /** Sem internet ou sinal fraco: o lote ficou na fila do aparelho */
  onQueued: () => void
}) {
  const t = useT()
  const [mode, setMode] = useState<'animais' | 'quantidade'>(herd.length ? 'animais' : 'quantidade')
  const [form, setForm] = useState({ name: '', phase: defaultPhase, startDate: todayISO(), headCount: '', avgWeight: '', targetWeight: '', planId: '', purchaseValue: '' })
  const [animalIds, setAnimalIds] = useState<string[]>([])
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [products, setProducts] = useState<ProductForm[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const chosen = herd.filter((a) => animalIds.includes(a.id))
  const avg = averageOf(Object.fromEntries(animalIds.map((id) => [id, weights[id] ?? ''])))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'animais' && !animalIds.length) return setError(t('Escolha os animais do lote'))
    if (mode === 'animais' && avg === null && !parseKg(form.avgWeight)) return setError(t('Informe o peso de entrada dos animais ou o peso médio do lote'))
    setSaving(true)
    setError('')
    try {
      const base = { ...form, planId: form.planId || null, purchaseValue: moneyField(form.purchaseValue), supplies: productsPayload(products) }
      const body = mode === 'animais'
        ? { ...base, animalIds, weights: Object.fromEntries(animalIds.map((id) => [id, weights[id] ?? ''])), headCount: animalIds.length }
        : base
      onSaved(await send('/api/lotes', 'POST', body))
    } catch (err) {
      if (isQueued(err)) onQueued()
      else setError(t(offlineMessage(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t('Novo lote')} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className={label}>{t('Nome do lote')}
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('Ex.: Garrotes de julho')} className={input} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          {LOT_PHASES.map((p) => (
            <button key={p.key} type="button" aria-pressed={form.phase === p.key} onClick={() => setForm({ ...form, phase: p.key })}
              className={`rounded-xl border-2 py-2.5 text-sm font-semibold ${form.phase === p.key ? 'border-green-700 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>{t(p.label)}</button>
          ))}
        </div>
        <label className={label}>{t('Data de entrada')}
          <input type="date" required max={todayISO()} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={input} />
        </label>

        <fieldset>
          <legend className={label}>{t('Como você acompanha este lote?')}</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {([['animais', t('Animais cadastrados'), t('Peso de cada um')], ['quantidade', t('Só a quantidade'), t('Peso médio do lote')]] as const).map(([key, title, hint]) => (
              <button key={key} type="button" aria-pressed={mode === key} onClick={() => setMode(key)}
                className={`rounded-xl border-2 px-3 py-2 text-left ${mode === key ? 'border-green-700 bg-green-50' : 'border-gray-200'}`}>
                <span className={`block text-sm font-semibold ${mode === key ? 'text-green-800' : 'text-gray-700'}`}>{title}</span>
                <span className="block text-xs text-gray-500">{hint}</span>
              </button>
            ))}
          </div>
        </fieldset>

        {mode === 'animais' ? (
          <>
            <AnimalPicker herd={herd} lotNames={lotNames} selected={animalIds} onChange={setAnimalIds} />
            {chosen.length > 0 && (
              <div>
                <p className={label}>{t('Peso de entrada (opcional, mas é com ele que o app calcula o ganho de cada animal)')}</p>
                <div className="mt-1"><WeightList animals={chosen} weights={weights} onChange={setWeights} /></div>
                {avg !== null
                  ? <p className="mt-1 text-sm text-gray-700">{t('Peso médio de entrada:')} <strong>{kg(avg)}</strong></p>
                  : <label className={`${label} mt-2`}>{t('Sem pesar agora? Informe o peso médio estimado (kg)')}
                      <input inputMode="decimal" value={form.avgWeight} onChange={(e) => setForm({ ...form, avgWeight: decimal(e.target.value) })} placeholder={t('Ex.: 250')} className={input} />
                    </label>}
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>{t('Cabeças')}
              <input required inputMode="numeric" value={form.headCount} onChange={(e) => setForm({ ...form, headCount: e.target.value.replace(/\D/g, '') })} className={input} />
            </label>
            <label className={label}>{t('Peso médio de entrada (kg)')}
              <input required inputMode="decimal" value={form.avgWeight} onChange={(e) => setForm({ ...form, avgWeight: decimal(e.target.value) })} placeholder={t('Ex.: 300')} className={input} />
            </label>
          </div>
        )}

        <label className={label}>{t(form.phase === 'recria' ? 'Peso-alvo da recria por cabeça (kg, opcional)' : 'Peso de saída desejado por cabeça (kg, opcional)')}
          <input inputMode="decimal" value={form.targetWeight} onChange={(e) => setForm({ ...form, targetWeight: decimal(e.target.value) })} placeholder={t(form.phase === 'recria' ? 'Ex.: 320' : 'Ex.: 540')} className={input} />
        </label>
        {/* Plano e valor de compra: entram no desempenho do lote */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <PlanSelect plans={plans} value={form.planId}
            onChange={(planId, plan) => setForm((f) => ({ ...f, planId, targetWeight: !f.targetWeight.trim() && plan?.targetWeight ? toField(plan.targetWeight) : f.targetWeight }))} />
          <label className={label}>{t('Valor de compra do lote (R$, opcional)')}
            <input inputMode="decimal" value={form.purchaseValue} onChange={(e) => setForm({ ...form, purchaseValue: decimal(e.target.value) })} placeholder={t('Ex.: 150.000,00')} className={input} />
          </label>
        </div>
        <ProductsEditor supplies={supplies} value={products} onChange={setProducts} />
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700">{t('Cancelar')}</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-green-700 py-3 font-semibold text-white disabled:bg-gray-300">{t(saving ? 'Salvando...' : 'Criar lote')}</button>
        </div>
      </form>
    </Modal>
  )
}
