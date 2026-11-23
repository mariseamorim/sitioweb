'use client'

// Painel do veterinário consultor: as propriedades que ele atende, com os números de reprodução de cada uma,
// a agenda de visitas, o código para o produtor liberar a propriedade e o histórico das que já encerraram.
// Recibos e estoque do veterinário ficam em telas próprias (/consultoria/recibos e /consultoria/estoque).
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Agenda, type AgendaHandle } from './Agenda'
import { AgendaView } from '@/components/AgendaView'
import { CalendarioIcon, GraficoIcon, PropriedadeIcon } from '@/components/ModuleIcons'
import type { AgendaItem } from '@/lib/agenda'
import { useDialog } from '@/components/DialogProvider'
import { StatTile } from '@/components/StatTile'
import { hasPendingOnDevice, PENDING_MESSAGE, reloadInFarm } from '@/lib/farmSwitch'
import { maskPhone } from '@/lib/masks'
import { useLang, useLocale, useT } from '@/lib/i18n'

interface Client {
  id: string; farmId: string; name: string; owner: string | null; city: string | null; state: string | null; phone: string | null
  createdByVet: boolean; since: string; animals: number; awaitingDiagnosis: number; pregnancyRate: number | null; birthsSoon: number
  birthsByMonth?: { month: string; count: number }[]
}
interface Ended { id: string; name: string; since: string; endedAt: string | null; records: number }
interface ArchivedRecord {
  animal: string; code: string; coverageDate: string; method: string | null; maleName: string | null; status: string
  expectedBirthDate: string | null; covered: boolean; diagnosed: boolean; diagnosedAt: string | null
}
interface Task { farmId: string; title: string; detail?: string; n: number; late?: number; href: string; tone: 'red' | 'amber' | 'blue' }

interface Panel {
  vet: { name: string; crmv: string | null; city: string | null; state: string | null; inviteCode: string }
  openFarmId: string | null
  clients: Client[]
  /** O que fazer em cada propriedade */
  tasks?: Task[]
  /** Visitas marcadas a partir de hoje */
  visits?: { date: string }[]
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
  const agenda = useRef<AgendaHandle>(null)
  const [agendaKey, setAgendaKey] = useState(0)
  // Abas: a agenda abre primeiro; fazendas (com o código de convite) e gráficos ficam a um toque
  const [tab, setTab] = useState<'agenda' | 'fazendas'>('agenda')
  // Visita pela Agenda: remarcar abre o formulário; concluir e cancelar pedem confirmação
  async function visitAction(item: AgendaItem, action: 'concluir' | 'remarcar' | 'cancelar') {
    if (action === 'remarcar') return agenda.current?.edit({ id: item.refId, date: item.date, time: item.time ?? null, purpose: item.detail ?? null })
    const done = action === 'concluir'
    if (!done && !(await confirm({ title: t('Cancelar a visita?'), message: t(item.label, item.vars), confirmLabel: t('Cancelar visita'), danger: true }))) return
    const ok = await agenda.current?.setStatus(item.refId, done ? 'realizada' : 'cancelada')
    if (!ok) notify(t('Não foi possível salvar'), t('Confira a internet e tente de novo.'))
  }

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
  const today = new Date().toLocaleDateString('en-CA')
  const visitsToday = (panel.visits ?? []).filter((v) => v.date.slice(0, 10) === today).length
  // Manejos atrasados em todas as propriedades (vacinas, partos, secagem, diagnósticos...)
  const lateTotal = (panel.tasks ?? []).reduce((sum, k) => sum + (k.late ?? 0), 0)
  const lateShots = (panel.tasks ?? []).filter((k) => k.href.startsWith('/vacinacao')).reduce((sum, k) => sum + (k.late ?? 0), 0)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{t('Consultoria')}</h1>
          <p className="text-gray-500">{panel.clients.length} {t(panel.clients.length === 1 ? 'propriedade atendida' : 'propriedades atendidas')} · {totalAnimals} {t('animais')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!panel.clients.length} onClick={() => agenda.current?.openNew()} className="rounded-lg bg-green-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-gray-300">{t('+ Marcar visita')}</button>
          <button type="button" onClick={() => { setTab('fazendas'); setFormError(''); setNewFarm({ name: '', owner: '', phone: '', city: '', state: '' }) }} className="rounded-lg border-2 border-green-700 bg-white px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50">{t('Vincular produtor ou novo cadastro')}</button>
          <Link href="/dashboard" className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"><GraficoIcon className="h-4 w-4" />{t('Ver dashboard')}</Link>
          <Link href="/consultoria/recibos" className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Recibos')}</Link>
          <Link href="/consultoria/estoque" className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50">{t('Meu estoque')}</Link>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile accent="amber" label={t('Visitas hoje')} value={visitsToday} />
        <StatTile accent="blue" label={t('A diagnosticar')} value={awaiting} />
        <StatTile accent="red" label={t('Vacinas atrasadas')} value={lateShots} />
        <StatTile accent="green" icon="tarefa" label={t('Atrasados')} value={lateTotal} detail={t('Manejos que já passaram da data')} />
      </div>

      <nav className="mb-5 flex gap-1 overflow-x-auto border-b border-gray-200" aria-label={t('Seções da consultoria')}>
        {([
          ['agenda', t('Agenda e atividades'), CalendarioIcon],
          ['fazendas', `${t('Fazendas atendidas')} (${panel.clients.length})`, PropriedadeIcon],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} type="button" onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}
            className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold ${tab === key ? 'border-green-700 text-green-800' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
            <Icon className="h-5 w-5" />{label}
          </button>
        ))}
      </nav>

      {/* O dia do veterinário: visitas e manejos de todas as propriedades, por dia */}
      <div className={tab === 'agenda' ? 'mb-8' : 'hidden'}>
        <AgendaView endpoint="/api/veterinario/agenda" vet refreshKey={agendaKey}
          clients={panel.clients.map((c) => ({ farmId: c.farmId, name: c.name }))}
          onOpen={(item, href) => { const c = panel.clients.find((x) => x.farmId === item.farmId); if (c) void openFarm(c, href) }}
          onVisit={(item, action) => void visitAction(item, action)} />
        <Agenda ref={agenda} formOnly clients={panel.clients.map((c) => ({ id: c.id, name: c.name }))} onChanged={() => { void load(); setAgendaKey((k) => k + 1) }} />
      </div>


      {tab === 'fazendas' && <>



      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{t('Propriedades atendidas')}</h2>
          <p className="text-sm text-gray-500">{t('Abra o painel da fazenda para lançar coberturas, diagnósticos e ver os números dela.')}</p>
        </div>
        {/* Código de convite: compacto, no canto (é para vincular produtor, não para o dia a dia) */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
          <p className="text-sm font-semibold text-gray-800">{t('Código de convite')}</p>
          <p className="text-xs text-gray-500">{t('O produtor informa em “Meu veterinário” para liberar a propriedade.')}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-xl font-bold tracking-widest text-gray-900">{panel.vet.inviteCode}</span>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(inviteLink).then(() => setCopied(true)) }} className="rounded-lg border border-green-700 px-2.5 py-1 text-xs font-semibold text-green-800 hover:bg-green-50">{t(copied ? 'Copiado!' : 'Copiar link')}</button>
            <a href={`https://wa.me/?text=${encodeURIComponent(inviteText)}`} target="_blank" rel="noreferrer" className="rounded-lg bg-green-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-green-600">WhatsApp</a>
          </div>
        </div>
      </div>
      <div className="mb-3 flex justify-end">
        <button type="button" onClick={() => { setFormError(''); setNewFarm({ name: '', owner: '', phone: '', city: '', state: '' }) }} className="rounded-lg bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600">{t('+ Propriedade de cliente')}</button>
      </div>

      {panel.clients.length === 0 && (
        <p className="bg-white rounded-xl border border-gray-200 p-6 text-center text-gray-500">
          {t('Nenhuma propriedade ainda. Envie o seu código ao produtor ou cadastre a propriedade de um cliente que ainda não usa o sistema.')}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {panel.clients.map((c) => (
          <article key={c.id} className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
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
            <p className="mt-3 text-sm text-gray-600">{t('Situação')}: <span className={`ml-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${c.awaitingDiagnosis ? 'bg-amber-100 text-amber-900' : 'bg-green-100 text-green-800'}`}>{t(c.awaitingDiagnosis ? 'Pendente' : 'Em dia')}</span></p>
            <button type="button" disabled={busy === c.id} onClick={() => openFarm(c, '/')} className="mt-4 w-full rounded-xl bg-gradient-to-r from-green-700 to-teal-600 py-2.5 font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-60">{t('Abrir painel')}</button>
            <div className="mt-2 flex flex-wrap gap-2">
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
      </>}

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
