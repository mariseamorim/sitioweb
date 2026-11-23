'use client'

// Consultoria › Animais: os animais de todas as fazendas que o veterinário atende, com a fazenda de cada um,
// filtro por fazenda e busca. "Cadastrar animal" escolhe uma fazenda atendida ou digita o nome de uma que ainda
// não está no sistema (o servidor cria a propriedade de cliente). Rota: /api/veterinario/animais.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppModal, modalButton } from '@/components/AppModal'
import { AnimalIcon } from '@/components/ModuleIcons'
import { ESPECIE_GRUPOS } from '@/lib/types'
import { CATTLE_BREEDS, fixedAnimalGender, isBovine } from '@/lib/animalRules'
import { animalCodes, animalSearchText } from '@/lib/animalCode'
import { formatarIdade, todayISO } from '@/lib/utils'
import { useT } from '@/lib/i18n'

interface VetAnimal {
  id: string; code: string; customCode: string | null; name: string; species: string; gender: string
  birthDate: string; status: string; breed: string | null; farmId: string; farmName: string
}
interface Client { id: string; farmId: string | null; name: string }

const FIELD = 'mt-1 w-full rounded-xl border border-gray-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600'
const NEW_FARM = '__nova'
const EMPTY = { farmId: '', newFarmName: '', name: '', customCode: '', species: 'Vaca', gender: 'Fêmea', birthDate: '', breed: '', status: 'Vivo' }

const STATUS_TONE: Record<string, string> = {
  Vivo: 'bg-green-100 text-green-800', Doente: 'bg-amber-100 text-amber-900', Vendido: 'bg-blue-100 text-blue-800', Morto: 'bg-gray-200 text-gray-700', Arrendado: 'bg-violet-100 text-violet-800',
}

export function VetAnimals({ clients, onFarmCreated, onOpen }: {
  clients: Client[]
  /** Uma fazenda nova foi criada no cadastro do animal: a Consultoria recarrega a lista de fazendas */
  onFarmCreated: () => void
  /** Abre a fazenda do animal na tela de animais */
  onOpen: (farmId: string) => void
}) {
  const t = useT()
  const [animals, setAnimals] = useState<VetAnimal[] | null>(null)
  const [error, setError] = useState('')
  const [farm, setFarm] = useState('')
  const [query, setQuery] = useState('')
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/veterinario/animais')
      if (!res.ok) throw new Error()
      setAnimals(await res.json())
    } catch { setError(t('Não foi possível carregar os animais. Confira a internet.')) }
  }, [t])
  useEffect(() => { void load() }, [load])

  const farms = clients.filter((c) => c.farmId)
  const term = query.trim().toLocaleLowerCase('pt-BR')
  const shown = useMemo(() => (animals ?? []).filter((a) => (!farm || a.farmId === farm) && (!term || animalSearchText(a).includes(term) || a.farmName.toLocaleLowerCase('pt-BR').includes(term))), [animals, farm, term])
  const countOf = (farmId: string) => (animals ?? []).filter((a) => a.farmId === farmId).length

  function openNew() {
    setFormError('')
    setForm({ ...EMPTY, farmId: farm || farms[0]?.farmId || NEW_FARM })
  }

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (!form) return
    if (form.farmId === NEW_FARM && !form.newFarmName.trim()) return setFormError(t('Informe o nome da fazenda'))
    setSaving(true)
    setFormError('')
    try {
      const { farmId, newFarmName, ...animal } = form
      const res = await fetch('/api/veterinario/animais', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...animal, ...(farmId === NEW_FARM ? { newFarmName } : { farmId }), acquisitionType: 'existente', isCastrated: animal.species === 'Boi de engorda' }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.farmCreated) onFarmCreated()
      if (!res.ok) throw new Error(data.error || 'Não foi possível salvar.')
      setNotice(t('{name} cadastrado em {farm}.', { name: animal.name, farm: farmId === NEW_FARM ? newFarmName : farms.find((f) => f.farmId === farmId)?.name ?? '' }))
      setForm(null)
      void load()
    } catch (err) {
      setFormError(t((err as Error).message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-label={t('Animais')}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">{t('Animais das fazendas atendidas')}</h2>
          <p className="text-sm text-gray-500">{animals ? t(shown.length === 1 ? '{n} animal' : '{n} animais', { n: shown.length }) : t('Carregando…')}</p>
        </div>
        <button type="button" onClick={openNew} className="rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-green-600">+ {t('Cadastrar animal')}</button>
      </div>

      {/* Filtro por fazenda e busca */}
      <div className="mb-3 flex flex-wrap gap-2">
        <select value={farm} onChange={(e) => setFarm(e.target.value)} aria-label={t('Fazenda')} className="rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm">
          <option value="">{t('Todas as fazendas')} ({animals?.length ?? 0})</option>
          {farms.map((f) => <option key={f.farmId} value={f.farmId!}>{f.name} ({countOf(f.farmId!)})</option>)}
        </select>
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Buscar por nome, código ou fazenda...')} className="min-w-0 flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm sm:max-w-sm" />
      </div>

      {notice && <p role="status" className="mb-3 rounded-xl bg-green-50 px-4 py-2.5 text-sm text-green-900">✓ {notice}</p>}
      {error && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-2.5 text-sm text-red-700">{error}</p>}

      {animals && !shown.length ? (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-500">{t(animals.length ? 'Nenhum animal nesta busca.' : 'Nenhum animal ainda. Cadastre o primeiro em "Cadastrar animal".')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-blue-900 text-xs uppercase tracking-wide text-blue-50">
              <tr>{['Código', 'Nome', 'Categoria', 'Idade', 'Fazenda', 'Situação', ''].map((h) => <th key={h} className="whitespace-nowrap px-3 py-2.5 text-left font-semibold">{h ? t(h) : ''}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((a) => (
                <tr key={a.id} className="odd:bg-white even:bg-gray-50/70 hover:bg-green-50/60">
                  <td className="whitespace-nowrap px-3 py-2.5 font-semibold text-gray-900">{animalCodes(a)}</td>
                  <td className="px-3 py-2.5 text-gray-800">{a.name}{a.breed ? <span className="text-gray-500"> · {a.breed}</span> : null}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-700">{t(a.species)}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-gray-600">{formatarIdade(a.birthDate)}</td>
                  <td className="px-3 py-2.5"><span className="inline-block rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-800 ring-1 ring-teal-200">{a.farmName}</span></td>
                  <td className="px-3 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_TONE[a.status] ?? 'bg-gray-100 text-gray-700'}`}>{t(a.status)}</span></td>
                  <td className="px-3 py-2.5 text-right"><button type="button" onClick={() => onOpen(a.farmId)} className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50">{t('Abrir na fazenda')}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <AppModal title={t('Cadastrar animal')} subtitle={t('Em uma fazenda atendida ou em uma que ainda não está no sistema')} onClose={() => setForm(null)}
          icon={<AnimalIcon className="h-6 w-6" />} tone="green"
          footer={<>
            <button type="button" onClick={() => setForm(null)} className={modalButton.ghost}>{t('Cancelar')}</button>
            <button type="submit" form="form-vet-animal" disabled={saving} className={modalButton.primary}>{t(saving ? 'Salvando...' : 'Cadastrar animal')}</button>
          </>}
          note={form.farmId === NEW_FARM ? t('A fazenda nova entra em "Fazendas atendidas". Depois você pode completar os dados e dar o acesso ao produtor.') : undefined}>
          <form id="form-vet-animal" onSubmit={save} className="flex flex-col gap-4">
            <label className="text-sm font-medium text-gray-700">{t('Fazenda')} *
              <select value={form.farmId} onChange={(e) => setForm({ ...form, farmId: e.target.value })} className={`${FIELD} bg-white`}>
                {farms.map((f) => <option key={f.farmId} value={f.farmId!}>{f.name}</option>)}
                <option value={NEW_FARM}>{t('Outra fazenda (ainda não cadastrada)')}</option>
              </select>
            </label>
            {form.farmId === NEW_FARM && (
              <label className="text-sm font-medium text-gray-700">{t('Nome da fazenda')} *
                <input value={form.newFarmName} onChange={(e) => setForm({ ...form, newFarmName: e.target.value })} required placeholder={t('Ex.: Sítio Boa Vista')} className={FIELD} autoFocus />
              </label>
            )}
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">{t('Nome')} *
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder={t('Ex.: Mimosa')} className={FIELD} />
              </label>
              <label className="text-sm font-medium text-gray-700">{t('Brinco ou código (opcional)')}
                <input value={form.customCode} onChange={(e) => setForm({ ...form, customCode: e.target.value })} placeholder={t('Ex.: 1234')} className={FIELD} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">{t('Espécie / categoria')} *
                <select value={form.species} onChange={(e) => { const species = e.target.value; setForm({ ...form, species, gender: fixedAnimalGender(species) ?? form.gender }) }} className={`${FIELD} bg-white`}>
                  {ESPECIE_GRUPOS.map((g) => <optgroup key={g.label} label={t(g.label)}>{g.species.map((s) => <option key={s} value={s}>{t(s)}</option>)}</optgroup>)}
                </select>
              </label>
              <label className="text-sm font-medium text-gray-700">{t('Sexo')} *
                <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} disabled={!!fixedAnimalGender(form.species)} className={`${FIELD} bg-white disabled:bg-gray-100`}>
                  <option value="Fêmea">{t('Fêmea')}</option>
                  <option value="Macho">{t('Macho')}</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm font-medium text-gray-700">{t('Nascimento')} *
                <input type="date" max={todayISO()} value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} required className={FIELD} />
              </label>
              {isBovine(form.species) ? (
                <label className="text-sm font-medium text-gray-700">{t('Raça')}
                  <input list="racas-vet" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} placeholder={t('Ex.: Gir, Holandesa')} className={FIELD} />
                  <datalist id="racas-vet">{CATTLE_BREEDS.map((b) => <option key={b} value={b} />)}</datalist>
                </label>
              ) : <span />}
            </div>
            <p className="text-xs text-gray-500">{t('Bovinos mudam de categoria pela idade e pelo sexo (bezerra, novilha, vaca...). Se não souber a data exata, use uma aproximada.')}</p>
            {formError && <p role="alert" className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{formError}</p>}
          </form>
        </AppModal>
      )}
    </section>
  )
}
