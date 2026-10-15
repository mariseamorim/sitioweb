'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { PermissionGuard } from '@/components/PermissionGuard'
import { useDialog } from '@/components/DialogProvider'
import { useUser } from '@/contexts/UserContext'
import { FecharIcon } from '@/components/ModuleIcons'
import { LOT_PHASES, STOCK_WARNING_DAYS, Weighing, dailySupplyKg, daysBetween, daysOfStock, lotSummary, stockKg } from '@/lib/lots'
import { fmtDate, fmtNumber } from '@/lib/reports'
import { todayISO } from '@/lib/utils'

interface SupplyRef { id: string; name: string; unit: string; currentQuantity: number; packageKg: number | null }
interface Lot {
  id: string
  name: string
  phase: string
  startDate: string
  endDate: string | null
  supplyPercent: number | null
  notes: string | null
  supply: SupplyRef | null
  weighings: (Weighing & { id: string })[]
}

const input = 'mt-1 w-full border border-gray-300 rounded-xl px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
const label = 'block text-sm font-medium text-gray-700'
const phaseLabel = (p: string) => LOT_PHASES.find((x) => x.key === p)?.label ?? p
const kg = (n: number) => `${fmtNumber(n)} kg`
const decimal = (v: string) => v.replace(/[^\d.,]/g, '')

async function send(url: string, method: string, body: unknown) {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Não foi possível salvar')
  return data
}

export default function EngordaPage() {
  const { user, canAccess } = useUser()
  const canEdit = user?.role === 'admin' || user?.role === 'editor'
  const [lots, setLots] = useState<Lot[] | null>(null)
  const [supplies, setSupplies] = useState<SupplyRef[]>([])
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const today = todayISO()

  const load = useCallback(() => {
    fetch('/api/lotes').then((r) => (r.ok ? r.json() : Promise.reject())).then(setLots)
      .catch(() => setError('Não foi possível carregar os lotes. Confira a internet.'))
  }, [])
  useEffect(() => {
    load()
    if (canAccess('estoque')) fetch('/api/estoque').then((r) => (r.ok ? r.json() : [])).then(setSupplies).catch(() => {})
  }, [load, canAccess])

  const replace = (lot: Lot) => setLots((list) => (list ?? []).map((l) => (l.id === lot.id ? lot : l)))
  const open = lots?.filter((l) => !l.endDate) ?? []
  const closed = lots?.filter((l) => l.endDate) ?? []
  const current = lots?.find((l) => l.id === openId) ?? null

  return (
    <PermissionGuard module="animais">
      <div>
        <div className="page-toolbar mb-2 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Recria e engorda</h1>
          {canEdit && <button type="button" onClick={() => setCreating(true)} className="rounded-lg bg-green-700 px-4 py-2 text-sm font-medium text-white hover:bg-green-600">Novo lote</button>}
        </div>
        <p className="mb-6 text-sm text-gray-600">Acompanhe o peso de cada lote desde a entrada, o ganho por dia e o suplemento.</p>

        {error && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</p>}
        {!lots ? <p className="text-sm text-gray-400">Carregando...</p> : lots.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
            <p className="font-semibold text-gray-800">Nenhum lote ainda</p>
            <p className="mt-1 text-sm">Cadastre um lote com o peso médio de entrada. Depois, a cada pesagem, o app mostra quanto o lote ganhou.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {open.map((l) => <LotCard key={l.id} lot={l} today={today} onOpen={() => setOpenId(l.id)} />)}
            </div>
            {closed.length > 0 && (
              <section className="mt-8">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Encerrados</h2>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {closed.map((l) => <LotCard key={l.id} lot={l} today={today} onOpen={() => setOpenId(l.id)} />)}
                </div>
              </section>
            )}
          </>
        )}

        {creating && <LotForm supplies={supplies} onClose={() => setCreating(false)} onSaved={(lot) => { setLots((list) => [lot, ...(list ?? [])]); setCreating(false) }} />}
        {current && <LotDetail lot={current} supplies={supplies} canEdit={canEdit} today={today} onClose={() => setOpenId(null)}
          onChanged={replace} onDeleted={() => { setLots((list) => (list ?? []).filter((l) => l.id !== current.id)); setOpenId(null) }} />}
      </div>
    </PermissionGuard>
  )
}

// ── Cartão do lote ──────────────────────────────────────────────────────

function supplyLine(lot: Lot) {
  const s = lotSummary(lot.weighings, todayISO(), lot.endDate)
  const perDay = dailySupplyKg(s.last, lot.supplyPercent)
  if (!lot.supply || !perDay) return null
  const days = lot.endDate ? null : daysOfStock(stockKg(lot.supply), perDay)
  return { perDay, perHead: s.last ? Math.round((perDay / s.last.headCount) * 1000) : null, days }
}

function LotCard({ lot, today, onOpen }: { lot: Lot; today: string; onOpen: () => void }) {
  const s = lotSummary(lot.weighings, today, lot.endDate)
  const supply = supplyLine(lot)
  return (
    <button type="button" onClick={onOpen} className="rounded-xl border border-gray-100 bg-white p-5 text-left shadow-sm transition-colors hover:border-green-300">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-lg font-bold leading-tight text-gray-800">{lot.name}</h2>
        <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">{phaseLabel(lot.phase)}</span>
      </div>
      <p className="mt-1 text-sm text-gray-500">{s.last?.headCount ?? 0} cabeças · {s.days} dia{s.days === 1 ? '' : 's'}{lot.endDate ? ` · saiu em ${fmtDate(lot.endDate)}` : ''}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div><dt className="text-xs text-gray-500">Entrada</dt><dd className="font-semibold text-gray-800">{s.entry ? kg(s.entry.avgWeight) : '—'}</dd></div>
        <div><dt className="text-xs text-gray-500">Última pesagem</dt><dd className="font-semibold text-gray-800">{s.last ? kg(s.last.avgWeight) : '—'}</dd></div>
        <div><dt className="text-xs text-gray-500">Ganho por dia</dt><dd className="font-bold text-green-700">{s.gmd !== null ? `${fmtNumber(s.gmd, 3)} kg` : '—'}</dd></div>
      </dl>
      {s.gainKg === null
        ? <p className="mt-3 text-xs text-gray-500">Faça a próxima pesagem para ver o ganho.</p>
        : <p className="mt-3 text-sm text-gray-700">Ganhou <strong>{kg(s.gainKg)}</strong> por cabeça desde a entrada.</p>}
      {supply && (
        <p className={`mt-2 text-xs ${supply.days !== null && supply.days <= STOCK_WARNING_DAYS ? 'font-semibold text-amber-700' : 'text-gray-500'}`}>
          {lot.supply!.name}: {kg(supply.perDay)}/dia{supply.days !== null ? ` · estoque para ${supply.days} dia${supply.days === 1 ? '' : 's'}` : ''}
        </p>
      )}
    </button>
  )
}

// ── Novo lote ───────────────────────────────────────────────────────────

function SupplyFields({ supplies, value, onChange }: {
  supplies: SupplyRef[]
  value: { supplyId: string; supplyPercent: string; packageKg: string }
  onChange: (v: { supplyId: string; supplyPercent: string; packageKg: string }) => void
}) {
  const chosen = supplies.find((s) => s.id === value.supplyId)
  return (
    <fieldset className="rounded-xl border border-gray-200 p-3">
      <legend className="px-1 text-sm font-medium text-gray-700">Suplemento (opcional)</legend>
      {supplies.length === 0 ? (
        <p className="text-sm text-gray-500">Cadastre o suplemento no Estoque para o app calcular o consumo e avisar antes de acabar.</p>
      ) : (
        <>
          <label className={label}>Produto do estoque
            <select value={value.supplyId} onChange={(e) => onChange({ ...value, supplyId: e.target.value, packageKg: '' })} className={`${input} bg-white`}>
              <option value="">Nenhum</option>
              {supplies.map((s) => <option key={s.id} value={s.id}>{s.name} ({fmtNumber(s.currentQuantity, 0)} {s.unit})</option>)}
            </select>
          </label>
          {value.supplyId && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <label className={label}>Consumo (% do peso vivo)
                <input inputMode="decimal" value={value.supplyPercent} onChange={(e) => onChange({ ...value, supplyPercent: decimal(e.target.value) })} placeholder="Ex.: 0,1" className={input} />
              </label>
              {chosen?.unit === 'sacos' && (
                <label className={label}>Peso do saco (kg)
                  <input inputMode="decimal" value={value.packageKg} onChange={(e) => onChange({ ...value, packageKg: decimal(e.target.value) })} placeholder={chosen.packageKg ? fmtNumber(chosen.packageKg, 0) : 'Ex.: 25'} className={input} />
                </label>
              )}
            </div>
          )}
          {value.supplyId && <p className="mt-2 text-xs text-gray-500">Exemplo: a 0,1% do peso vivo, um animal de 300 kg come 300 g por dia.</p>}
        </>
      )}
    </fieldset>
  )
}

function LotForm({ supplies, onClose, onSaved }: { supplies: SupplyRef[]; onClose: () => void; onSaved: (lot: Lot) => void }) {
  const [form, setForm] = useState({ name: '', phase: 'engorda', startDate: todayISO(), headCount: '', avgWeight: '' })
  const [supply, setSupply] = useState({ supplyId: '', supplyPercent: '', packageKg: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      onSaved(await send('/api/lotes', 'POST', { ...form, ...supply }))
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : 'Sem internet. Os lotes precisam de conexão para salvar.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Novo lote" onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className={label}>Nome do lote
          <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex.: Novilhas C2 - março" className={input} />
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
        <div className="grid grid-cols-2 gap-3">
          <label className={label}>Cabeças
            <input required inputMode="numeric" value={form.headCount} onChange={(e) => setForm({ ...form, headCount: e.target.value.replace(/\D/g, '') })} className={input} />
          </label>
          <label className={label}>Peso médio de entrada (kg)
            <input required inputMode="decimal" value={form.avgWeight} onChange={(e) => setForm({ ...form, avgWeight: decimal(e.target.value) })} placeholder="Ex.: 300" className={input} />
          </label>
        </div>
        <SupplyFields supplies={supplies} value={supply} onChange={setSupply} />
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700">Cancelar</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-green-700 py-3 font-semibold text-white disabled:bg-gray-300">{saving ? 'Salvando...' : 'Cadastrar lote'}</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Detalhe: pesagens, suplemento, saída ────────────────────────────────

function LotDetail({ lot, supplies, canEdit, today, onClose, onChanged, onDeleted }: {
  lot: Lot
  supplies: SupplyRef[]
  canEdit: boolean
  today: string
  onClose: () => void
  onChanged: (lot: Lot) => void
  onDeleted: () => void
}) {
  const { confirm } = useDialog()
  const s = lotSummary(lot.weighings, today, lot.endDate)
  const supply = supplyLine(lot)
  const [weighing, setWeighing] = useState({ date: today, headCount: String(s.last?.headCount ?? ''), avgWeight: '' })
  const [editingSupply, setEditingSupply] = useState(false)
  const [supplyForm, setSupplyForm] = useState({ supplyId: lot.supply?.id ?? '', supplyPercent: lot.supplyPercent ? String(lot.supplyPercent).replace('.', ',') : '', packageKg: '' })
  const [endDate, setEndDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Ganho entre uma pesagem e a anterior
  const rows = useMemo(() => lot.weighings.map((w, i) => {
    const prev = lot.weighings[i - 1]
    const days = prev ? daysBetween(prev.date, w.date) : 0
    return { ...w, gmd: prev && days > 0 ? (w.avgWeight - prev.avgWeight) / days : null }
  }).reverse(), [lot.weighings])

  async function run(action: () => Promise<Lot | null>) {
    setBusy(true)
    setError('')
    try {
      const updated = await action()
      if (updated) onChanged(updated)
    } catch (err) {
      setError(navigator.onLine ? (err as Error).message : 'Sem internet. Os lotes precisam de conexão para salvar.')
    } finally {
      setBusy(false)
    }
  }

  const addWeighing = (e: React.FormEvent) => {
    e.preventDefault()
    void run(async () => {
      const updated = await send(`/api/lotes/${lot.id}/pesagens`, 'POST', weighing)
      setWeighing({ ...weighing, avgWeight: '' })
      return updated
    })
  }
  const removeWeighing = async (id: string) => {
    if (!(await confirm({ title: 'Apagar esta pesagem?', confirmLabel: 'Apagar', danger: true }))) return
    void run(() => send(`/api/lotes/${lot.id}/pesagens`, 'DELETE', { weighingId: id }))
  }
  const saveSupply = () => void run(async () => {
    const updated = await send(`/api/lotes/${lot.id}`, 'PATCH', supplyForm)
    setEditingSupply(false)
    return updated
  })
  const close = async () => {
    if (!(await confirm({ title: `Encerrar o lote ${lot.name}?`, message: 'Use quando o lote sair: vendido, abatido ou mudou de fase. Ele fica guardado em Encerrados.', confirmLabel: 'Encerrar' }))) return
    void run(() => send(`/api/lotes/${lot.id}`, 'PATCH', { endDate }))
  }
  const reopen = () => void run(() => send(`/api/lotes/${lot.id}`, 'PATCH', { endDate: null }))
  const remove = async () => {
    if (!(await confirm({ title: `Excluir o lote ${lot.name}?`, message: 'As pesagens também serão apagadas. Para guardar o histórico, prefira encerrar o lote.', confirmLabel: 'Excluir', danger: true }))) return
    setBusy(true)
    try { await send(`/api/lotes/${lot.id}`, 'DELETE', {}); onDeleted() } catch (err) { setError((err as Error).message); setBusy(false) }
  }

  return (
    <Modal title={lot.name} subtitle={`${phaseLabel(lot.phase)} · entrada em ${fmtDate(lot.startDate)}${lot.endDate ? ` · saiu em ${fmtDate(lot.endDate)}` : ''}`} onClose={onClose}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ['Entrada', s.entry ? kg(s.entry.avgWeight) : '—'],
          ['Última pesagem', s.last ? kg(s.last.avgWeight) : '—'],
          ['Ganho por cabeça', s.gainKg !== null ? kg(s.gainKg) : '—'],
          ['Ganho por dia', s.gmd !== null ? `${fmtNumber(s.gmd, 3)} kg` : '—'],
        ].map(([title, value]) => (
          <div key={title} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
            <p className="text-xs text-gray-500">{title}</p>
            <p className="text-lg font-bold text-gray-800">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm text-gray-600">{s.last?.headCount ?? 0} cabeças · {s.days} dia{s.days === 1 ? '' : 's'} no lote</p>

      <section className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Suplemento</h3>
        {editingSupply ? (
          <div className="flex flex-col gap-2">
            <SupplyFields supplies={supplies} value={supplyForm} onChange={setSupplyForm} />
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditingSupply(false)} className="flex-1 rounded-xl border border-gray-300 py-2.5 font-semibold text-gray-700">Cancelar</button>
              <button type="button" onClick={saveSupply} disabled={busy} className="flex-1 rounded-xl bg-green-700 py-2.5 font-semibold text-white disabled:bg-gray-300">Salvar</button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-100 p-3 text-sm text-gray-700">
            {lot.supply ? (
              <>
                <p><strong>{lot.supply.name}</strong>{lot.supplyPercent ? ` a ${fmtNumber(lot.supplyPercent, 2)}% do peso vivo` : ''}</p>
                {supply ? (
                  <p className="mt-1">
                    {kg(supply.perDay)} por dia para o lote{supply.perHead !== null ? ` (${fmtNumber(supply.perHead, 0)} g por cabeça)` : ''}.
                    {supply.days !== null && <span className={supply.days <= STOCK_WARNING_DAYS ? ' font-semibold text-amber-700' : ''}> O estoque dá para {supply.days} dia{supply.days === 1 ? '' : 's'}.</span>}
                  </p>
                ) : <p className="mt-1 text-gray-500">Informe o consumo em % do peso vivo para calcular quanto o lote come.</p>}
              </>
            ) : <p className="text-gray-500">Nenhum suplemento ligado a este lote.</p>}
            {canEdit && <button type="button" onClick={() => setEditingSupply(true)} className="mt-2 font-semibold text-green-700 hover:underline">{lot.supply ? 'Alterar' : 'Ligar suplemento'}</button>}
          </div>
        )}
      </section>

      <section className="mt-5">
        <h3 className="mb-2 text-sm font-semibold text-gray-700">Pesagens</h3>
        {canEdit && !lot.endDate && (
          <form onSubmit={addWeighing} className="mb-3 grid grid-cols-2 gap-2 rounded-lg bg-green-50 p-3 sm:grid-cols-4 sm:items-end">
            <label className="col-span-2 text-sm font-medium text-gray-700 sm:col-span-1">Data
              <input type="date" required max={today} value={weighing.date} onChange={(e) => setWeighing({ ...weighing, date: e.target.value })} className={input} />
            </label>
            <label className="text-sm font-medium text-gray-700">Cabeças
              <input required inputMode="numeric" value={weighing.headCount} onChange={(e) => setWeighing({ ...weighing, headCount: e.target.value.replace(/\D/g, '') })} className={input} />
            </label>
            <label className="text-sm font-medium text-gray-700">Peso médio (kg)
              <input required inputMode="decimal" value={weighing.avgWeight} onChange={(e) => setWeighing({ ...weighing, avgWeight: decimal(e.target.value) })} className={input} />
            </label>
            <button type="submit" disabled={busy} className="col-span-2 rounded-xl bg-green-700 py-3 font-semibold text-white disabled:bg-gray-300 sm:col-span-1">Salvar pesagem</button>
          </form>
        )}
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-right">Cab.</th><th className="px-3 py-2 text-right">Peso</th><th className="px-3 py-2 text-right whitespace-nowrap">Por dia</th>{canEdit && <th className="px-3 py-2" />}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((w, i) => (
                <tr key={w.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-gray-700">{fmtDate(w.date)}{i === rows.length - 1 && <span className="ml-1.5 text-xs text-gray-400">entrada</span>}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{w.headCount}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-gray-800">{kg(w.avgWeight)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-green-700">{w.gmd !== null ? `${fmtNumber(w.gmd, 3)} kg` : '—'}</td>
                  {canEdit && <td className="px-3 py-2 text-right">{i < rows.length - 1 && <button type="button" onClick={() => void removeWeighing(w.id)} className="text-xs font-semibold text-red-700 hover:underline">Apagar</button>}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {error && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {canEdit && (
        <section className="mt-6 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
          {lot.endDate ? (
            <button type="button" onClick={reopen} disabled={busy} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">Reabrir lote</button>
          ) : (
            <>
              <label className="text-sm font-medium text-gray-700">Data de saída
                <input type="date" max={today} min={lot.startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
              </label>
              <button type="button" onClick={() => void close()} disabled={busy} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">Encerrar lote</button>
            </>
          )}
          <button type="button" onClick={() => void remove()} disabled={busy} className="ml-auto text-sm font-semibold text-red-700 hover:underline">Excluir lote</button>
        </section>
      )}
    </Modal>
  )
}

function Modal({ title, subtitle, onClose, children }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label={title} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-800">{title}</h2>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="p-1 text-gray-400 hover:text-gray-600"><FecharIcon /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
