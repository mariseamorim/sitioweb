'use client'

// Recibos do veterinário: emite com numeração própria, lista os emitidos e abre cada um numa folha para imprimir.
import { useCallback, useEffect, useState } from 'react'
import { BackLink } from '@/components/BackLink'
import { useDialog } from '@/components/DialogProvider'
import { todayISO } from '@/lib/utils'
import { useLocale, useT } from '@/lib/i18n'
import { StatTile } from '@/components/StatTile'
import { AppModal, modalButton } from '@/components/AppModal'
import { RelatorioIcon } from '@/components/ModuleIcons'

interface Receipt { id: string; number: number; payer: string; payerDoc: string | null; farmName: string | null; date: string; description: string; amount: number }
interface VetInfo { name: string; crmv: string | null; city: string | null; state: string | null; phone: string | null }

const input = 'mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
const money = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
const EMPTY = { payer: '', payerDoc: '', farmName: '', date: '', description: '', amount: '' }

export default function RecibosPage() {
  const { confirm, notify } = useDialog()
  const t = useT()
  const locale = useLocale()
  const day = (iso: string) => new Date(iso).toLocaleDateString(locale, { timeZone: 'UTC' })
  const longDay = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const [vet, setVet] = useState<VetInfo | null>(null)
  const [receipts, setReceipts] = useState<Receipt[] | null>(null)
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [open, setOpen] = useState<Receipt | null>(null)
  const [error, setError] = useState('')
  const [formError, setFormError] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/veterinario/recibos')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setError(data.error || t('Não foi possível carregar os recibos.'))
      setVet(data.vet)
      setReceipts(data.receipts)
    } catch {
      setError(t('Sem internet. Os recibos precisam de conexão.'))
    }
  }, [t])
  useEffect(() => { void load() }, [load])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    setFormError('')
    setSaving(true)
    try {
      const res = await fetch('/api/veterinario/recibos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setFormError(data.error || t('Não foi possível emitir o recibo.'))
      setForm(null)
      setOpen(data)
      await load()
    } catch {
      setFormError(t('Erro de conexão. Tente novamente.'))
    } finally {
      setSaving(false)
    }
  }

  async function remove(r: Receipt) {
    if (!(await confirm({ title: t('Apagar o recibo nº {n}?', { n: r.number }), message: `${r.payer} · ${money(r.amount)}. ${t('Use só para recibo emitido por engano.')}`, confirmLabel: t('Apagar recibo') }))) return
    const res = await fetch(`/api/veterinario/recibos/${r.id}`, { method: 'DELETE' })
    if (!res.ok) return notify(t('Não foi possível apagar'), (await res.json().catch(() => ({}))).error)
    setOpen(null)
    await load()
  }

  const total = receipts?.filter((r) => r.date.slice(0, 7) === todayISO().slice(0, 7)).reduce((sum, r) => sum + r.amount, 0) ?? 0

  return (
    <div className="max-w-3xl">
      <BackLink href="/consultoria" className="mb-2 -ml-2" />
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('Recibos')}</h1>
        </div>
        <button type="button" onClick={() => { setFormError(''); setForm({ ...EMPTY, date: todayISO() }) }} className="rounded-lg bg-green-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700">{t('+ Emitir recibo')}</button>
      </div>
      {/* Total do mês em recibos e quantos já foram emitidos */}
      {receipts && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <StatTile accent="green" label={t('Recebido no mês')} value={money(total)} />
          <StatTile accent="blue" label={t('Recibos emitidos')} value={receipts.length} />
        </div>
      )}
      {error && <p role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      {!receipts && !error && <p className="py-12 text-center text-gray-500">{t('Carregando…')}</p>}
      {receipts?.length === 0 && <p className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500">{t('Nenhum recibo emitido ainda.')}</p>}

      {!!receipts?.length && (
        <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {receipts.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setOpen(r)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50">
                <span className="min-w-0">
                  <span className="block font-medium text-gray-900 truncate">{t('Nº')} {r.number} · {r.payer}</span>
                  <span className="block text-sm text-gray-500 truncate">{day(r.date)}{r.farmName ? ` · ${r.farmName}` : ''} · {r.description}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-green-700">{money(r.amount)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {form && (
        <AppModal title={t('Emitir recibo')} subtitle={vet?.name} icon={<RelatorioIcon className="h-6 w-6" />} tone="blue" onClose={() => setForm(null)}
          footer={<>
            <button type="button" onClick={() => setForm(null)} className={modalButton.ghost}>{t('Fechar')}</button>
            <button type="submit" form="form-recibo" disabled={saving} className={modalButton.primary}>{t(saving ? 'Emitindo…' : 'Emitir recibo')}</button>
          </>}>
          <form id="form-recibo" onSubmit={submit} className="flex flex-col gap-4">
            <label className="text-sm font-medium text-gray-700">{t('Recebi de')} *<input value={form.payer} onChange={(e) => setForm({ ...form, payer: e.target.value })} required autoFocus placeholder={t('Ex.: João da Silva')} className={input} /></label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">{t('CPF ou CNPJ')}<input value={form.payerDoc} onChange={(e) => setForm({ ...form, payerDoc: e.target.value })} inputMode="numeric" placeholder={t('Ex.: 123.456.789-00')} className={input} /></label>
              <label className="text-sm font-medium text-gray-700">{t('Propriedade')}<input value={form.farmName} onChange={(e) => setForm({ ...form, farmName: e.target.value })} placeholder={t('Ex.: Sítio Boa Vista')} className={input} /></label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">{t('Valor (R$)')} *<input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required inputMode="decimal" placeholder="0,00" className={input} /></label>
              <label className="text-sm font-medium text-gray-700">{t('Data')} *<input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required className={input} /></label>
            </div>
            <label className="text-sm font-medium text-gray-700">{t('Referente a')} *<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required rows={3} placeholder={t('Diagnóstico de gestação em 32 vacas, inseminação…')} className={`${input} resize-none`} /></label>
            {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
          </form>
        </AppModal>
      )}

      {open && vet && (
        <AppModal title={t('Recibo nº {n}', { n: open.number })} subtitle={[open.payer, open.farmName].filter(Boolean).join(' · ')}
          icon={<RelatorioIcon className="h-6 w-6" />} tone="blue" onClose={() => setOpen(null)}
          footer={<>
            <button type="button" onClick={() => remove(open)} className={modalButton.danger}>{t('Apagar')}</button>
            <button type="button" onClick={() => setOpen(null)} className={modalButton.ghost}>{t('Fechar')}</button>
            <button type="button" onClick={() => window.print()} className={modalButton.primary}>{t('Imprimir')}</button>
          </>}>
            <article className="print-area border border-gray-400 p-6 text-gray-900">
              <div className="flex items-start justify-between gap-3 border-b border-gray-400 pb-3">
                <div><p className="text-xl font-bold">{t('RECIBO')}</p><p className="text-sm text-gray-700">{t('Nº')} {String(open.number).padStart(4, '0')}</p></div>
                <p className="text-2xl font-bold">{money(open.amount)}</p>
              </div>
              <p className="mt-5 leading-relaxed">
                {t('Recebi de')} <strong>{open.payer}</strong>{open.payerDoc ? `, ${t('CPF/CNPJ')} ${open.payerDoc}` : ''}{open.farmName ? `, ${open.farmName}` : ''}, {t('a importância de')} <strong>{money(open.amount)}</strong>, {t('referente a:')} {open.description}
              </p>
              <p className="mt-6 text-sm">{[vet.city, vet.state].filter(Boolean).join('/') || '____________'}, {longDay(open.date)}.</p>
              <div className="mt-14 mx-auto max-w-xs border-t border-gray-600 pt-1 text-center text-sm">
                <p className="font-semibold">{vet.name}</p>
                <p className="text-gray-700">{t('Médico(a) veterinário(a)')}{vet.crmv ? ` · ${t('CRMV')} ${vet.crmv}` : ''}</p>
                {vet.phone && <p className="text-gray-700">{vet.phone}</p>}
              </div>
            </article>
        </AppModal>
      )}
    </div>
  )
}
