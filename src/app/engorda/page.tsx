'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useUser } from '@/contexts/UserContext'
import { LOT_PHASES, STOCK_WARNING_DAYS, lotSummary, projectTarget } from '@/lib/lots'
import { fmtDate, fmtNumber } from '@/lib/reports'
import { todayISO } from '@/lib/utils'
import { LotDetail } from './LotDetail'
import { RearingAnimals } from './RearingAnimals'
import {
  AnimalPicker, HerdAnimal, Lot, Modal, ProductForm, ProductsEditor, Stat, SupplyRef, WeightList, averageOf, decimal, input, kg, label,
  offlineMessage, parseKg, phaseLabel, productLines, productsPayload, send,
} from './shared'

type Tab = 'todos' | 'recria' | 'engorda'

export default function EngordaPage() {
  const { user, canAccess } = useUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const [lots, setLots] = useState<Lot[] | null>(null)
  const [herd, setHerd] = useState<HerdAnimal[]>([])
  const [supplies, setSupplies] = useState<SupplyRef[]>([])
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('todos')
  const [creating, setCreating] = useState(false)
  const [open, setOpen] = useState<{ id: string; focus?: 'pesar' | 'animais' } | null>(null)
  const [farmId, setFarmId] = useState<string | null>(null)
  const [rearingCount, setRearingCount] = useState(0)
  const today = todayISO()

  const loadHerd = useCallback(() => {
    fetch('/api/animals').then((r) => (r.ok ? r.json() : [])).then((list: HerdAnimal[]) => setHerd(list.filter((a) => a.status === 'Vivo'))).catch(() => {})
  }, [])
  const loadSupplies = useCallback(() => {
    if (canAccess('estoque')) fetch('/api/estoque').then((r) => (r.ok ? r.json() : [])).then(setSupplies).catch(() => {})
  }, [canAccess])
  const load = useCallback(() => {
    fetch('/api/lotes').then((r) => (r.ok ? r.json() : Promise.reject(r.status))).then(setLots)
      // 5xx: o servidor falhou (banco sem as migrations, por exemplo); sem status, foi a rede
      .catch((status) => setError(typeof status === 'number' && status >= 500 ? 'O servidor não conseguiu carregar os lotes. Se o app acabou de ser atualizado, aplique as migrations do banco (npx prisma migrate deploy).' : 'Não foi possível carregar os lotes. Confira a internet.'))
    loadHerd()
  }, [loadHerd])
  useEffect(() => { load(); loadSupplies() }, [load, loadSupplies])
  useEffect(() => { fetch('/api/auth/me').then((r) => r.json()).then((me) => setFarmId(me.farmId ?? '')).catch(() => setFarmId('')) }, [])

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
          <h1 className="text-2xl font-bold text-gray-800">Recria e engorda</h1>
          {canEdit && <button type="button" onClick={() => setCreating(true)} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600">Novo lote</button>}
        </div>
        <p className="mb-4 text-sm text-gray-600">Na recria, acompanhe cada bezerro sozinho (desmama, pesagens, cobertura da novilha) ou em lote. Na engorda, junte os animais em lotes, pese e veja o ganho por dia, o trato e quando chegam ao peso de saída.</p>

        <nav aria-label="Fase" className="mb-5 inline-flex rounded-xl border border-gray-200 bg-white p-1">
          {([['todos', 'Todos'], ['recria', `Recria (${count('recria')})`], ['engorda', `Engorda (${count('engorda')})`]] as const).map(([key, text]) => (
            <button key={key} type="button" onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}
              className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === key ? 'bg-green-700 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{text}</button>
          ))}
        </nav>

        <RearingAnimals farmId={farmId} herd={herd} canEdit={canEdit} canBreed={canEdit && canAccess('reproducao')} today={today} visible={tab !== 'engorda'} onCount={setRearingCount} onHerdChanged={loadHerd} />

        {openLots.length > 0 && (
          <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Lotes abertos', String(openLots.length), 'text-gray-900'],
              ['Cabeças nos lotes', String(totals.heads), 'text-gray-900'],
              ['Peso médio', totals.avgWeight !== null ? kg(totals.avgWeight) : '—', 'text-gray-900'],
              ['Ganho por dia (média)', totals.gmd !== null ? `${fmtNumber(totals.gmd, 3)} kg` : '—', 'text-green-700'],
            ].map(([title, value, tone]) => (
              <div key={title} className="rounded-xl border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</p>
                <p className={`mt-2 text-2xl font-bold ${tone}`}>{value}</p>
              </div>
            ))}
          </div>
        )}

        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
        {!lots ? <p className="text-sm text-gray-400">Carregando...</p> : visible.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
            <p className="font-semibold text-gray-800">{tab === 'todos' ? 'Nenhum lote ainda' : `Nenhum lote de ${phaseLabel(tab).toLowerCase()}`}</p>
            <p className="mt-1 text-sm">{tab === 'recria' ? 'Para acompanhar um animal sozinho, use “Acompanhar um animal”. Para um grupo, crie um lote de recria.' : 'Crie um lote com os animais cadastrados (ou só a quantidade e o peso médio). A cada pesagem, o app mostra quanto o lote ganhou.'}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {openLots.map((l) => <LotCard key={l.id} lot={l} today={today} canEdit={canEdit} onOpen={(focus) => setOpen({ id: l.id, focus })} />)}
            </div>
            {closed.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Encerrados</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {closed.map((l) => <LotCard key={l.id} lot={l} today={today} canEdit={false} onOpen={() => setOpen({ id: l.id })} />)}
                </div>
              </section>
            )}
          </>
        )}

        {creating && <LotForm supplies={supplies} herd={herd} lotNames={lotNames} defaultPhase={tab === 'recria' ? 'recria' : 'engorda'} onClose={() => setCreating(false)}
          onSaved={(lot) => { setCreating(false); setLots((list) => [lot, ...(list ?? [])]); replace(lot) }} />}
        {current && <LotDetail key={current.id} lot={current} supplies={supplies} herd={herd} lotNames={lotNames} canEdit={canEdit}
          canBreed={canEdit && canAccess('reproducao')} today={today} focus={open?.focus} onClose={() => setOpen(null)} onChanged={replace} onReload={load}
          onDeleted={() => { setLots((list) => (list ?? []).filter((l) => l.id !== current.id)); setOpen(null); loadHerd(); loadSupplies() }} />}
      </div>
    </PermissionGuard>
  )
}

// ── Cartão do lote ──────────────────────────────────────────────────────

function LotCard({ lot, today, canEdit, onOpen }: { lot: Lot; today: string; canEdit: boolean; onOpen: (focus?: 'pesar' | 'animais') => void }) {
  const s = lotSummary(lot.weighings, today, lot.endDate)
  const projection = lot.endDate ? null : projectTarget(s, lot.targetWeight)
  const covered = lot.phase === 'recria' ? lot.animals.filter((a) => a.reproductions[0] && ['Coberta', 'Prenha'].includes(a.reproductions[0].status)).length : 0
  const females = lot.animals.filter((a) => a.gender === 'Fêmea').length
  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <button type="button" onClick={() => onOpen()} className="flex w-full items-start justify-between gap-2 border-b border-gray-100 bg-gray-50 px-4 py-3 text-left hover:bg-green-50">
        <span className="min-w-0">
          <span className="block truncate text-lg font-bold text-gray-800">{lot.name}</span>
          <span className="block text-xs text-gray-500">{s.days} dia{s.days === 1 ? '' : 's'} no lote{lot.endDate ? ` · saiu em ${fmtDate(lot.endDate)}` : ''}</span>
        </span>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${lot.phase === 'recria' ? 'bg-sky-100 text-sky-800' : 'bg-amber-100 text-amber-800'}`}>{phaseLabel(lot.phase)}</span>
      </button>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat title="Animais" value={String(lot.animals.length || s.last?.headCount || 0)} />
          <Stat title="Peso médio" value={s.last ? kg(s.last.avgWeight) : '—'} />
          <Stat title="Ganho/dia" value={s.gmd !== null ? `${s.gmd >= 0 ? '+' : ''}${fmtNumber(s.gmd, 3)}` : '—'} tone="text-green-700" />
        </div>
        {s.gainKg !== null && <p className="mt-3 text-sm text-gray-700">Ganhou <strong>{kg(s.gainKg)}</strong> por cabeça desde a entrada.</p>}
        {projection && <p className="mt-1 text-sm text-gray-700">Chega a {kg(lot.targetWeight!)} em <strong>{projection.days} dias</strong> ({fmtDate(projection.date)}).</p>}
        {females > 0 && lot.phase === 'recria' && <p className="mt-1 text-sm text-gray-700">{covered} de {females} novilha{females === 1 ? '' : 's'} coberta{covered === 1 ? '' : 's'}.</p>}
        {productLines(lot).filter((p) => p.perDay).map((p) => (
          <p key={p.id} className={`mt-1 text-xs ${p.days !== null && p.days <= STOCK_WARNING_DAYS ? 'font-semibold text-amber-700' : 'text-gray-500'}`}>
            {p.supply.name}: {kg(p.perDay!)}/dia{p.days !== null ? ` · estoque para ${p.days} dia${p.days === 1 ? '' : 's'}` : ''}
          </p>
        ))}
        {canEdit && (
          <div className="mt-4 grid grid-cols-2 gap-2 border-t border-gray-100 pt-3">
            <button type="button" onClick={() => onOpen('animais')} className="rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">+ Animais</button>
            <button type="button" onClick={() => onOpen('pesar')} className="rounded-lg border border-green-200 bg-green-50 py-2 text-sm font-semibold text-green-800 hover:bg-green-100">Pesar</button>
          </div>
        )}
      </div>
    </article>
  )
}

// ── Novo lote ───────────────────────────────────────────────────────────

function LotForm({ supplies, herd, lotNames, defaultPhase, onClose, onSaved }: {
  supplies: SupplyRef[]
  herd: HerdAnimal[]
  lotNames: Map<string, string>
  defaultPhase: string
  onClose: () => void
  onSaved: (lot: Lot) => void
}) {
  const [mode, setMode] = useState<'animais' | 'quantidade'>(herd.length ? 'animais' : 'quantidade')
  const [form, setForm] = useState({ name: '', phase: defaultPhase, startDate: todayISO(), headCount: '', avgWeight: '', targetWeight: '' })
  const [animalIds, setAnimalIds] = useState<string[]>([])
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [products, setProducts] = useState<ProductForm[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const chosen = herd.filter((a) => animalIds.includes(a.id))
  const avg = averageOf(Object.fromEntries(animalIds.map((id) => [id, weights[id] ?? ''])))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (mode === 'animais' && !animalIds.length) return setError('Escolha os animais do lote')
    if (mode === 'animais' && avg === null && !parseKg(form.avgWeight)) return setError('Informe o peso de entrada dos animais ou o peso médio do lote')
    setSaving(true)
    setError('')
    try {
      const base = { ...form, supplies: productsPayload(products) }
      const body = mode === 'animais'
        ? { ...base, animalIds, weights: Object.fromEntries(animalIds.map((id) => [id, weights[id] ?? ''])), headCount: animalIds.length }
        : base
      onSaved(await send('/api/lotes', 'POST', body))
    } catch (err) {
      setError(offlineMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Novo lote" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className={label}>Nome do lote
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Garrotes de julho" className={input} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          {LOT_PHASES.map((p) => (
            <button key={p.key} type="button" aria-pressed={form.phase === p.key} onClick={() => setForm({ ...form, phase: p.key })}
              className={`rounded-xl border-2 py-2.5 text-sm font-semibold ${form.phase === p.key ? 'border-green-700 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>{p.label}</button>
          ))}
        </div>
        <label className={label}>Data de entrada
          <input type="date" required max={todayISO()} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={input} />
        </label>

        <fieldset>
          <legend className={label}>Como você acompanha este lote?</legend>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {([['animais', 'Animais cadastrados', 'Peso de cada um'], ['quantidade', 'Só a quantidade', 'Peso médio do lote']] as const).map(([key, title, hint]) => (
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
                <p className={label}>Peso de entrada (opcional, mas é com ele que o app calcula o ganho de cada animal)</p>
                <div className="mt-1"><WeightList animals={chosen} weights={weights} onChange={setWeights} /></div>
                {avg !== null
                  ? <p className="mt-1 text-sm text-gray-700">Peso médio de entrada: <strong>{kg(avg)}</strong></p>
                  : <label className={`${label} mt-2`}>Sem pesar agora? Informe o peso médio estimado (kg)
                      <input inputMode="decimal" value={form.avgWeight} onChange={(e) => setForm({ ...form, avgWeight: decimal(e.target.value) })} placeholder="Ex.: 250" className={input} />
                    </label>}
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className={label}>Cabeças
              <input required inputMode="numeric" value={form.headCount} onChange={(e) => setForm({ ...form, headCount: e.target.value.replace(/\D/g, '') })} className={input} />
            </label>
            <label className={label}>Peso médio de entrada (kg)
              <input required inputMode="decimal" value={form.avgWeight} onChange={(e) => setForm({ ...form, avgWeight: decimal(e.target.value) })} placeholder="Ex.: 300" className={input} />
            </label>
          </div>
        )}

        <label className={label}>{form.phase === 'recria' ? 'Peso-alvo da recria por cabeça (kg, opcional)' : 'Peso de saída desejado por cabeça (kg, opcional)'}
          <input inputMode="decimal" value={form.targetWeight} onChange={(e) => setForm({ ...form, targetWeight: decimal(e.target.value) })} placeholder={form.phase === 'recria' ? 'Ex.: 320' : 'Ex.: 540'} className={input} />
        </label>
        <ProductsEditor supplies={supplies} value={products} onChange={setProducts} />
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700">Cancelar</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-green-700 py-3 font-semibold text-white disabled:bg-gray-300">{saving ? 'Salvando...' : 'Criar lote'}</button>
        </div>
      </form>
    </Modal>
  )
}
