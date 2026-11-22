'use client'

import { useEffect, useMemo, useState } from 'react'
import { useDialog } from '@/components/DialogProvider'
import {
  LIVE_KG_PER_ARROBA, LOT_PHASES, STOCK_WARNING_DAYS, Weighing, animalGain, arrobasProduced, dailySupplyKg, daysBetween,
  feedingSummary, kgInStockUnit, lotSummary, pricePerKg, projectTarget,
} from '@/lib/lots'
import { fmtDate, fmtMoney, fmtNumber } from '@/lib/reports'
import { COVERAGE_METHODS, GESTATION_DAYS, isInsemination, methodLabel, plusDays } from '@/lib/coverage'
import {
  AnimalPicker, Coverage, HerdAnimal, Lot, LotAnimal, Modal, ProductForm, ProductsEditor, SupplyRef, WeightList, averageOf, decimal, input, kg, label,
  isQueued, lastWeight, moneyField, offlineMessage, parseKg, phaseLabel, productLines, productsFromLot, productsPayload, send, tag, toField,
} from './shared'
import { useLocale, useT, type Vars } from '@/lib/i18n'
import type { LotPlan } from '@/lib/lotPlans'
import { LotPerformance } from './LotPerformance'
import { PlanSelect } from './Plans'

/** Roda uma ação do lote. `onQueued` fecha o formulário quando o pedido ficou na fila do aparelho (não há lote atualizado para mostrar). */
type Run = (action: () => Promise<Lot | null>, onQueued?: () => void) => Promise<void>

export function LotDetail({ lot, supplies, herd, lotNames, plans, canEdit, canBreed, today, focus, onClose, onChanged, onDeleted, onReload, onQueued }: {
  lot: Lot
  supplies: SupplyRef[]
  herd: HerdAnimal[]
  lotNames: Map<string, string>
  /** Planos de recria/engorda, para escolher no editar lote */
  plans: LotPlan[]
  canEdit: boolean
  /** Pode registrar cio e cobertura (módulo Reprodução) */
  canBreed: boolean
  today: string
  focus?: 'pesar' | 'animais'
  onClose: () => void
  onChanged: (lot: Lot) => void
  onDeleted: () => void
  /** Recarrega os lotes (depois de registrar uma cobertura, que não devolve o lote) */
  onReload: () => void
  /** Um pedido ficou na fila do aparelho (a página atualiza a contagem) */
  onQueued?: () => void
}) {
  const { confirm } = useDialog()
  const t = useT()
  const s = lotSummary(lot.weighings, today, lot.endDate)
  const isRecria = lot.phase === 'recria'
  const arrobas = isRecria ? null : arrobasProduced(s)
  const projection = lot.endDate ? null : projectTarget(s, lot.targetWeight)
  const hasAnimals = lot.animals.length > 0
  const females = lot.animals.filter((a) => a.gender === 'Fêmea')
  const [weighing, setWeighing] = useState({ date: today, headCount: String(s.last?.headCount ?? ''), avgWeight: '' })
  const [weights, setWeights] = useState<Record<string, string>>({})
  const [adding, setAdding] = useState<string[] | null>(focus === 'animais' ? [] : null)
  const [editingLot, setEditingLot] = useState(false)
  const [tab, setTab] = useState<LotTab>(focus === 'pesar' ? 'pesagens' : focus === 'animais' ? 'animais' : 'resumo')
  const [editingProducts, setEditingProducts] = useState<ProductForm[] | null>(null)
  const [target, setTarget] = useState(toField(lot.targetWeight))
  const [endDate, setEndDate] = useState(today)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const previous = useMemo(() => new Map(lot.animals.flatMap((a) => { const w = lastWeight(a); return w === null ? [] : [[a.id, w] as const] })), [lot.animals])

  useEffect(() => {
    if (focus === 'pesar') document.getElementById('pesagem')?.scrollIntoView({ block: 'start' })
  }, [focus])

  const run: Run = async (action, afterQueued) => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const updated = await action()
      if (updated) onChanged(updated)
    } catch (err) {
      if (isQueued(err)) {
        // Ficou na fila: avisa e fecha o formulário, mas não inventa um lote atualizado
        setNotice(t(err.message))
        afterQueued?.()
        onQueued?.()
      } else {
        setError(t(offlineMessage(err)))
      }
    } finally {
      setBusy(false)
    }
  }

  const saveWeighing = (e: React.FormEvent) => {
    e.preventDefault()
    const reset = () => { setWeights({}); setWeighing({ ...weighing, avgWeight: '' }) }
    void run(async () => {
      const updated = await send(`/api/lotes/${lot.id}/pesagens`, 'POST', hasAnimals ? { date: weighing.date, weights } : weighing)
      reset()
      return updated
    }, reset)
  }
  const addAnimals = () => void run(async () => {
    const updated = await send(`/api/lotes/${lot.id}`, 'PATCH', { addAnimalIds: adding })
    setAdding(null)
    return updated
  }, () => setAdding(null))
  const removeAnimal = async (a: LotAnimal) => {
    if (!(await confirm({ title: t('Tirar {animal} do lote?', { animal: `${tag(a)} ${a.name}` }), message: t('As pesagens dele continuam guardadas.'), confirmLabel: t('Tirar do lote') }))) return
    void run(() => send(`/api/lotes/${lot.id}`, 'PATCH', { removeAnimalIds: [a.id] }))
  }
  const saveTarget = () => void run(() => send(`/api/lotes/${lot.id}`, 'PATCH', { targetWeight: target }))
  const saveProducts = () => void run(async () => {
    const updated = await send(`/api/lotes/${lot.id}`, 'PATCH', { supplies: productsPayload(editingProducts ?? []) })
    setEditingProducts(null)
    return updated
  }, () => setEditingProducts(null))
  const close = async () => {
    if (!(await confirm({ title: t('Encerrar o lote {name}?', { name: lot.name }), message: t('Use quando o lote sair: vendido, abatido ou mudou de fase. Ele fica guardado em Encerrados.'), confirmLabel: t('Encerrar') }))) return
    void run(() => send(`/api/lotes/${lot.id}`, 'PATCH', { endDate }))
  }
  const reopen = () => void run(() => send(`/api/lotes/${lot.id}`, 'PATCH', { endDate: null }))
  const remove = async () => {
    if (!(await confirm({ title: t('Excluir o lote {name}?', { name: lot.name }), message: t('As pesagens também serão apagadas e os animais saem do lote. Para guardar o histórico, prefira encerrar o lote.'), confirmLabel: t('Excluir'), danger: true }))) return
    setBusy(true)
    setNotice('')
    try {
      await send(`/api/lotes/${lot.id}`, 'DELETE', {})
      onDeleted()
    } catch (err) {
      if (isQueued(err)) { setNotice(`${t(err.message)} ${t('O lote some da lista depois do envio.')}`); onQueued?.() } else setError(t((err as Error).message))
      setBusy(false)
    }
  }

  const open = !lot.endDate
  const tabs: [LotTab, string][] = [
    ['resumo', t('Resumo')],
    ['pesagens', t('Pesagens')],
    ['animais', t(isRecria && females.length ? 'Animais e reprodução' : 'Animais')],
    ['trato', t('Trato e produtos')],
    ['desempenho', t('Desempenho')],
  ]
  const actionBtn = 'inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold'
  const outlineBtn = `${actionBtn} border-2 border-green-700 text-green-800 hover:bg-green-50`

  return (
    <Modal title={lot.name} subtitle={`${t(phaseLabel(lot.phase))} · ${t('entrada em {date}', { date: fmtDate(lot.startDate) })}${lot.endDate ? ` · ${t('saiu em {date}', { date: fmtDate(lot.endDate) })}` : ''}`} onClose={onClose}>
      {/* Ações principais sempre à vista */}
      {canEdit && !editingLot && (
        <div className="-mt-1 mb-4 flex flex-wrap gap-2">
          {open && <button type="button" onClick={() => setTab('pesagens')} className={`${actionBtn} bg-green-700 text-white hover:bg-green-600`}>⚖️ {t('Pesar')}</button>}
          {open && lot.supplies.length > 0 && <button type="button" onClick={() => setTab('trato')} className={`${actionBtn} bg-amber-600 text-white hover:bg-amber-500`}>🌾 {t('Dar trato')}</button>}
          <button type="button" onClick={() => setEditingLot(true)} className={outlineBtn}>✏️ {t('Editar lote')}</button>
        </div>
      )}
      {canEdit && editingLot && <LotEditForm lot={lot} plans={plans} busy={busy} run={run} onDone={() => setEditingLot(false)} onTarget={setTarget} />}

      {/* Abas: cada assunto numa tela, em vez de tudo numa coluna só */}
      <nav className="-mx-1 mb-4 flex gap-1 overflow-x-auto border-b border-gray-200 px-1" aria-label={t('Seções do lote')}>
        {tabs.map(([key, title]) => (
          <button key={key} type="button" onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold ${tab === key ? 'border-green-700 text-green-800' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            {title}
          </button>
        ))}
      </nav>

      {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}

      {tab === 'resumo' && (
        <>
          <div className={`grid grid-cols-2 gap-2 ${isRecria ? 'sm:grid-cols-4' : 'sm:grid-cols-5 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1'}`}>
            {[
              [t('Cabeças'), String(hasAnimals ? lot.animals.length : s.last?.headCount ?? 0)],
              [t('Peso atual'), s.last ? kg(s.last.avgWeight) : '—'],
              [t('Ganho por cabeça'), s.gainKg !== null ? kg(s.gainKg) : '—'],
              [t('Ganho por dia'), s.gmd !== null ? `${fmtNumber(s.gmd, 3)} kg` : '—'],
              ...(isRecria ? [] : [[t('@ produzidas'), arrobas !== null ? fmtNumber(arrobas) : '—']]),
            ].map(([title, value]) => (
              <div key={title} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                <p className="text-xs text-gray-500">{title}</p>
                <p className="text-lg font-bold text-gray-800">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            {s.days === 1 ? t('1 dia no lote') : t('{n} dias no lote', { n: s.days })}{s.entry ? ` · ${t('entrou com {weight}', { weight: kg(s.entry.avgWeight) })}` : ''}
            {arrobas !== null && <span className="text-gray-500"> · {t('arrobas estimadas pelo peso vivo ({kg} kg = 1 @, rendimento de 50%)', { kg: LIVE_KG_PER_ARROBA })}</span>}
          </p>

          {/* Peso-alvo: na engorda é a saída para o abate; na recria, o peso para ir para a reprodução ou a engorda */}
          <section className="mt-5">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">{t(isRecria ? 'Peso-alvo da recria' : 'Previsão de saída para o abate')}</h3>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-sm font-medium text-gray-700">{t(isRecria ? 'Peso desejado por cabeça (kg)' : 'Peso de saída desejado (kg)')}
                <input inputMode="decimal" value={target} onChange={(e) => setTarget(decimal(e.target.value))} placeholder={t(isRecria ? 'Ex.: 320' : 'Ex.: 540')} disabled={!canEdit} className={`${input} w-40`} />
              </label>
              {canEdit && target !== toField(lot.targetWeight) && (
                <button type="button" onClick={saveTarget} disabled={busy} className="rounded-xl bg-green-700 px-4 py-2.5 font-semibold text-white disabled:bg-gray-300">{t('Salvar')}</button>
              )}
            </div>
            {lot.targetWeight && s.last && (
              s.last.avgWeight >= lot.targetWeight
                ? <p className="mt-2 rounded-lg bg-green-50 p-3 text-sm font-semibold text-green-800">{t('O lote já chegou ao peso desejado ({weight}).', { weight: kg(s.last.avgWeight) })}</p>
                : projection
                  ? <div className="mt-3 grid grid-cols-3 gap-2">
                      {[[t('Faltam'), kg(projection.remainingKg)], [t('Dias restantes'), String(projection.days)], [t(isRecria ? 'Chega em' : 'Previsão de saída'), fmtDate(projection.date)]].map(([title, value]) => (
                        <div key={title} className="rounded-lg border border-amber-100 bg-amber-50 p-3"><p className="text-xs text-amber-900">{title}</p><p className="whitespace-nowrap text-base font-bold text-amber-900 sm:text-lg">{value}</p></div>
                      ))}
                    </div>
                  : <p className="mt-2 text-sm text-gray-500">{t('Faça mais uma pesagem para o app calcular o ganho por dia e prever quando chega.')}</p>
            )}
            {lot.weighings.length > 0 && <div className="mt-3"><ProjectionChart weighings={lot.weighings} projection={projection} target={lot.targetWeight} /></div>}
          </section>

          {canEdit && (
            <section className="mt-6 flex flex-wrap items-end gap-3 border-t border-gray-100 pt-4">
              {lot.endDate ? (
                <button type="button" onClick={reopen} disabled={busy} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">{t('Reabrir lote')}</button>
              ) : (
                <>
                  <label className="text-sm font-medium text-gray-700">{t('Data de saída')}
                    <input type="date" max={today} min={lot.startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} className={input} />
                  </label>
                  <button type="button" onClick={() => void close()} disabled={busy} className="rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-semibold text-gray-700">{t('Encerrar lote')}</button>
                </>
              )}
              <button type="button" onClick={() => void remove()} disabled={busy} className="ml-auto text-sm font-semibold text-red-700 hover:underline">{t('Excluir lote')}</button>
            </section>
          )}
        </>
      )}

      {tab === 'pesagens' && (
        <>
          {canEdit && open && (
            <section id="pesagem" className="scroll-mt-4">
              <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('Nova pesagem')}</h3>
              <form onSubmit={saveWeighing} className="rounded-xl bg-green-50 p-3">
                <label className="text-sm font-medium text-gray-700">{t('Data')}
                  <input type="date" required max={today} value={weighing.date} onChange={(e) => setWeighing({ ...weighing, date: e.target.value })} className={`${input} sm:w-56`} />
                </label>
                {hasAnimals ? (
                  <div className="mt-3">
                    <WeightList animals={lot.animals} weights={weights} onChange={setWeights} previous={previous} />
                    {averageOf(weights) !== null && <p className="mt-2 text-sm text-gray-700">{t('Peso médio desta pesagem:')} <strong>{kg(averageOf(weights)!)}</strong></p>}
                  </div>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-sm font-medium text-gray-700">{t('Cabeças')}
                      <input required inputMode="numeric" value={weighing.headCount} onChange={(e) => setWeighing({ ...weighing, headCount: e.target.value.replace(/\D/g, '') })} className={input} />
                    </label>
                    <label className="text-sm font-medium text-gray-700">{t('Peso médio (kg)')}
                      <input required inputMode="decimal" value={weighing.avgWeight} onChange={(e) => setWeighing({ ...weighing, avgWeight: decimal(e.target.value) })} className={input} />
                    </label>
                  </div>
                )}
                <button type="submit" disabled={busy || (hasAnimals && averageOf(weights) === null)} className="mt-3 w-full rounded-xl bg-green-700 py-3 font-semibold text-white disabled:bg-gray-300">{t('Salvar pesagem')}</button>
              </form>
            </section>
          )}
          <WeighingHistory lot={lot} canEdit={canEdit} today={today} busy={busy} run={run} />
        </>
      )}

      {tab === 'animais' && (
        <>
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-700">{t('Animais do lote')}</h3>
              {canEdit && open && adding === null && <button type="button" onClick={() => setAdding([])} className={outlineBtn}>+ {t('Pôr animais no lote')}</button>}
            </div>
            {adding !== null && (
              <div className="mb-3 rounded-xl border border-gray-200 p-3">
                <AnimalPicker herd={herd} lotNames={lotNames} exclude={lot.animals.map((a) => a.id)} selected={adding} onChange={setAdding} />
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => setAdding(null)} className="flex-1 rounded-xl border border-gray-300 py-2.5 font-semibold text-gray-700">{t('Cancelar')}</button>
                  <button type="button" onClick={addAnimals} disabled={busy || adding.length === 0} className="flex-1 rounded-xl bg-green-700 py-2.5 font-semibold text-white disabled:bg-gray-300">{t('Pôr no lote')}</button>
                </div>
              </div>
            )}
            {hasAnimals ? (
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-sm">
                  <thead className="whitespace-nowrap bg-gray-50 text-xs uppercase text-gray-500">
                    <tr><th className="px-3 py-2 text-left">{t('Animal')}</th><th className="px-3 py-2 text-right">{t('Entrada')}</th><th className="px-3 py-2 text-right">{t('Último')}</th><th className="px-3 py-2 text-right">{t('Por dia')}</th>{canEdit && open && <th className="px-3 py-2" />}</tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lot.animals.map((a) => {
                      // Ganho só desde a entrada neste lote (o animal pode ter vindo de outro)
                      const g = animalGain(a.weighings.filter((w) => w.date >= lot.startDate))
                      return (
                        <tr key={a.id}>
                          <td className="px-3 py-2"><span className="font-semibold text-gray-900">{tag(a)}</span> <span className="text-gray-600">{a.name}</span></td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-gray-600">{g.entry ? kg(g.entry.weight) : '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right font-medium text-gray-800">{g.last ? kg(g.last.weight) : '—'}</td>
                          <td className="whitespace-nowrap px-3 py-2 text-right text-green-700">{g.gmd !== null ? `${fmtNumber(g.gmd, 3)} kg` : '—'}</td>
                          {canEdit && open && <td className="px-3 py-2 text-right"><button type="button" onClick={() => void removeAnimal(a)} className="rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">{t('Tirar')}</button></td>}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ) : adding === null && <p className="text-sm text-gray-500">{t('Este lote acompanha só a quantidade e o peso médio. Para pesar cada animal, ponha os animais cadastrados no lote.')}</p>}
          </section>
          {/* Recria: cio e cobertura das novilhas */}
          {isRecria && females.length > 0 && (
            <ReproductionSection females={females} today={today} canEdit={canBreed && open} onSaved={onReload} />
          )}
        </>
      )}

      {tab === 'trato' && (
        <>
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-700">{t('Produtos do lote')}</h3>
              {canEdit && !editingProducts && (
                <button type="button" onClick={() => setEditingProducts(productsFromLot(lot))} className={outlineBtn}>
                  {lot.supplies.length ? `✏️ ${t('Alterar produtos')}` : `+ ${t('Ligar produtos')}`}
                </button>
              )}
            </div>
            {editingProducts ? (
              <div className="flex flex-col gap-2">
                <ProductsEditor supplies={supplies} value={editingProducts} onChange={setEditingProducts} />
                <div className="flex gap-2">
                  <button type="button" onClick={() => setEditingProducts(null)} className="flex-1 rounded-xl border border-gray-300 py-2.5 font-semibold text-gray-700">{t('Cancelar')}</button>
                  <button type="button" onClick={saveProducts} disabled={busy} className="flex-1 rounded-xl bg-green-700 py-2.5 font-semibold text-white disabled:bg-gray-300">{t('Salvar produtos')}</button>
                </div>
              </div>
            ) : lot.supplies.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-500">{t('Nenhum produto ligado a este lote. Ligue a ração ou o sal do estoque para anotar o trato e saber em quantos dias acaba.')}</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {productLines(lot).map((p) => (
                  <li key={p.id} className={`rounded-xl border p-3 text-sm ${p.days !== null && p.days <= STOCK_WARNING_DAYS ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-white'}`}>
                    <p className="font-bold text-gray-900">{p.supply.name}</p>
                    {p.percent ? <p className="text-gray-600">{t('a {percent}% do peso vivo', { percent: fmtNumber(p.percent, 2) })}</p> : null}
                    {p.perDay ? (
                      <>
                        <p className="mt-1 text-gray-800"><strong>{kg(p.perDay)}</strong> {t('por dia para o lote')}{p.perHead !== null ? ` · ${t('{g} g por cabeça', { g: fmtNumber(p.perHead, 0) })}` : ''}</p>
                        {p.days !== null
                          ? <p className={`mt-1 font-semibold ${p.days <= STOCK_WARNING_DAYS ? 'text-amber-800' : 'text-green-800'}`}>{p.days === 1 ? t('O estoque dá para 1 dia.') : t('O estoque dá para {n} dias.', { n: p.days })}</p>
                          : <p className="mt-1 text-gray-500">{t('Para saber em quantos dias acaba, o estoque precisa estar em kg ou em sacos com o peso do saco.')}</p>}
                      </>
                    ) : <p className="mt-1 text-gray-500">{t('Informe o consumo em % do peso vivo para calcular quanto o lote come.')}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
          {lot.supplies.length > 0 && <FeedingSection lot={lot} canEdit={canEdit} today={today} busy={busy} run={run} />}
        </>
      )}

      {tab === 'desempenho' && <LotPerformance lot={lot} today={today} />}
    </Modal>
  )
}

type LotTab = 'resumo' | 'pesagens' | 'animais' | 'trato' | 'desempenho'

// ── Editar o lote ───────────────────────────────────────────────────────

function LotEditForm({ lot, plans, busy, run, onDone, onTarget }: {
  lot: Lot; plans: LotPlan[]; busy: boolean; run: Run; onDone: () => void
  /** O plano escolhido preencheu o peso-alvo (o lote não tinha): atualiza o campo da tela */
  onTarget: (value: string) => void
}) {
  const t = useT()
  const [form, setForm] = useState({ name: lot.name, phase: lot.phase, startDate: lot.startDate, notes: lot.notes ?? '', planId: lot.planId ?? '', purchaseValue: toField(lot.purchaseValue) })
  const chosenPlan = plans.find((p) => p.id === form.planId) ?? null
  // Sem peso-alvo no lote: a meta do plano escolhido vira o peso-alvo
  const fillTarget = !lot.targetWeight && form.planId !== (lot.planId ?? '') && chosenPlan?.targetWeight ? chosenPlan.targetWeight : null
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const body = { ...form, planId: form.planId || null, purchaseValue: moneyField(form.purchaseValue), ...(fillTarget ? { targetWeight: toField(fillTarget) } : {}) }
    const done = () => { if (fillTarget) onTarget(toField(fillTarget)); onDone() }
    void run(async () => {
      const updated = await send(`/api/lotes/${lot.id}`, 'PATCH', body)
      done()
      return updated
    }, done)
  }
  return (
    <form onSubmit={save} className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-200 p-3">
      <label className={label}>{t('Nome do lote')}
        <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {LOT_PHASES.map((p) => (
          <button key={p.key} type="button" aria-pressed={form.phase === p.key} onClick={() => setForm({ ...form, phase: p.key })}
            className={`rounded-xl border-2 py-2.5 text-sm font-semibold ${form.phase === p.key ? 'border-green-700 bg-green-50 text-green-800' : 'border-gray-200 text-gray-600'}`}>{t(p.label)}</button>
        ))}
      </div>
      <label className={label}>{t('Data de entrada (a pesagem de entrada acompanha)')}
        <input type="date" required max={new Date().toISOString().slice(0, 10)} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className={input} />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <PlanSelect plans={plans} value={form.planId} onChange={(planId) => setForm({ ...form, planId })} />
        <label className={label}>{t('Valor de compra do lote (R$, opcional)')}
          <input inputMode="decimal" value={form.purchaseValue} onChange={(e) => setForm({ ...form, purchaseValue: decimal(e.target.value) })} placeholder={t('Ex.: 150.000,00')} className={input} />
        </label>
      </div>
      {fillTarget && <p className="text-xs text-gray-600">{t('O peso-alvo do lote fica {weight}, a meta do plano.', { weight: kg(fillTarget) })}</p>}
      <label className={label}>{t('Observações')}
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className={input} />
      </label>
      <div className="flex gap-2">
        <button type="button" onClick={onDone} className="flex-1 rounded-xl border border-gray-300 py-2.5 font-semibold text-gray-700">{t('Cancelar')}</button>
        <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-green-700 py-2.5 font-semibold text-white disabled:bg-gray-300">{t('Salvar')}</button>
      </div>
    </form>
  )
}

// ── Pesagens: histórico com editar e apagar ─────────────────────────────

function WeighingHistory({ lot, canEdit, today, busy, run }: { lot: Lot; canEdit: boolean; today: string; busy: boolean; run: Run }) {
  const { confirm } = useDialog()
  const t = useT()
  const hasAnimals = lot.animals.length > 0
  const [editing, setEditing] = useState<string | null>(null)
  const [form, setForm] = useState({ date: '', headCount: '', avgWeight: '' })
  const [weights, setWeights] = useState<Record<string, string>>({})
  const rows = useMemo(() => lot.weighings.map((w, i) => {
    const prev = lot.weighings[i - 1]
    const days = prev ? daysBetween(prev.date, w.date) : 0
    return { ...w, gmd: prev && days > 0 ? (w.avgWeight - prev.avgWeight) / days : null }
  }).reverse(), [lot.weighings])

  const startEdit = (w: Lot['weighings'][number]) => {
    setEditing(w.id)
    setForm({ date: w.date, headCount: String(w.headCount), avgWeight: toField(w.avgWeight) })
    // Pesos de cada animal nesse dia
    setWeights(Object.fromEntries(lot.animals.flatMap((a) => {
      const found = a.weighings.find((x) => x.date === w.date)
      return found ? [[a.id, toField(found.weight)]] : []
    })))
  }
  const save = (id: string) => void run(async () => {
    const updated = await send(`/api/lotes/${lot.id}/pesagens`, 'PATCH', hasAnimals ? { weighingId: id, date: form.date, weights } : { weighingId: id, ...form })
    setEditing(null)
    return updated
  }, () => setEditing(null))
  const remove = async (id: string) => {
    if (!(await confirm({ title: t('Apagar esta pesagem?'), message: hasAnimals ? t('Os pesos de cada animal nesse dia também serão apagados.') : undefined, confirmLabel: t('Apagar'), danger: true }))) return
    void run(() => send(`/api/lotes/${lot.id}/pesagens`, 'DELETE', { weighingId: id }))
  }

  return (
    <section className="mt-5">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('Pesagens')}</h3>
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 text-sm">
        {rows.map((w, i) => {
          const isEntry = i === rows.length - 1
          if (editing === w.id) {
            return (
              <li key={w.id} className="bg-green-50 p-3">
                <label className="text-sm font-medium text-gray-700">{t('Data')}{isEntry ? ` (${t('entrada do lote')})` : ''}
                  <input type="date" max={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={`${input} sm:w-56`} />
                </label>
                {hasAnimals ? (
                  <div className="mt-2"><WeightList animals={lot.animals} weights={weights} onChange={setWeights} /></div>
                ) : (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="text-sm font-medium text-gray-700">{t('Cabeças')}
                      <input inputMode="numeric" value={form.headCount} onChange={(e) => setForm({ ...form, headCount: e.target.value.replace(/\D/g, '') })} className={input} />
                    </label>
                    <label className="text-sm font-medium text-gray-700">{t('Peso médio (kg)')}
                      <input inputMode="decimal" value={form.avgWeight} onChange={(e) => setForm({ ...form, avgWeight: decimal(e.target.value) })} className={input} />
                    </label>
                  </div>
                )}
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={() => setEditing(null)} className="flex-1 rounded-xl border border-gray-300 py-2.5 font-semibold text-gray-700">{t('Cancelar')}</button>
                  <button type="button" onClick={() => save(w.id)} disabled={busy} className="flex-1 rounded-xl bg-green-700 py-2.5 font-semibold text-white disabled:bg-gray-300">{t('Salvar')}</button>
                </div>
              </li>
            )
          }
          return (
            <li key={w.id} className="px-3 py-2">
              <div className="flex items-baseline justify-between gap-3 whitespace-nowrap">
                <span className="text-gray-700">{fmtDate(w.date)}{isEntry && <span className="ml-1.5 text-xs text-gray-400">{t('entrada')}</span>}</span>
                <span className="flex items-baseline gap-3">
                  <span className="text-gray-500">{w.headCount} {t('cab.')}</span>
                  <span className="font-semibold text-gray-800">{kg(w.avgWeight)}</span>
                  {w.gmd !== null && <span className="text-green-700">{fmtNumber(w.gmd, 3)}/{t('dia')}</span>}
                </span>
              </div>
              {canEdit && (
                <div className="mt-1 flex justify-end gap-4">
                  <button type="button" onClick={() => startEdit(w)} className="text-xs font-semibold text-green-700 hover:underline">{t('Editar')}</button>
                  {!isEntry && <button type="button" onClick={() => void remove(w.id)} className="text-xs font-semibold text-red-700 hover:underline">{t('Apagar')}</button>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ── Trato no cocho: lançar, editar, baixa no estoque e custo ────────────

function FeedingSection({ lot, canEdit, today, busy, run }: { lot: Lot; canEdit: boolean; today: string; busy: boolean; run: Run }) {
  const { confirm } = useDialog()
  const t = useT()
  const s = lotSummary(lot.weighings, today, lot.endDate)
  const heads = lot.animals.length || s.last?.headCount || 0
  const summary = feedingSummary(lot.feedings, heads)
  const suggestionOf = (supplyId: string) => dailySupplyKg(s.last, lot.supplies.find((x) => x.supply.id === supplyId)?.percent)
  const firstId = lot.supplies[0].supply.id
  const [form, setForm] = useState({ date: today, supplyId: firstId, kg: toField(suggestionOf(firstId)) })
  const [editing, setEditing] = useState<{ id: string; date: string; kg: string } | null>(null)
  const supply = lot.supplies.find((x) => x.supply.id === form.supplyId)?.supply ?? lot.supplies[0].supply
  const suggestion = suggestionOf(supply.id)
  const kgValue = parseKg(form.kg)
  const inStock = kgValue !== null ? kgInStockUnit(supply, kgValue) : null
  const perKg = pricePerKg(supply)
  const names = new Map(lot.supplies.map((x) => [x.supply.id, x.supply.name]))
  const recent = [...lot.feedings].reverse().slice(0, 10)

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    void run(() => send(`/api/lotes/${lot.id}/tratos`, 'POST', form))
  }
  const saveEdit = () => void run(async () => {
    const updated = await send(`/api/lotes/${lot.id}/tratos`, 'PATCH', { feedingId: editing!.id, date: editing!.date, kg: editing!.kg })
    setEditing(null)
    return updated
  }, () => setEditing(null))
  const remove = async (id: string) => {
    if (!(await confirm({ title: t('Apagar este trato?'), message: t('A quantidade volta para o estoque.'), confirmLabel: t('Apagar'), danger: true }))) return
    void run(() => send(`/api/lotes/${lot.id}/tratos`, 'DELETE', { feedingId: id }))
  }

  return (
    <section className="mt-5">
      <h3 className="mb-2 text-sm font-semibold text-gray-700">{t('Trato no cocho')}</h3>
      {lot.feedings.length > 0 && (
        <>
          <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              [t('Dado no total'), kg(summary.kg)],
              [t('Previsto x dado'), summary.percent !== null ? `${fmtNumber(summary.percent, 0)}%` : '—'],
              [t('Custo total'), summary.cost !== null ? fmtMoney(summary.cost) : '—'],
              [t('Custo por cabeça'), summary.costPerHead !== null ? fmtMoney(summary.costPerHead) : '—'],
            ].map(([title, value]) => (
              <div key={title} className="rounded-lg border border-gray-100 bg-gray-50 p-3"><p className="text-xs text-gray-500">{title}</p><p className="text-base font-bold text-gray-800">{value}</p></div>
            ))}
          </div>
          <p className="mb-2 text-xs text-gray-500">
            {summary.days === 1 ? t('1 dia de trato') : t('{n} dias de trato', { n: summary.days })}
            {summary.costPerHeadDay !== null ? ` · ${t('{money} por cabeça por dia', { money: fmtMoney(summary.costPerHeadDay) })}` : ''}
            {summary.cost === null ? ` · ${t('informe o preço dos produtos para ver o custo')}` : ''}
            {summary.partialCost ? ` · ${t('alguns tratos foram lançados antes do preço e ficaram sem custo')}` : ''}
          </p>
        </>
      )}
      {canEdit && !lot.endDate && (
        <form onSubmit={save} className="rounded-xl bg-amber-50 p-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {lot.supplies.length > 1 && (
              <label className="col-span-2 text-sm font-medium text-gray-700 sm:col-span-1">{t('Produto')}
                <select value={form.supplyId} onChange={(e) => setForm({ ...form, supplyId: e.target.value, kg: toField(suggestionOf(e.target.value)) })} className={`${input} bg-white`}>
                  {lot.supplies.map((x) => <option key={x.supply.id} value={x.supply.id}>{x.supply.name}</option>)}
                </select>
              </label>
            )}
            <label className="text-sm font-medium text-gray-700">{t('Data')}
              <input type="date" required max={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} />
            </label>
            <label className="text-sm font-medium text-gray-700">{t('Quanto foi dado (kg)')}
              <input required inputMode="decimal" value={form.kg} onChange={(e) => setForm({ ...form, kg: decimal(e.target.value) })} className={input} />
            </label>
          </div>
          <p className="mt-2 text-xs text-gray-700">
            {lot.supplies.length === 1 ? `${supply.name}. ` : ''}
            {suggestion ? `${t('Sugestão pelo % do peso vivo: {weight} por dia.', { weight: kg(suggestion) })} ` : ''}
            {kgValue !== null && inStock !== null && supply.unit === 'sacos' ? `${inStock === 1 ? t('Sai do estoque: 1 saco.') : t('Sai do estoque: {n} sacos.', { n: fmtNumber(inStock, 2) })} ` : ''}
            {kgValue !== null && perKg !== null ? t('Custo: {money}.', { money: fmtMoney(kgValue * perKg) }) : ''}
            {supply.unit === 'sacos' && !supply.packageKg ? ` ${t('Informe o peso do saco de {name} em Produtos do lote para dar baixa no estoque.', { name: supply.name })}` : ''}
          </p>
          <button type="submit" disabled={busy || kgValue === null} className="mt-2 w-full rounded-xl bg-amber-600 py-3 font-semibold text-white disabled:bg-gray-300">{t('Lançar trato e dar baixa no estoque')}</button>
        </form>
      )}
      {recent.length > 0 && (
        <ul className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-100 text-sm">
          {recent.map((f) => editing?.id === f.id ? (
            <li key={f.id} className="grid grid-cols-2 gap-2 bg-amber-50 p-3">
              <label className="text-sm font-medium text-gray-700">{t('Data')}
                <input type="date" max={today} value={editing.date} onChange={(e) => setEditing({ ...editing, date: e.target.value })} className={input} />
              </label>
              <label className="text-sm font-medium text-gray-700">Kg
                <input inputMode="decimal" value={editing.kg} onChange={(e) => setEditing({ ...editing, kg: decimal(e.target.value) })} className={input} />
              </label>
              <button type="button" onClick={() => setEditing(null)} className="rounded-xl border border-gray-300 py-2.5 font-semibold text-gray-700">{t('Cancelar')}</button>
              <button type="button" onClick={saveEdit} disabled={busy || parseKg(editing.kg) === null} className="rounded-xl bg-amber-600 py-2.5 font-semibold text-white disabled:bg-gray-300">{t('Salvar')}</button>
            </li>
          ) : (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2">
              <span className="text-gray-700">{fmtDate(f.date)}{lot.supplies.length > 1 && f.supplyId ? <span className="ml-1.5 text-xs text-gray-500">{names.get(f.supplyId)}</span> : null}</span>
              <span className="flex items-center gap-3">
                <span className="font-semibold text-gray-800">{kg(f.kg)}</span>
                {f.cost !== null && <span className="text-gray-500">{fmtMoney(f.cost)}</span>}
                {canEdit && <button type="button" onClick={() => setEditing({ id: f.id, date: f.date, kg: toField(f.kg) })} className="text-xs font-semibold text-green-700 hover:underline">{t('Editar')}</button>}
                {canEdit && <button type="button" onClick={() => void remove(f.id)} className="text-xs font-semibold text-red-700 hover:underline">{t('Apagar')}</button>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ── Recria: cio e cobertura das novilhas ────────────────────────────────

const months = (birth: string, today: string) => Math.floor(daysBetween(birth, today) / 30.44)

function coverageText(c: LotAnimal['reproductions'][number] | undefined, t: (text: string, vars?: Vars) => string) {
  if (!c) return t('Sem registro')
  if (c.status === 'Vazia' || c.status === 'Perdida') return `${t(c.status)} (${t('cobertura de {date}', { date: fmtDate(c.coverageDate) })})`
  const how = t(c.method ? methodLabel(c.method) : 'Coberta')
  return `${how} ${t('em')} ${fmtDate(c.coverageDate)}${c.expectedBirthDate ? ` · ${t('parto previsto')} ${fmtDate(c.expectedBirthDate)}` : ''}${c.status === 'Prenha' ? ` · ${t('prenha')}` : ''}`
}

export function ReproductionSection({ females, today, canEdit, onSaved }: { females: LotAnimal[]; today: string; canEdit: boolean; onSaved: () => void }) {
  // Fêmea com o formulário aberto e, se for edição, a cobertura editada
  const t = useT()
  const [open, setOpen] = useState<{ id: string; editing?: Coverage } | null>(null)
  const [notice, setNotice] = useState('')
  return (
    <section className="mt-5">
      <h3 className="mb-1 text-sm font-semibold text-gray-700">{t(females.length === 1 ? 'Reprodução da novilha' : 'Reprodução das novilhas')}</h3>
      <p className="mb-2 text-xs text-gray-500">{t('Registre o cio e a cobertura (inseminação ou monta natural). O parto previsto entra nos avisos e na tela Reprodução.')}</p>
      {notice && <p role="status" className="mb-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{notice}</p>}
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 text-sm">
        {females.map((f) => (
          <li key={f.id} className="px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="font-semibold text-gray-900">{tag(f)}</span> <span className="text-gray-700">{f.name}</span>
                <span className="ml-1.5 text-xs text-gray-500">{t('{n} meses', { n: months(f.birthDate, today) })}</span>
                <span className="block text-xs text-gray-600">
                  {f.reproductions[0]?.heatDate ? `${t('Cio em {date}', { date: fmtDate(f.reproductions[0].heatDate) })} · ` : ''}{coverageText(f.reproductions[0], t)}
                </span>
              </span>
              {canEdit && open?.id !== f.id && (
                <span className="flex gap-3">
                  {f.reproductions[0] && <button type="button" onClick={() => setOpen({ id: f.id, editing: f.reproductions[0] })} className="text-sm font-semibold text-gray-700 hover:underline">{t('Editar')}</button>}
                  <button type="button" onClick={() => setOpen({ id: f.id })} className="text-sm font-semibold text-green-700 hover:underline">{t(f.reproductions[0] ? 'Nova cobertura' : 'Registrar cobertura')}</button>
                </span>
              )}
            </div>
            {open?.id === f.id && <CoverageForm female={f} today={today} editing={open.editing} onCancel={() => setOpen(null)} onSaved={() => { setNotice(''); setOpen(null); onSaved() }}
              onQueued={(message) => { setNotice(`${t(message)} ${t('A cobertura aparece aqui depois do envio.')}`); setOpen(null) }} />}
          </li>
        ))}
      </ul>
    </section>
  )
}

function CoverageForm({ female, today, editing, onCancel, onSaved, onQueued }: { female: LotAnimal; today: string; editing?: Coverage; onCancel: () => void; onSaved: () => void; onQueued: (message: string) => void }) {
  const [form, setForm] = useState(editing
    ? {
        heatDate: editing.heatDate ?? '', method: editing.method ?? 'ia', coverageDate: editing.coverageDate,
        expectedBirthDate: editing.expectedBirthDate ?? plusDays(editing.coverageDate, GESTATION_DAYS),
        semenBatch: editing.semenBatch ?? '', maleName: editing.maleName ?? '', bullRegistry: editing.bullRegistry ?? '', inseminator: editing.inseminator ?? '',
      }
    : { heatDate: '', method: 'ia', coverageDate: today, expectedBirthDate: plusDays(today, GESTATION_DAYS), semenBatch: '', maleName: '', bullRegistry: '', inseminator: '' })
  const t = useT()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const young = months(female.birthDate, today) < 13

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      if (editing) await send(`/api/reproducao/${editing.id}`, 'PUT', form)
      else await send('/api/reproducao', 'POST', { femaleId: female.id, status: 'Coberta', ...form })
      onSaved()
    } catch (err) {
      if (isQueued(err)) onQueued(err.message)
      else setError(t(offlineMessage(err)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="mt-2 grid grid-cols-1 gap-2 rounded-xl bg-pink-50 p-3 sm:grid-cols-2">
      <label className="text-sm font-medium text-gray-700">{t('Data do cio (opcional)')}
        <input type="date" max={today} value={form.heatDate} onChange={(e) => setForm({ ...form, heatDate: e.target.value })} className={input} />
      </label>
      <fieldset className="text-sm font-medium text-gray-700">
        <legend>{t('Como foi')}</legend>
        <div className="mt-1 grid grid-cols-2 gap-1">
          {COVERAGE_METHODS.map((m) => (
            <button key={m.key} type="button" aria-pressed={form.method === m.key} onClick={() => setForm({ ...form, method: m.key })}
              className={`whitespace-nowrap rounded-lg border-2 px-2 py-2.5 text-sm font-semibold ${form.method === m.key ? 'border-pink-700 bg-white text-pink-800' : 'border-gray-200 text-gray-600'}`}>{t(m.label)}</button>
          ))}
        </div>
      </fieldset>
      <label className="text-sm font-medium text-gray-700">{t(isInsemination(form.method) ? 'Data da inseminação' : 'Data da monta')}
        <input type="date" required max={today} value={form.coverageDate}
          onChange={(e) => setForm({ ...form, coverageDate: e.target.value, expectedBirthDate: e.target.value ? plusDays(e.target.value, GESTATION_DAYS) : form.expectedBirthDate })} className={input} />
      </label>
      <label className="text-sm font-medium text-gray-700">{t('Parto estimado')}
        <input type="date" value={form.expectedBirthDate} onChange={(e) => setForm({ ...form, expectedBirthDate: e.target.value })} className={input} />
      </label>
      {isInsemination(form.method) && (
        <>
          <label className="text-sm font-medium text-gray-700">{t('Partida do sêmen')}
            <input value={form.semenBatch} onChange={(e) => setForm({ ...form, semenBatch: e.target.value })} placeholder={t('Ex.: 2412-A')} className={input} />
          </label>
          <label className="text-sm font-medium text-gray-700">{t('Inseminador')}
            <input value={form.inseminator} onChange={(e) => setForm({ ...form, inseminator: e.target.value })} placeholder={t('Quem inseminou')} className={input} />
          </label>
        </>
      )}
      <label className="text-sm font-medium text-gray-700">{t('Touro (nome)')}
        <input value={form.maleName} onChange={(e) => setForm({ ...form, maleName: e.target.value })} placeholder={t('Ex.: Trovão')} className={input} />
      </label>
      <label className="text-sm font-medium text-gray-700">{t('Registro do touro')}
        <input value={form.bullRegistry} onChange={(e) => setForm({ ...form, bullRegistry: e.target.value })} placeholder={t('Ex.: RGD 12345')} className={input} />
      </label>
      {young && !editing && <p className="text-xs text-amber-800 sm:col-span-2">{t('A novilha tem menos de 13 meses: o app só aceita cobertura a partir dessa idade.')}</p>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700 sm:col-span-2">{error}</p>}
      <div className="flex gap-2 sm:col-span-2">
        <button type="button" onClick={onCancel} className="flex-1 rounded-xl border border-gray-300 py-2.5 font-semibold text-gray-700">{t('Cancelar')}</button>
        <button type="submit" disabled={saving} className="flex-1 rounded-xl bg-pink-700 py-2.5 font-semibold text-white disabled:bg-gray-300">{t(saving ? 'Salvando...' : editing ? 'Salvar alteração' : 'Salvar cobertura')}</button>
      </div>
    </form>
  )
}

// ── Gráfico das pesagens e da projeção ──────────────────────────────────

function ProjectionChart({ weighings, projection, target }: { weighings: Weighing[]; projection: { date: string } | null; target: number | null }) {
  const t = useT()
  const locale = useLocale()
  if (weighings.length < 1) return null
  const points = weighings.map((w) => ({ date: w.date, value: w.avgWeight }))
  const end = projection && target ? { date: projection.date, value: target } : null
  const all = end ? [...points, end] : points
  const t0 = Date.parse(all[0].date)
  const t1 = Math.max(Date.parse(all[all.length - 1].date), t0 + 86_400_000)
  const values = all.map((p) => p.value)
  const min = Math.floor(Math.min(...values) / 20) * 20 - 20
  const max = Math.ceil(Math.max(...values) / 20) * 20 + 20
  const W = 600, H = 200, L = 44, B = 24, T = 10, R = 12
  const x = (d: string) => L + ((Date.parse(d) - t0) / (t1 - t0)) * (W - L - R)
  const y = (v: number) => T + (1 - (v - min) / (max - min)) * (H - T - B)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]
  const ticks = [min, (min + max) / 2, max]
  const label = (d: string) => new Date(d).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
  return (
    <figure className="rounded-xl border border-gray-100 p-3">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('Peso médio do lote ao longo do tempo e projeção até o peso desejado')}>
        {ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#e5e7eb" strokeDasharray="3 3" /><text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="#6b7280">{Math.round(v)}</text></g>)}
        <path d={path} fill="none" stroke="#15803d" strokeWidth="2.5" />
        {points.map((p) => <circle key={p.date} cx={x(p.date)} cy={y(p.value)} r="4" fill="#fff" stroke="#15803d" strokeWidth="2" />)}
        {end && <><line x1={x(last.date)} y1={y(last.value)} x2={x(end.date)} y2={y(end.value)} stroke="#d97706" strokeWidth="2.5" strokeDasharray="6 5" /><circle cx={x(end.date)} cy={y(end.value)} r="4" fill="#d97706" /></>}
        <text x={L} y={H - 6} fontSize="11" fill="#6b7280">{label(all[0].date)}</text>
        <text x={W - R} y={H - 6} fontSize="11" fill="#6b7280" textAnchor="end">{label(all[all.length - 1].date)}</text>
      </svg>
      <figcaption className="mt-1 flex gap-4 text-xs text-gray-600">
        <span><span className="mr-1 inline-block h-0.5 w-4 bg-green-700 align-middle" />{t('Pesagens')}</span>
        {end && <span><span className="mr-1 inline-block h-0.5 w-4 border-t-2 border-dashed border-amber-600 align-middle" />{t('Previsão')}</span>}
      </figcaption>
    </figure>
  )
}
