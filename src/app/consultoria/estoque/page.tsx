'use client'

// Estoque do próprio veterinário (medicamentos, sêmen, material), separado do estoque das propriedades:
// itens com saldo, mínimo e validade, e entradas e saídas com a propriedade onde foi usado.
import { VET_SUPPLY_KINDS } from '@/lib/vetSupplyKinds'
import { CATTLE_BREEDS } from '@/lib/animalRules'
import { useCallback, useEffect, useState } from 'react'
import { BackLink } from '@/components/BackLink'
import { useDialog } from '@/components/DialogProvider'
import { todayISO } from '@/lib/utils'
import { useLocale, useT } from '@/lib/i18n'
import { StatTile } from '@/components/StatTile'
import { AppModal, modalButton } from '@/components/AppModal'
import { EstoqueIcon } from '@/components/ModuleIcons'

interface Move { id: string; type: string; quantity: number; date: string; farmName: string | null; note: string | null }
interface Supply { id: string; name: string; kind?: string; bullName?: string | null; bullBreed?: string | null; semenBatch?: string | null; unit: string; quantity: number; minimum: number | null; expiry: string | null; moves: Move[] }
interface ItemForm { id?: string; name: string; kind: string; bullName: string; bullBreed: string; semenBatch: string; unit: string; quantity: string; minimum: string; expiry: string }
interface MoveForm { supply: Supply; type: 'entrada' | 'saida'; quantity: string; date: string; farmName: string; note: string }

const input = 'mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
const DAY = 24 * 60 * 60 * 1000
/** Validade a menos disso aparece como aviso */
const EXPIRY_WARNING_DAYS = 30

export default function EstoqueVeterinarioPage() {
  const { confirm, notify } = useDialog()
  const t = useT()
  const locale = useLocale()
  const num = (n: number) => n.toLocaleString(locale, { maximumFractionDigits: 2 })
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { timeZone: 'UTC' })
  const [supplies, setSupplies] = useState<Supply[] | null>(null)
  const [item, setItem] = useState<ItemForm | null>(null)
  const [move, setMove] = useState<MoveForm | null>(null)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)
  const today = todayISO()

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/veterinario/estoque')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || t('Não foi possível carregar o estoque.'))
      setSupplies(data)
    } catch {
      setError(t('Sem internet. O estoque precisa de conexão.'))
    }
  }, [t])
  useEffect(() => { void load() }, [load])

  async function send(url: string, method: 'POST' | 'PATCH', body: unknown, done: () => void) {
    setFormError('')
    setSaving(true)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) return setFormError((await res.json().catch(() => ({}))).error || t('Não foi possível salvar.'))
      done()
      await load()
    } catch {
      setFormError(t('Erro de conexão. Tente novamente.'))
    } finally {
      setSaving(false)
    }
  }

  async function remove(s: Supply) {
    if (!(await confirm({ title: t('Tirar {name} do estoque?', { name: s.name }), message: t('O item e o histórico de entradas e saídas dele são apagados.'), confirmLabel: t('Apagar item') }))) return
    const res = await fetch(`/api/veterinario/estoque/${s.id}`, { method: 'DELETE' })
    if (!res.ok) return notify(t('Não foi possível apagar'), (await res.json().catch(() => ({}))).error)
    await load()
  }

  /** Aviso do item: acabou, abaixo do mínimo, vencido ou perto de vencer */
  function warning(s: Supply): { text: string; tone: string } | null {
    if (s.expiry && s.expiry.slice(0, 10) < today) return { text: t('Vencido em {date}', { date: day(s.expiry) }), tone: 'bg-red-100 text-red-800' }
    if (s.quantity <= 0) return { text: t('Acabou'), tone: 'bg-red-100 text-red-800' }
    if (s.minimum !== null && s.quantity <= s.minimum) return { text: t('Abaixo do mínimo'), tone: 'bg-amber-100 text-amber-800' }
    if (s.expiry && (Date.parse(s.expiry.slice(0, 10)) - Date.parse(today)) / DAY <= EXPIRY_WARNING_DAYS) return { text: t('Vence em {date}', { date: day(s.expiry) }), tone: 'bg-amber-100 text-amber-800' }
    return null
  }

  const alerts = supplies?.filter((s) => warning(s)).length ?? 0

  return (
    <div className="max-w-3xl">
      <BackLink href="/consultoria" className="mb-2 -ml-2" />
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('Meu estoque')}</h1>
          <p className="text-gray-500">{t('Medicamentos, sêmen e material do veterinário')}</p>
        </div>
        <button type="button" onClick={() => { setFormError(''); setItem({ name: '', kind: 'semen', bullName: '', bullBreed: '', semenBatch: '', unit: 'doses', quantity: '', minimum: '', expiry: '' }) }} className="rounded-lg bg-green-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700">{t('+ Novo item')}</button>
      </div>
      {/* Quantos itens e quantos com aviso (acabou, abaixo do mínimo, vencido ou perto de vencer) */}
      {!!supplies?.length && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <StatTile accent="blue" label={t('Itens')} value={supplies.length} />
          <StatTile accent={alerts ? 'amber' : 'green'} label={t('Itens em alerta')} value={alerts} />
        </div>
      )}
      {error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {!supplies && !error && <p className="py-12 text-center text-gray-500">{t('Carregando…')}</p>}
      {supplies?.length === 0 && <p className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500">{t('Nenhum item ainda. Cadastre os medicamentos e materiais que você leva para as visitas.')}</p>}

      <ul className="flex flex-col gap-3">
        {supplies?.map((s) => {
          const w = warning(s)
          return (
            <li key={s.id} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900">{s.name} <span className="ml-1 rounded-full bg-amber-50 px-2 py-0.5 align-middle text-xs font-semibold text-amber-800 ring-1 ring-amber-200">{t(VET_SUPPLY_KINDS.find((k) => k.key === s.kind)?.label ?? 'Outro')}</span></p>
                  {s.kind === 'semen' && (s.bullName || s.bullBreed || s.semenBatch) && <p className="text-sm text-gray-600">{[s.bullName, s.bullBreed, s.semenBatch ? `${t('partida')} ${s.semenBatch}` : null].filter(Boolean).join(' · ')}</p>}
                  <p className="text-sm text-gray-500">{[s.minimum !== null ? t('mínimo {n} {unit}', { n: num(s.minimum), unit: s.unit }) : null, s.expiry ? t('validade {date}', { date: day(s.expiry) }) : null].filter(Boolean).join(' · ') || t('Sem mínimo nem validade')}</p>
                  {w && <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${w.tone}`}>{w.text}</span>}
                </div>
                <p className="shrink-0 text-right"><span className={`text-2xl font-bold tabular-nums ${s.quantity <= 0 ? 'text-red-700' : 'text-gray-900'}`}>{num(s.quantity)}</span> <span className="text-sm text-gray-500">{s.unit}</span></p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => { setFormError(''); setMove({ supply: s, type: 'saida', quantity: '', date: today, farmName: '', note: '' }) }} className="rounded-lg bg-green-800 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700">{t('Saída (usei)')}</button>
                <button type="button" onClick={() => { setFormError(''); setMove({ supply: s, type: 'entrada', quantity: '', date: today, farmName: '', note: '' }) }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Entrada (comprei)')}</button>
                <button type="button" onClick={() => { setFormError(''); setItem({ id: s.id, name: s.name, kind: s.kind ?? 'outro', bullName: s.bullName ?? '', bullBreed: s.bullBreed ?? '', semenBatch: s.semenBatch ?? '', unit: s.unit, quantity: '', minimum: s.minimum === null ? '' : String(s.minimum).replace('.', ','), expiry: s.expiry?.slice(0, 10) ?? '' }) }} className="rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100">{t('Editar')}</button>
                <button type="button" onClick={() => remove(s)} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">{t('Apagar')}</button>
              </div>
              {s.moves.length > 0 && (
                <details className="mt-2 text-sm">
                  <summary className="cursor-pointer text-gray-600 hover:text-gray-900">{t('Últimas movimentações')}</summary>
                  <ul className="mt-1 divide-y divide-gray-100">
                    {s.moves.map((m) => <li key={m.id} className="py-1.5 text-gray-700">{day(m.date)} · {t(m.type === 'entrada' ? 'entrada de' : 'saída de')} {num(m.quantity)} {s.unit}{m.farmName ? ` · ${m.farmName}` : ''}{m.note ? ` · ${m.note}` : ''}</li>)}
                  </ul>
                </details>
              )}
            </li>
          )
        })}
      </ul>

      {item && (
        <AppModal title={t(item.id ? 'Editar item' : 'Novo item')} subtitle={item.id ? item.name : undefined} icon={<EstoqueIcon className="h-6 w-6" />} tone="amber" onClose={() => setItem(null)}
          footer={<>
            <button type="button" onClick={() => setItem(null)} className={modalButton.ghost}>{t('Fechar')}</button>
            <button type="submit" form="form-item-estoque" disabled={saving} className={modalButton.primary}>{t(saving ? 'Salvando…' : 'Salvar')}</button>
          </>}>
          <form id="form-item-estoque" className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void send(item.id ? `/api/veterinario/estoque/${item.id}` : '/api/veterinario/estoque', item.id ? 'PATCH' : 'POST', item, () => setItem(null)) }}>
            <fieldset>
              <legend className="text-sm font-medium text-gray-700">{t('Tipo')}</legend>
              <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {VET_SUPPLY_KINDS.map((k) => (
                  <button key={k.key} type="button" aria-pressed={item.kind === k.key} onClick={() => setItem({ ...item, kind: k.key, unit: item.id ? item.unit : k.unit })}
                    className={`rounded-xl border-2 px-3 py-2 text-sm font-semibold ${item.kind === k.key ? 'border-amber-500 bg-amber-50 text-amber-900' : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}>{t(k.label)}</button>
                ))}
              </div>
            </fieldset>
            <label className="text-sm font-medium text-gray-700">{t('Nome')} *<input value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} required autoFocus placeholder={t('Prostaglandina, sêmen Touro X, luva…')} className={input} /></label>
            {item.kind === 'semen' && (
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-amber-200 bg-amber-50/50 p-3 sm:grid-cols-3">
                <label className="text-sm font-medium text-gray-700">{t('Touro')}<input value={item.bullName} onChange={(e) => setItem({ ...item, bullName: e.target.value })} placeholder={t('Ex.: Netuno FIV')} className={input} /></label>
                <label className="text-sm font-medium text-gray-700">{t('Raça do touro')}<input list="racas-semen" value={item.bullBreed} onChange={(e) => setItem({ ...item, bullBreed: e.target.value })} placeholder={t('Ex.: Gir, Holandesa')} className={input} />
                  <datalist id="racas-semen">{CATTLE_BREEDS.map((b) => <option key={b} value={b} />)}</datalist></label>
                <label className="text-sm font-medium text-gray-700">{t('Partida')}<input value={item.semenBatch} onChange={(e) => setItem({ ...item, semenBatch: e.target.value })} placeholder="Ex.: 2412-A" className={input} /></label>
                <p className="text-xs text-gray-600 sm:col-span-3">{t('Na cobertura, escolha este sêmen: o touro, a raça e a partida já entram e o estoque desconta 1 dose.')}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">{t('Unidade')}<input value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} placeholder={t('un, ml, dose, frasco')} maxLength={20} className={input} /></label>
              {!item.id && <label className="text-sm font-medium text-gray-700">{t('Quantidade que tenho')}<input value={item.quantity} onChange={(e) => setItem({ ...item, quantity: e.target.value })} inputMode="decimal" placeholder={t('Ex.: 10')} className={input} /></label>}
              <label className="text-sm font-medium text-gray-700">{t('Avisar abaixo de')}<input value={item.minimum} onChange={(e) => setItem({ ...item, minimum: e.target.value })} inputMode="decimal" placeholder={t('Ex.: 5')} className={input} /></label>
              <label className="text-sm font-medium text-gray-700">{t('Validade')}<input type="date" value={item.expiry} onChange={(e) => setItem({ ...item, expiry: e.target.value })} className={input} /></label>
            </div>
            {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          </form>
        </AppModal>
      )}

      {move && (
        <AppModal title={t(move.type === 'saida' ? 'Saída do estoque' : 'Entrada no estoque')} subtitle={move.supply.name} icon={<EstoqueIcon className="h-6 w-6" />} tone="amber" onClose={() => setMove(null)}
          footer={<>
            <button type="button" onClick={() => setMove(null)} className={modalButton.ghost}>{t('Fechar')}</button>
            <button type="submit" form="form-movimento-estoque" disabled={saving} className={modalButton.primary}>{t(saving ? 'Salvando…' : move.type === 'saida' ? 'Registrar saída' : 'Registrar entrada')}</button>
          </>}>
          <form id="form-movimento-estoque" className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); void send(`/api/veterinario/estoque/${move.supply.id}/movimentos`, 'POST', { type: move.type, quantity: move.quantity, date: move.date, farmName: move.farmName, note: move.note }, () => setMove(null)) }}>
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('Saldo:')} {num(move.supply.quantity)} {move.supply.unit}</p>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">{t('Quantidade')} ({move.supply.unit}) *<input value={move.quantity} onChange={(e) => setMove({ ...move, quantity: e.target.value })} required autoFocus inputMode="decimal" placeholder={t('Ex.: 10')} className={input} /></label>
              <label className="text-sm font-medium text-gray-700">{t('Data')}<input type="date" value={move.date} onChange={(e) => setMove({ ...move, date: e.target.value })} className={input} /></label>
            </div>
            {move.type === 'saida' && <label className="text-sm font-medium text-gray-700">{t('Propriedade onde usei')}<input value={move.farmName} onChange={(e) => setMove({ ...move, farmName: e.target.value })} placeholder={t('Ex.: Sítio Boa Vista')} className={input} /></label>}
            <label className="text-sm font-medium text-gray-700">{t('Observação')}<input value={move.note} onChange={(e) => setMove({ ...move, note: e.target.value })} maxLength={300} placeholder={t('Ex.: lote das novilhas')} className={input} /></label>
            {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          </form>
        </AppModal>
      )}
    </div>
  )
}
