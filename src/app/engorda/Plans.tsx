'use client'

// Planos de recria/engorda: lista, formulário (etapas com GMD, dias e peso) e a escolha do plano no lote

import { useState } from 'react'
import { useDialog } from '@/components/DialogProvider'
import { MAX_STAGES, planDays, type LotPlan } from '@/lib/lotPlans'
import { fmtNumber } from '@/lib/reports'
import { useT } from '@/lib/i18n'
import { Modal, decimal, input, isQueued, kg, label, offlineMessage, send, toField } from './shared'

/** Ordem da lista: ativos primeiro, depois pelo nome (igual ao servidor) */
export const sortPlans = (list: LotPlan[]) => [...list].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name))

export function PlansPanel({ plans, canEdit, onSaved, onDeleted, onQueued }: {
  plans: LotPlan[] | null
  canEdit: boolean
  onSaved: (plan: LotPlan) => void
  onDeleted: (id: string) => void
  /** Sem internet ou sinal fraco: o pedido ficou na fila do aparelho */
  onQueued: (message: string) => void
}) {
  const t = useT()
  const { confirm } = useDialog()
  // null = fechado; 'novo' = plano novo; plano = editar
  const [editing, setEditing] = useState<LotPlan | 'novo' | null>(null)
  const [error, setError] = useState('')

  const remove = async (plan: LotPlan) => {
    if (!(await confirm({ title: t('Excluir o plano {name}?', { name: plan.name }), message: t('Os lotes que usam este plano ficam sem plano. As pesagens e despesas continuam.'), confirmLabel: t('Excluir'), danger: true }))) return
    setError('')
    try {
      await send(`/api/lotes/planos/${plan.id}`, 'DELETE', {})
      onDeleted(plan.id)
    } catch (err) {
      if (isQueued(err)) onQueued(`${t(err.message)} ${t('O plano some da lista depois do envio.')}`)
      else setError(t((err as Error).message))
    }
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">{t('O plano diz quanto o lote deve ganhar por dia em cada etapa e a meta de peso. No desempenho do lote, o app compara o peso real com o esperado.')}</p>
        {canEdit && <button type="button" onClick={() => setEditing('novo')} className="shrink-0 rounded-lg bg-green-800 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700">{t('Novo plano')}</button>}
      </div>
      {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!plans ? <p className="text-sm text-gray-400">{t('Carregando...')}</p> : plans.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">
          <p className="font-semibold text-gray-800">{t('Nenhum plano ainda')}</p>
          <p className="mt-1 text-sm">{t('Crie um plano com as etapas (cria, recria, engorda), o ganho por dia esperado em cada uma e a meta de peso. Depois escolha o plano no lote.')}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="whitespace-nowrap bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-3 py-2 text-left">{t('Nome do plano')}</th>
                <th className="px-3 py-2 text-right">{t('Duração (dias)')}</th>
                <th className="px-3 py-2 text-right">{t('Meta de peso')}</th>
                <th className="px-3 py-2 text-left">{t('Situação')}</th>
                {canEdit && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {plans.map((p) => {
                const days = planDays(p)
                return (
                  <tr key={p.id}>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-gray-900">{p.name}</span>
                      {p.description && <span className="block max-w-xs truncate text-xs text-gray-500">{p.description}</span>}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-800">{days > 0 ? days : '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-800">{p.targetWeight ? kg(p.targetWeight) : '—'}</td>
                    <td className="px-3 py-2">
                      <span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ${p.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{t(p.active ? 'Ativo' : 'Inativo')}</span>
                    </td>
                    {canEdit && (
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <button type="button" onClick={() => setEditing(p)} className="text-xs font-semibold text-green-700 hover:underline">{t('Editar')}</button>
                        <button type="button" onClick={() => void remove(p)} className="ml-4 text-xs font-semibold text-red-700 hover:underline">{t('Excluir')}</button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <PlanForm plan={editing === 'novo' ? null : editing} onClose={() => setEditing(null)}
          onSaved={(plan) => { setEditing(null); onSaved(plan) }}
          onQueued={(message) => { setEditing(null); onQueued(message) }} />
      )}
    </section>
  )
}

// ── Formulário do plano ─────────────────────────────────────────────────

interface StageForm { name: string; gmd: string; days: string; weight: string }
const EMPTY_STAGE: StageForm = { name: '', gmd: '', days: '', weight: '' }

function PlanForm({ plan, onClose, onSaved, onQueued }: { plan: LotPlan | null; onClose: () => void; onSaved: (plan: LotPlan) => void; onQueued: (message: string) => void }) {
  const t = useT()
  const [form, setForm] = useState({
    name: plan?.name ?? '',
    active: plan?.active ?? true,
    description: plan?.description ?? '',
    targetWeight: toField(plan?.targetWeight),
  })
  // Sempre as 5 linhas de etapa; as vazias não são gravadas
  const [stages, setStages] = useState<StageForm[]>(() => Array.from({ length: MAX_STAGES }, (_, i) => {
    const s = plan?.stages[i]
    return s ? { name: s.name, gmd: toField(s.gmd), days: s.days ? String(s.days) : '', weight: toField(s.weight) } : EMPTY_STAGE
  }))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const setStage = (i: number, patch: Partial<StageForm>) => setStages((list) => list.map((s, j) => (j === i ? { ...s, ...patch } : s)))
  const totalDays = stages.reduce((sum, s) => sum + (Number(s.days) || 0), 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const body = { ...form, stages: stages.filter((s) => s.name.trim() || s.gmd || s.days || s.weight) }
      onSaved(await send<LotPlan>(plan ? `/api/lotes/planos/${plan.id}` : '/api/lotes/planos', plan ? 'PUT' : 'POST', body))
    } catch (err) {
      if (isQueued(err)) onQueued(`${t(err.message)} ${t('O plano aparece na lista depois do envio.')}`)
      else setError(t(offlineMessage(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title={t(plan ? 'Editar plano' : 'Novo plano')} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <label className={label}>{t('Nome')} *
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('Ex.: Engorda a pasto com suplemento')} className={input} />
          </label>
          <fieldset>
            <legend className={label}>{t('Situação')}</legend>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {([[true, t('Ativo')], [false, t('Inativo')]] as const).map(([value, text]) => (
                <button key={text} type="button" aria-pressed={form.active === value} onClick={() => setForm({ ...form, active: value })}
                  className={`rounded-xl border-2 px-4 py-2.5 text-sm font-semibold ${form.active === value ? 'border-green-700 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>{text}</button>
              ))}
            </div>
          </fieldset>
        </div>
        <label className={label}>{t('Descrição')}
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className={input} />
        </label>

        <fieldset className="rounded-xl border border-gray-200 p-3">
          <legend className="px-1 text-sm font-medium text-gray-700">{t('Informe o ganho médio diário (GMD) em cada etapa')}</legend>
          <ol className="space-y-3">
            {stages.map((s, i) => (
              <li key={i} className="rounded-lg bg-gray-50 p-3">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Etapa {n}', { n: i + 1 })}</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="col-span-2 text-xs font-medium text-gray-600 sm:col-span-1">{t('Etapa')}
                    <input value={s.name} onChange={(e) => setStage(i, { name: e.target.value })} placeholder={t('cria, recria, engorda…')} className={input} />
                  </label>
                  <label className="text-xs font-medium text-gray-600">{t('GMD (kg/dia)')}
                    <input inputMode="decimal" value={s.gmd} onChange={(e) => setStage(i, { gmd: decimal(e.target.value) })} placeholder={t('Ex.: 0,8')} className={input} />
                  </label>
                  <label className="text-xs font-medium text-gray-600">{t('Tempo (dias)')}
                    <input inputMode="numeric" value={s.days} onChange={(e) => setStage(i, { days: e.target.value.replace(/\D/g, '') })} placeholder={t('Ex.: 90')} className={input} />
                  </label>
                  <label className="col-span-2 text-xs font-medium text-gray-600 sm:col-span-1">{t('Peso (kg)')}
                    <input inputMode="decimal" value={s.weight} onChange={(e) => setStage(i, { weight: decimal(e.target.value) })} placeholder={t('Ex.: 380')} className={input} />
                  </label>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-gray-500">{t('Preencha só as etapas que usar. Duração do plano: {n} dias.', { n: totalDays })}</p>
        </fieldset>

        <label className={label}>{t('Meta de peso final (kg)')}
          <input inputMode="decimal" value={form.targetWeight} onChange={(e) => setForm({ ...form, targetWeight: decimal(e.target.value) })} placeholder={t('Ex.: 540')} className={`${input} sm:w-48`} />
        </label>
        {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-gray-300 py-3 font-semibold text-gray-700">{t('Cancelar')}</button>
          <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-green-800 py-3 font-semibold text-white hover:bg-green-700 disabled:bg-gray-300">{t(saving ? 'Salvando...' : 'Salvar plano')}</button>
        </div>
      </form>
    </Modal>
  )
}

// ── Escolher o plano do lote (novo lote e editar lote) ──────────────────

/** Select com os planos ativos (e o plano atual do lote, mesmo inativo). Ao escolher, devolve o plano para quem chamou preencher a meta. */
export function PlanSelect({ plans, value, onChange }: { plans: LotPlan[]; value: string; onChange: (planId: string, plan: LotPlan | null) => void }) {
  const t = useT()
  const options = plans.filter((p) => p.active || p.id === value)
  return (
    <label className={label}>{t('Plano (opcional)')}
      <select value={value} onChange={(e) => onChange(e.target.value, plans.find((p) => p.id === e.target.value) ?? null)} className={`${input} bg-white`}>
        <option value="">{t('— Nenhum —')}</option>
        {options.map((p) => {
          const days = planDays(p)
          return <option key={p.id} value={p.id}>{p.name}{days > 0 ? ` · ${t('{n} dias', { n: days })}` : ''}{p.targetWeight ? ` · ${fmtNumber(p.targetWeight, 0)} kg` : ''}{p.active ? '' : ` (${t('Inativo')})`}</option>
        })}
      </select>
      {options.length === 0 && <span className="mt-1 block text-xs font-normal text-gray-500">{t('Nenhum plano ativo. Crie em Recria e engorda > Planos.')}</span>}
    </label>
  )
}
