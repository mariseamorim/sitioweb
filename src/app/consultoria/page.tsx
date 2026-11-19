'use client'

// Painel do veterinário consultor: as propriedades que ele atende, com os números de reprodução de cada uma,
// a agenda de visitas, o código para o produtor liberar a propriedade e o histórico das que já encerraram.
// Recibos e estoque do veterinário ficam em telas próprias (/consultoria/recibos e /consultoria/estoque).
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Agenda } from './Agenda'
import { useDialog } from '@/components/DialogProvider'
import { hasPendingOnDevice, PENDING_MESSAGE, reloadInFarm } from '@/lib/farmSwitch'
import { maskPhone } from '@/lib/masks'
import { useLang, useLocale, useT } from '@/lib/i18n'

interface Client {
  id: string; farmId: string; name: string; owner: string | null; city: string | null; state: string | null; phone: string | null
  createdByVet: boolean; since: string; animals: number; awaitingDiagnosis: number; pregnancyRate: number | null; birthsSoon: number
}
interface Ended { id: string; name: string; since: string; endedAt: string | null; records: number }
interface ArchivedRecord {
  animal: string; code: string; coverageDate: string; method: string | null; maleName: string | null; status: string
  expectedBirthDate: string | null; covered: boolean; diagnosed: boolean; diagnosedAt: string | null
}
interface Task { farmId: string; title: string; detail?: string; n: number; late?: number; href: string; tone: 'red' | 'amber' | 'blue' }

const TONE_DOT = { red: 'bg-red-600', amber: 'bg-amber-500', blue: 'bg-blue-600' } as const
const TONE_ORDER = { red: 0, amber: 1, blue: 2 } as const
/** Tarefas visíveis antes de "Ver todas" */
const TASKS_SHOWN = 6

interface Panel {
  vet: { name: string; crmv: string | null; city: string | null; state: string | null; inviteCode: string }
  openFarmId: string | null
  clients: Client[]
  /** O que fazer em cada propriedade */
  tasks?: Task[]
  ended: Ended[]
}

const input = 'mt-1 w-full border border-gray-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'

export default function ConsultoriaPage() {
  const { confirm, notify } = useDialog()
  const lang = useLang()
  const t = useT()
  const locale = useLocale()
  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(locale, { timeZone: 'UTC' }) : '—')
  const [panel, setPanel] = useState<Panel | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState('')
  const [newFarm, setNewFarm] = useState<{ name: string; owner: string; phone: string; city: string; state: string } | null>(null)
  const [producerFor, setProducerFor] = useState<Client | null>(null)
  const [producer, setProducer] = useState({ name: '', phone: '', email: '', password: '' })
  const [history, setHistory] = useState<{ name: string; endedAt: string | null; records: ArchivedRecord[] } | null>(null)
  const [formError, setFormError] = useState('')
  const [copied, setCopied] = useState(false)
  const [allTasks, setAllTasks] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/veterinario')
      const data = await res.json()
      if (!res.ok) return setError(data.error || 'Não foi possível carregar o painel.')
      setError('')
      setPanel(data)
    } catch {
      setError('Sem internet. O painel de consultoria precisa de conexão.')
    }
  }, [])
  useEffect(() => { void load() }, [load])

  /** Abre a propriedade do cliente e segue para a tela pedida. */
  async function openFarm(client: Client, next: string) {
    if (panel?.openFarmId !== client.farmId && hasPendingOnDevice()) return notify(t('Ainda não dá para trocar'), t(PENDING_MESSAGE))
    setBusy(client.id)
    try {
      const res = await fetch('/api/auth/switch-farm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ farmId: client.farmId }) })
      if (!res.ok) return notify(t('Não foi possível abrir'), (await res.json().catch(() => ({}))).error)
      reloadInFarm(next)
    } catch {
      notify(t('Sem internet'), t('Conecte-se para abrir a propriedade.'))
    } finally {
      setBusy('')
    }
  }

  async function post(url: string, body: unknown, done: () => void) {
    setFormError('')
    setBusy('form')
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return setFormError(data.error || t('Não foi possível salvar.'))
      done()
      await load()
    } catch {
      setFormError(t('Erro de conexão. Tente novamente.'))
    } finally {
      setBusy('')
    }
  }

  async function endLink(client: Client) {
    const ok = await confirm({
      title: t('Deixar de atender {name}?', { name: client.name }),
      message: t('Você perde o acesso à propriedade e fica com uma cópia do que você mesmo lançou (coberturas e diagnósticos). Os dados da propriedade continuam com o produtor.'),
      confirmLabel: t('Deixar de atender'),
    })
    if (!ok) return
    const res = await fetch(`/api/veterinario/clientes/${client.id}`, { method: 'DELETE' })
    if (!res.ok) return notify(t('Não foi possível encerrar'), (await res.json().catch(() => ({}))).error)
    await load()
  }

  async function showHistory(item: Ended) {
    const res = await fetch(`/api/veterinario/clientes/${item.id}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return notify(t('Não foi possível abrir o histórico'), data.error)
    setHistory({ name: data.name, endedAt: data.endedAt, records: data.records })
  }

  if (error) return <p role="alert" className="py-12 text-center text-gray-600">{t(error)}</p>
  if (!panel) return <p className="py-12 text-center text-gray-500">{t('Carregando…')}</p>

  const inviteLink = `${typeof window === 'undefined' ? '' : window.location.origin}/meu-veterinario?codigo=${panel.vet.inviteCode}`
  const inviteText = t('Olá! Sou {name}, veterinário. Para eu acompanhar a sua propriedade no Anota Aí Agro, abra este link e confirme: {link}', { name: panel.vet.name, link: inviteLink })
  const totalAnimals = panel.clients.reduce((sum, c) => sum + c.animals, 0)
  const awaiting = panel.clients.reduce((sum, c) => sum + c.awaitingDiagnosis, 0)
  const rates = panel.clients.filter((c) => c.pregnancyRate !== null).map((c) => c.pregnancyRate as number)
  const averageRate = rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length) : null
  // Uma lista só, das propriedades todas: as atrasadas (vermelho) primeiro
  const tasks = (panel.tasks ?? []).flatMap((task) => {
    const client = panel.clients.find((c) => c.farmId === task.farmId)
    return client ? [{ task, client }] : []
  }).sort((a, b) => TONE_ORDER[a.task.tone] - TONE_ORDER[b.task.tone])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('Consultoria')}</h1>
          <p className="text-gray-500">{panel.clients.length} {t(panel.clients.length === 1 ? 'propriedade atendida' : 'propriedades atendidas')} · {totalAnimals} {t('animais')}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/consultoria/recibos" className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Recibos')}</Link>
          <Link href="/consultoria/estoque" className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Meu estoque')}</Link>
        </div>
      </div>

      {/* O dia do veterinário em primeiro lugar: agenda e tarefas lado a lado */}
      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <Agenda clients={panel.clients.map((c) => ({ id: c.id, name: c.name }))} />

        <section aria-labelledby="vet-tasks">
          <h2 id="vet-tasks" className="mb-3 flex min-h-[44px] items-center text-lg font-semibold text-gray-800">{t('O que fazer nas propriedades')}</h2>
          {!tasks.length ? (
            <p className="bg-white rounded-xl border border-gray-200 p-4 text-sm text-gray-500">{t('Nada pendente nas propriedades que você atende.')}</p>
          ) : (
            <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
              {(allTasks ? tasks : tasks.slice(0, TASKS_SHOWN)).map(({ task: k, client: c }) => (
                <li key={`${k.farmId}${k.title}`}>
                  <button type="button" disabled={busy === c.id} onClick={() => openFarm(c, k.href)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 disabled:opacity-60">
                    <span aria-hidden="true" className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${TONE_DOT[k.tone]}`} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-gray-800">{t(k.title, { n: k.n })}</span>
                      <span className="block text-sm text-gray-500">{[c.name, k.late ? t(k.late === 1 ? '{n} já passou da data' : '{n} já passaram da data', { n: k.late }) : null, k.detail ? t(k.detail) : null].filter(Boolean).join(' · ')}</span>
                    </span>
                    <span aria-hidden="true" className="text-gray-400">›</span>
                  </button>
                </li>
              ))}
              {tasks.length > TASKS_SHOWN && (
                <li><button type="button" onClick={() => setAllTasks(!allTasks)} className="w-full px-4 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-50">{allTasks ? t('Mostrar menos') : t('Ver todas ({n})', { n: tasks.length })}</button></li>
              )}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-2xl font-bold text-gray-800">{awaiting}</p><p className="text-sm text-gray-500">{t('aguardando diagnóstico')}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-2xl font-bold text-green-700">{averageRate === null ? '—' : `${averageRate}%`}</p><p className="text-sm text-gray-500">{t('concepção média')}</p></div>
        <div className="bg-white rounded-xl border border-gray-200 p-4"><p className="text-2xl font-bold text-gray-800">{panel.clients.reduce((sum, c) => sum + c.birthsSoon, 0)}</p><p className="text-sm text-gray-500">{t('partos em 30 dias')}</p></div>
      </div>


      <section className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
        <h2 className="font-semibold text-green-900">{t('Seu código de veterinário')}</h2>
        <p className="text-sm text-green-900/80">{t('O produtor informa este código em “Meu veterinário” para liberar a propriedade para você.')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="font-mono text-2xl font-bold tracking-widest text-green-900">{panel.vet.inviteCode}</span>
          <a href={`https://wa.me/?text=${encodeURIComponent(inviteText)}`} target="_blank" rel="noreferrer" className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600">{t('Enviar pelo WhatsApp')}</a>
          <button type="button" onClick={() => { void navigator.clipboard?.writeText(inviteLink).then(() => setCopied(true)) }} className="rounded-lg border border-green-700 px-4 py-2.5 text-sm font-semibold text-green-800 hover:bg-green-100">{t(copied ? 'Link copiado' : 'Copiar link')}</button>
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-semibold text-gray-800">{t('Propriedades atendidas')}</h2>
        <button type="button" onClick={() => { setFormError(''); setNewFarm({ name: '', owner: '', phone: '', city: '', state: '' }) }} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600">{t('+ Propriedade de cliente')}</button>
      </div>

      {panel.clients.length === 0 && (
        <p className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500">
          {t('Nenhuma propriedade ainda. Envie o seu código ao produtor ou cadastre a propriedade de um cliente que ainda não usa o sistema.')}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {panel.clients.map((c) => (
          <article key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                <p className="text-sm text-gray-500 truncate">{[c.owner, [c.city, c.state].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || t('Sem dados do produtor')}</p>
              </div>
              {panel.openFarmId === c.farmId && <span className="shrink-0 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">{t('Aberta')}</span>}
            </div>
            <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
              <div><dd className="text-lg font-bold text-gray-800">{c.animals}</dd><dt className="text-xs text-gray-500">{t('animais')}</dt></div>
              <div><dd className="text-lg font-bold text-green-700">{c.pregnancyRate === null ? '—' : `${c.pregnancyRate}%`}</dd><dt className="text-xs text-gray-500">{t('concepção')}</dt></div>
              <div><dd className={`text-lg font-bold ${c.awaitingDiagnosis ? 'text-amber-700' : 'text-gray-800'}`}>{c.awaitingDiagnosis}</dd><dt className="text-xs text-gray-500">{t('a diagnosticar')}</dt></div>
              <div><dd className="text-lg font-bold text-gray-800">{c.birthsSoon}</dd><dt className="text-xs text-gray-500">{t('partos 30 d')}</dt></div>
            </dl>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" disabled={busy === c.id} onClick={() => openFarm(c, '/reproducao/diagnostico')} className="rounded-lg bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-600 disabled:bg-green-400">{t('Diagnóstico em lote')}</button>
              <button type="button" disabled={busy === c.id} onClick={() => openFarm(c, '/reproducao/relatorio-visita')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Relatório de visita')}</button>
              <button type="button" disabled={busy === c.id} onClick={() => openFarm(c, '/reproducao/indicadores')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Indicadores')}</button>
              <button type="button" disabled={busy === c.id} onClick={() => openFarm(c, '/reproducao')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Reprodução')}</button>
              <button type="button" disabled={busy === c.id} onClick={() => openFarm(c, '/animais')} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Animais')}</button>
              {c.createdByVet && <button type="button" onClick={() => { setFormError(''); setProducer({ name: c.owner ?? '', phone: c.phone ?? '', email: '', password: '' }); setProducerFor(c) }} className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Dar acesso ao produtor')}</button>}
              <button type="button" onClick={() => endLink(c)} className="rounded-lg px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50">{t('Deixar de atender')}</button>
            </div>
          </article>
        ))}
      </div>

      {panel.ended.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">{t('Atendimentos encerrados')}</h2>
          <p className="text-sm text-gray-500 mb-3">{t('A cópia do que você lançou continua aqui. Ela não muda mais com o que acontece na propriedade.')}</p>
          <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {panel.ended.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0"><p className="font-medium text-gray-900 truncate">{e.name}</p><p className="text-sm text-gray-500">{t('De {from} a {to}', { from: day(e.since), to: day(e.endedAt) })} · {e.records} {t(e.records === 1 ? 'lançamento' : 'lançamentos')}</p></div>
                <button type="button" onClick={() => showHistory(e)} className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Ver histórico')}</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {newFarm && (
        <Modal title={t('Propriedade de cliente')} onClose={() => setNewFarm(null)}>
          <p className="text-sm text-gray-500">{t('Para um produtor que ainda não usa o sistema. Depois você pode dar a ele o acesso à própria propriedade.')}</p>
          <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void post('/api/veterinario/fazendas', newFarm, () => setNewFarm(null)) }}>
            <label className="text-sm font-medium text-gray-700">{t('Nome da propriedade')} *<input value={newFarm.name} onChange={(e) => setNewFarm({ ...newFarm, name: e.target.value })} required autoFocus className={input} /></label>
            <label className="text-sm font-medium text-gray-700">{t('Nome do produtor')}<input value={newFarm.owner} onChange={(e) => setNewFarm({ ...newFarm, owner: e.target.value })} className={input} /></label>
            <label className="text-sm font-medium text-gray-700">{t('Telefone do produtor')}<input value={newFarm.phone} onChange={(e) => setNewFarm({ ...newFarm, phone: maskPhone(e.target.value) })} inputMode="tel" className={input} /></label>
            <div className="grid grid-cols-3 gap-3">
              <label className="col-span-2 text-sm font-medium text-gray-700">{t('Cidade')}<input value={newFarm.city} onChange={(e) => setNewFarm({ ...newFarm, city: e.target.value })} className={input} /></label>
              <label className="text-sm font-medium text-gray-700">{t('Estado')}<input value={newFarm.state} onChange={(e) => setNewFarm({ ...newFarm, state: e.target.value })} maxLength={lang === 'es' ? 40 : 2} className={`${input} ${lang === 'es' ? '' : 'uppercase'}`} /></label>
            </div>
            {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
            <button type="submit" disabled={busy === 'form'} className="rounded-lg bg-green-700 py-3 text-base font-semibold text-white hover:bg-green-600 disabled:bg-green-400">{t(busy === 'form' ? 'Salvando…' : 'Cadastrar propriedade')}</button>
          </form>
        </Modal>
      )}

      {producerFor && (
        <Modal title={t('Acesso do produtor — {name}', { name: producerFor.name })} onClose={() => setProducerFor(null)}>
          <p className="text-sm text-gray-500">{t('Cria a conta do produtor como dono da propriedade. Passe a ele o telefone ou e-mail e a senha; ele pode trocar a senha em “Meu cadastro”. Você continua atendendo a propriedade.')}</p>
          <form className="mt-4 flex flex-col gap-3" onSubmit={(e) => { e.preventDefault(); void post(`/api/veterinario/clientes/${producerFor.id}/produtor`, producer, () => setProducerFor(null)) }}>
            <label className="text-sm font-medium text-gray-700">{t('Nome do produtor')} *<input value={producer.name} onChange={(e) => setProducer({ ...producer, name: e.target.value })} required autoFocus className={input} /></label>
            <label className="text-sm font-medium text-gray-700">{t('Telefone')}<input value={producer.phone} onChange={(e) => setProducer({ ...producer, phone: maskPhone(e.target.value) })} inputMode="tel" className={input} /></label>
            <label className="text-sm font-medium text-gray-700">{t('E-mail')}<input type="email" value={producer.email} onChange={(e) => setProducer({ ...producer, email: e.target.value })} className={input} /></label>
            <label className="text-sm font-medium text-gray-700">{t('Senha inicial * (pelo menos 6 caracteres)')}<input value={producer.password} onChange={(e) => setProducer({ ...producer, password: e.target.value })} required minLength={6} className={input} /></label>
            {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
            <button type="submit" disabled={busy === 'form'} className="rounded-lg bg-green-700 py-3 text-base font-semibold text-white hover:bg-green-600 disabled:bg-green-400">{t(busy === 'form' ? 'Criando…' : 'Criar conta do produtor')}</button>
          </form>
        </Modal>
      )}

      {history && (
        <Modal title={t('Histórico — {name}', { name: history.name })} onClose={() => setHistory(null)}>
          <p className="text-sm text-gray-500">{t('Seus lançamentos, como estavam em {date}.', { date: day(history.endedAt) })}</p>
          {history.records.length === 0 ? <p className="mt-4 text-gray-600">{t('Você não tinha lançado coberturas nem diagnósticos nesta propriedade.')}</p> : (
            <ul className="mt-4 divide-y divide-gray-100">
              {history.records.map((r, i) => (
                <li key={i} className="py-2.5">
                  <p className="font-medium text-gray-900">{r.animal} <span className="font-normal text-gray-500">({r.code})</span> · {t(r.status)}</p>
                  <p className="text-sm text-gray-500">
                    {t('Cobertura em {date}', { date: day(r.coverageDate) })}{r.maleName ? ` · ${r.maleName}` : ''}{r.covered ? ` · ${t('anotada por você')}` : ''}
                    {r.diagnosed ? ` · ${t('diagnóstico seu em {date}', { date: day(r.diagnosedAt) })}` : ''}{r.expectedBirthDate ? ` · ${t('parto previsto {date}', { date: day(r.expectedBirthDate) })}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  const t = useT()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label={t('Fechar')} className="-mr-1 -mt-1 flex h-10 w-10 items-center justify-center rounded-full text-2xl leading-none text-gray-500 hover:bg-gray-100">×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
