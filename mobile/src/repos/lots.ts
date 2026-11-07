// Lotes de recria e engorda: leitura da cópia local e escritas que entram na fila (outbox).
// A linha de `lots` guarda o lote como a API devolve (supplies, feedings, weighings e animals em JSON);
// cada escrita aplica a mesma mudança nessa cópia para a tela refletir na hora, mesmo sem internet.
import * as Crypto from 'expo-crypto'
import { all, deleteRow, one, parseJson, patchRow, upsert, type Row } from '@/db'
import { notifyChange } from '@/db/events'
import { isoDay, todayISO } from '@/lib/format'
import {
  average, dailySupplyKg, daysOfStock, kgInStockUnit, lotSummary, pricePerKg, stockKg, type Feeding, type Weighing,
} from '@/lib/lots'
import { createLocal, currentId, deleteLocal, isLocalId, updateLocal } from '@/sync/local'
import type { Animal } from './animals'
import type { Supply } from './supplies'

export interface SupplyRef { id: string; name: string; unit: string; currentQuantity: number; packageKg: number | null; unitPrice: number | null }
export interface Coverage {
  id: string
  heatDate: string | null
  method: string | null
  coverageDate: string
  expectedBirthDate: string | null
  semenBatch: string | null
  bullRegistry: string | null
  inseminator: string | null
  maleName: string | null
  status: string
}
export interface LotAnimal {
  id: string
  code: string
  customCode: string | null
  name: string
  gender: string
  birthDate: string
  weighings: { date: string; weight: number }[]
  reproductions: Coverage[]
}
export type LotWeighing = Weighing & { id: string }
export type LotFeeding = Feeding & { id: string; supplyId: string | null }
export interface LotSupply { id: string; percent: number | null; supply: SupplyRef }
export interface Lot {
  id: string
  name: string
  phase: string
  startDate: string
  endDate: string | null
  targetWeight: number | null
  notes: string | null
  supplies: LotSupply[]
  weighings: LotWeighing[]
  feedings: LotFeeding[]
  animals: LotAnimal[]
}

/** Animal do rebanho com os campos de lote e recria (a interface Animal do repositório não os lista) */
export type HerdAnimal = Animal & { lotId: string | null; rearingStart: string | null; rearingEnd: string | null; rearingTarget: number | null }

/** Registro criado no aparelho e ainda não enviado: não dá para editar nem apagar antes do envio (o servidor ainda não tem o id) */
export const isPending = (id: string) => isLocalId(id)

const localId = () => 'local_' + Crypto.randomUUID()
const byDate = <T extends { date: string }>(list: T[]) => [...list].sort((a, b) => a.date.localeCompare(b.date))

function toLot(row: Row): Lot {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    phase: String(row.phase ?? 'engorda'),
    startDate: isoDay(row.startDate as string),
    endDate: row.endDate ? isoDay(row.endDate as string) : null,
    targetWeight: row.targetWeight === null || row.targetWeight === undefined ? null : Number(row.targetWeight),
    notes: (row.notes as string | null) ?? null,
    supplies: parseJson<LotSupply[]>(row.supplies, []),
    weighings: byDate(parseJson<LotWeighing[]>(row.weighings, []).map(w => ({ ...w, date: isoDay(w.date) }))),
    feedings: byDate(parseJson<LotFeeding[]>(row.feedings, []).map(f => ({ ...f, date: isoDay(f.date) }))),
    animals: parseJson<LotAnimal[]>(row.animals, []).map(a => ({ ...a, weighings: byDate((a.weighings ?? []).map(w => ({ ...w, date: isoDay(w.date) }))), reproductions: a.reproductions ?? [] })),
  }
}

/** Abertos primeiro (mais recentes no topo), depois os encerrados — a mesma ordem da API */
export function listLots(farmId: string): Lot[] {
  return all('SELECT * FROM lots WHERE farmId = ? ORDER BY (endDate IS NULL) DESC, endDate DESC, startDate DESC', [farmId]).map(toLot)
}

/** Aceita o id local de um lote criado no aparelho mesmo depois de o servidor devolver o definitivo */
export function getLot(id: string): Lot | null {
  const row = one('SELECT * FROM lots WHERE id = ?', [currentId(id)])
  return row ? toLot(row) : null
}

/** Rebanho vivo, para escolher quem entra no lote */
export function listHerd(farmId: string): HerdAnimal[] {
  return all<HerdAnimal>("SELECT * FROM animals WHERE farmId = ? AND status = 'Vivo' ORDER BY code, name COLLATE NOCASE", [farmId])
}

export const openLotNames = (lots: Lot[]) => new Map(lots.filter(l => !l.endDate).map(l => [l.id, l.name]))

export const supplyRef = (s: Supply): SupplyRef => ({ id: s.id, name: s.name, unit: s.unit, currentQuantity: s.currentQuantity, packageKg: s.packageKg, unitPrice: s.unitPrice })

/** O animal como entra no JSON do lote: pesagens individuais e última cobertura da cópia local */
function lotAnimal(a: HerdAnimal, entry?: { date: string; weight: number }): LotAnimal {
  const weighings = all<{ date: string; weight: number }>('SELECT date, weight FROM animal_weighings WHERE animalId = ? ORDER BY date', [a.id]).map(w => ({ date: isoDay(w.date), weight: w.weight }))
  if (entry) weighings.push(entry)
  const cov = one<Row>('SELECT * FROM reproductions WHERE femaleId = ? ORDER BY coverageDate DESC LIMIT 1', [a.id])
  const reproductions: Coverage[] = cov ? [{
    id: String(cov.id), heatDate: cov.heatDate ? isoDay(cov.heatDate as string) : null, method: (cov.method as string | null) ?? null,
    coverageDate: isoDay(cov.coverageDate as string), expectedBirthDate: cov.expectedBirthDate ? isoDay(cov.expectedBirthDate as string) : null,
    semenBatch: (cov.semenBatch as string | null) ?? null, bullRegistry: (cov.bullRegistry as string | null) ?? null, inseminator: (cov.inseminator as string | null) ?? null,
    maleName: (cov.maleName as string | null) ?? null, status: String(cov.status ?? ''),
  }] : []
  return { id: a.id, code: a.code, customCode: a.customCode, name: a.name, gender: a.gender, birthDate: isoDay(a.birthDate), weighings: byDate(weighings), reproductions }
}

/** Os animais passam a este lote: `lotId` na cópia local e saem do JSON dos outros lotes */
function moveAnimalsTo(farmId: string, lotId: string, animalIds: string[]) {
  if (!animalIds.length) return
  for (const id of animalIds) patchRow('animals', id, { lotId })
  const moved = new Set(animalIds)
  for (const other of listLots(farmId)) {
    if (other.id === lotId || !other.animals.some(a => moved.has(a.id))) continue
    patchRow('lots', other.id, { animals: other.animals.filter(a => !moved.has(a.id)) })
  }
}

// ── Produtos do lote ────────────────────────────────────────────────────

export interface ProductInput { supplyId: string; percent: number | null; packageKg?: number; unitPrice?: number }

/** Lista de produtos como a API devolve, a partir do estoque local; guarda peso do saco e preço informados */
function lotSupplies(lot: Lot | null, items: ProductInput[]): LotSupply[] {
  const out: LotSupply[] = []
  for (const item of items) {
    const supply = one<Supply>('SELECT * FROM supplies WHERE id = ?', [item.supplyId])
    if (!supply) continue
    const patch: Row = {}
    if (item.packageKg !== undefined) patch.packageKg = item.packageKg
    if (item.unitPrice !== undefined) patch.unitPrice = item.unitPrice
    if (Object.keys(patch).length) patchRow('supplies', supply.id, patch)
    const existing = lot?.supplies.find(s => s.supply.id === item.supplyId)
    out.push({ id: existing?.id ?? localId(), percent: item.percent, supply: supplyRef({ ...supply, ...patch } as Supply) })
  }
  return out.sort((a, b) => a.supply.name.localeCompare(b.supply.name))
}

const productsPayload = (items: ProductInput[]) => items.map(p => ({ supplyId: p.supplyId, percent: p.percent, packageKg: p.packageKg, unitPrice: p.unitPrice }))

/** Consumo de cada produto do lote por dia e para quantos dias o estoque dá */
export function productLines(lot: Lot, today = todayISO()) {
  const s = lotSummary(lot.weighings, today, lot.endDate)
  return lot.supplies.map(item => {
    const perDay = dailySupplyKg(s.last, item.percent)
    return {
      ...item,
      perDay,
      perHead: perDay && s.last ? Math.round((perDay / s.last.headCount) * 1000) : null,
      days: perDay && !lot.endDate ? daysOfStock(stockKg(item.supply), perDay) : null,
    }
  })
}

// ── Novo lote ───────────────────────────────────────────────────────────

export interface LotInput {
  name: string
  phase: string
  startDate: string
  targetWeight: number | null
  notes?: string
  supplies: ProductInput[]
  /** Com animais cadastrados: ids e o peso de entrada de cada um (os sem peso ficam de fora de `weights`) */
  animals?: { ids: string[]; weights: Record<string, number> }
  /** Só a quantidade: cabeças e peso médio (também usado quando há animais sem nenhum peso) */
  headCount?: number
  avgWeight?: number
}

/** Cria o lote com a pesagem de entrada; os animais recebem o lote. Devolve o id local. */
export function createLot(farmId: string, input: LotInput): string {
  const ids = input.animals?.ids ?? []
  const weights = input.animals?.weights ?? {}
  const weighed = Object.values(weights)
  const headCount = ids.length || input.headCount || 0
  const avgWeight = weighed.length ? average(weighed) : input.avgWeight ?? 0
  const body: Row = {
    name: input.name.trim(), phase: input.phase, startDate: input.startDate, targetWeight: input.targetWeight,
    notes: input.notes?.trim() || null, supplies: productsPayload(input.supplies),
  }
  if (ids.length) Object.assign(body, { animalIds: ids, weights, headCount, avgWeight: input.avgWeight })
  else Object.assign(body, { headCount, avgWeight })
  const herd = ids.map(id => one<HerdAnimal>('SELECT * FROM animals WHERE id = ?', [id])).filter((a): a is HerdAnimal => !!a)
  const row: Row = {
    endDate: null,
    supplies: lotSupplies(null, input.supplies),
    feedings: [],
    weighings: [{ id: localId(), date: input.startDate, headCount, avgWeight }],
    animals: herd.map(a => lotAnimal(a, weights[a.id] ? { date: input.startDate, weight: weights[a.id] } : undefined)),
  }
  const id = createLocal({ table: 'lots', farmId, path: '/api/lotes', body, row })
  moveAnimalsTo(farmId, id, ids)
  notifyChange()
  return id
}

// ── Alterações do lote (PATCH /api/lotes/{id}) ───────────────────────────

export interface LotPatch {
  name?: string
  phase?: string
  startDate?: string
  notes?: string
  targetWeight?: number | null
  supplies?: ProductInput[]
  addAnimalIds?: string[]
  removeAnimalIds?: string[]
  /** 'yyyy-mm-dd' encerra; null reabre */
  endDate?: string | null
}

export function patchLot(farmId: string, lot: Lot, patch: LotPatch) {
  const body: Row = {}
  const row: Row = {}
  if (patch.name !== undefined) body.name = patch.name.trim()
  if (patch.phase !== undefined) body.phase = patch.phase
  if (patch.notes !== undefined) body.notes = patch.notes.trim() || null
  if (patch.targetWeight !== undefined) body.targetWeight = patch.targetWeight
  if (patch.endDate !== undefined) body.endDate = patch.endDate
  if (patch.supplies !== undefined) {
    body.supplies = productsPayload(patch.supplies)
    row.supplies = lotSupplies(lot, patch.supplies)
  }
  let animals = lot.animals
  if (patch.startDate !== undefined && patch.startDate !== lot.startDate) {
    // A pesagem de entrada (e os pesos de cada animal nesse dia) acompanham a nova data
    const entry = lot.weighings[0]
    body.startDate = patch.startDate
    if (entry) {
      row.weighings = byDate(lot.weighings.map(w => (w.id === entry.id ? { ...w, date: patch.startDate! } : w)))
      animals = animals.map(a => ({ ...a, weighings: byDate(a.weighings.map(w => (w.date === entry.date ? { ...w, date: patch.startDate! } : w))) }))
      row.animals = animals
    }
  }
  const add = (patch.addAnimalIds ?? []).filter(id => !animals.some(a => a.id === id))
  const remove = new Set(patch.removeAnimalIds ?? [])
  if (add.length || remove.size) {
    const added = add.map(id => one<HerdAnimal>('SELECT * FROM animals WHERE id = ?', [id])).filter((a): a is HerdAnimal => !!a).map(a => lotAnimal(a))
    animals = [...animals.filter(a => !remove.has(a.id)), ...added].sort((a, b) => a.code.localeCompare(b.code))
    row.animals = animals
    if (isLocalId(currentId(lot.id))) {
      // O lote ainda não foi enviado: a alteração entra no próprio POST, que só entende a lista completa
      body.animalIds = animals.map(a => a.id)
      body.weights = Object.fromEntries(animals.flatMap(a => { const w = a.weighings.find(x => x.date === lot.startDate); return w ? [[a.id, w.weight]] : [] }))
    } else {
      if (add.length) body.addAnimalIds = add
      if (remove.size) body.removeAnimalIds = [...remove]
    }
  }
  if (!Object.keys(body).length) return
  updateLocal({ table: 'lots', farmId, id: lot.id, path: `/api/lotes/${lot.id}`, method: 'PATCH', body, row })
  moveAnimalsTo(farmId, lot.id, add)
  for (const id of remove) patchRow('animals', id, { lotId: null })
  notifyChange()
}

/** Exclui o lote: as pesagens vão junto e os animais ficam sem lote */
export function removeLot(farmId: string, lot: Lot) {
  for (const a of lot.animals) patchRow('animals', a.id, { lotId: null })
  deleteLocal({ table: 'lots', farmId, id: lot.id, path: `/api/lotes/${lot.id}` })
}

// ── Pesagens (/api/lotes/{id}/pesagens) ─────────────────────────────────

const weighingsPath = (lot: Lot) => `/api/lotes/${lot.id}/pesagens`

export type WeighingInput = { date: string; weights: Record<string, number> } | { date: string; headCount: number; avgWeight: number }

/** Pesos de cada animal no JSON do lote: tira os do dia antigo (se houver) e põe os novos */
function applyAnimalWeights(animals: LotAnimal[], weights: Record<string, number>, date: string, oldDate?: string): LotAnimal[] {
  return animals.map(a => {
    const kept = oldDate ? a.weighings.filter(w => w.date !== oldDate) : a.weighings
    const w = weights[a.id]
    return { ...a, weighings: byDate(w ? [...kept, { date, weight: w }] : kept) }
  })
}

export function addWeighing(farmId: string, lot: Lot, input: WeighingInput) {
  const row: Row = {}
  let weighing: LotWeighing
  if ('weights' in input) {
    weighing = { id: localId(), date: input.date, headCount: lot.animals.length, avgWeight: average(Object.values(input.weights)) }
    row.animals = applyAnimalWeights(lot.animals, input.weights, input.date)
  } else {
    weighing = { id: localId(), date: input.date, headCount: input.headCount, avgWeight: Math.round(input.avgWeight * 10) / 10 }
  }
  row.weighings = byDate([...lot.weighings, weighing])
  updateLocal({ table: 'lots', farmId, id: lot.id, path: weighingsPath(lot), method: 'POST', body: input as unknown as Row, row })
}

export function editWeighing(farmId: string, lot: Lot, weighingId: string, input: WeighingInput) {
  const current = lot.weighings.find(w => w.id === weighingId)
  if (!current) return
  const isEntry = lot.weighings[0]?.id === weighingId
  const row: Row = {}
  let updated: LotWeighing
  if ('weights' in input) {
    updated = { ...current, date: input.date, headCount: lot.animals.length, avgWeight: average(Object.values(input.weights)) }
    row.animals = applyAnimalWeights(lot.animals, input.weights, input.date, current.date)
  } else {
    updated = { ...current, date: input.date, headCount: input.headCount, avgWeight: Math.round(input.avgWeight * 10) / 10 }
    row.animals = lot.animals.map(a => ({ ...a, weighings: byDate(a.weighings.map(w => (w.date === current.date ? { ...w, date: input.date } : w))) }))
  }
  row.weighings = byDate(lot.weighings.map(w => (w.id === weighingId ? updated : w)))
  if (isEntry) row.startDate = input.date
  updateLocal({ table: 'lots', farmId, id: lot.id, path: weighingsPath(lot), method: 'PATCH', body: { weighingId, ...input }, row })
}

export function removeWeighing(farmId: string, lot: Lot, weighingId: string) {
  const current = lot.weighings.find(w => w.id === weighingId)
  if (!current) return
  const row: Row = {
    weighings: lot.weighings.filter(w => w.id !== weighingId),
    animals: lot.animals.map(a => ({ ...a, weighings: a.weighings.filter(w => w.date !== current.date) })),
  }
  updateLocal({ table: 'lots', farmId, id: lot.id, path: weighingsPath(lot), method: 'DELETE', body: { weighingId }, row })
}

// ── Trato no cocho (/api/lotes/{id}/tratos) ─────────────────────────────

const feedingsPath = (lot: Lot) => `/api/lotes/${lot.id}/tratos`

/** Ajusta o estoque local do produto (na tabela e na cópia dentro do lote) */
function adjustStock(lot: Lot, supplyId: string, delta: number): LotSupply[] {
  const supply = one<Supply>('SELECT * FROM supplies WHERE id = ?', [supplyId])
  if (supply) patchRow('supplies', supplyId, { currentQuantity: supply.currentQuantity + delta })
  return lot.supplies.map(s => (s.supply.id === supplyId ? { ...s, supply: { ...s.supply, currentQuantity: s.supply.currentQuantity + delta } } : s))
}

/** Movimentação de saída na cópia local (o servidor cria a dele; a próxima sincronização substitui esta) */
function localMovement(farmId: string, lot: Lot, supplyId: string, quantity: number, date: string) {
  upsert('supply_movements', farmId, { id: 'trato_' + Crypto.randomUUID(), supplyId, type: 'Saída', quantity, date, description: `Trato do lote ${lot.name}`, createdAt: new Date().toISOString() })
}

function dropMovement(lot: Lot, supplyId: string, quantity: number, date: string) {
  const found = one<{ id: string }>(
    "SELECT id FROM supply_movements WHERE supplyId = ? AND type = 'Saída' AND substr(date, 1, 10) = ? AND quantity = ? AND description = ? LIMIT 1",
    [supplyId, date, quantity, `Trato do lote ${lot.name}`],
  )
  if (found) deleteRow('supply_movements', found.id)
}

/** Lança o trato e dá baixa no estoque. Devolve o texto do erro quando não dá para converter os kg na unidade do estoque. */
export function addFeeding(farmId: string, lot: Lot, input: { date: string; supplyId: string; kg: number }, today = todayISO()): string | null {
  const item = lot.supplies.find(s => s.supply.id === input.supplyId)
  if (!item) return 'Escolha um dos produtos do lote'
  const supply = item.supply
  const quantity = kgInStockUnit(supply, input.kg)
  if (quantity === null) {
    return supply.unit === 'sacos' ? `Informe o peso do saco de ${supply.name} para dar baixa no estoque` : 'O estoque deste produto precisa estar em kg ou sacos'
  }
  const last = lotSummary(lot.weighings, today, lot.endDate).last
  const perKg = pricePerKg(supply)
  const feeding: LotFeeding = {
    id: localId(), date: input.date, supplyId: supply.id, kg: Math.round(input.kg * 10) / 10,
    suggestedKg: dailySupplyKg(last, item.percent), cost: perKg !== null ? Math.round(input.kg * perKg * 100) / 100 : null,
  }
  const row: Row = { feedings: byDate([...lot.feedings, feeding]), supplies: adjustStock(lot, supply.id, -quantity) }
  localMovement(farmId, lot, supply.id, quantity, input.date)
  updateLocal({ table: 'lots', farmId, id: lot.id, path: feedingsPath(lot), method: 'POST', body: { date: input.date, supplyId: supply.id, kg: input.kg }, row })
  return null
}

export function editFeeding(farmId: string, lot: Lot, feedingId: string, input: { date: string; kg: number }) {
  const current = lot.feedings.find(f => f.id === feedingId)
  if (!current) return
  const supply = lot.supplies.find(s => s.supply.id === current.supplyId)?.supply
  const row: Row = {}
  const perKg = supply ? pricePerKg(supply) : null
  const updated: LotFeeding = { ...current, date: input.date, kg: Math.round(input.kg * 10) / 10, cost: perKg !== null ? Math.round(input.kg * perKg * 100) / 100 : null }
  row.feedings = byDate(lot.feedings.map(f => (f.id === feedingId ? updated : f)))
  if (supply) {
    const before = kgInStockUnit(supply, current.kg)
    const after = kgInStockUnit(supply, input.kg)
    if (before !== null && after !== null) {
      row.supplies = adjustStock(lot, supply.id, before - after)
      dropMovement(lot, supply.id, before, current.date)
      localMovement(farmId, lot, supply.id, after, input.date)
    }
  }
  updateLocal({ table: 'lots', farmId, id: lot.id, path: feedingsPath(lot), method: 'PATCH', body: { feedingId, date: input.date, kg: input.kg }, row })
}

/** Apaga o trato; a quantidade volta para o estoque */
export function removeFeeding(farmId: string, lot: Lot, feedingId: string) {
  const current = lot.feedings.find(f => f.id === feedingId)
  if (!current) return
  const supply = lot.supplies.find(s => s.supply.id === current.supplyId)?.supply
  const row: Row = { feedings: lot.feedings.filter(f => f.id !== feedingId) }
  const quantity = supply ? kgInStockUnit(supply, current.kg) : null
  if (supply && quantity !== null) {
    row.supplies = adjustStock(lot, supply.id, quantity)
    dropMovement(lot, supply.id, quantity, current.date)
  }
  updateLocal({ table: 'lots', farmId, id: lot.id, path: feedingsPath(lot), method: 'DELETE', body: { feedingId }, row })
}
