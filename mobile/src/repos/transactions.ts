import { all, one, patchRow } from '@/db'
import { notifyChange } from '@/db/events'
import { createLocal, currentId, deleteLocal, updateLocal } from '@/sync/local'
import { getLot } from './lots'

export interface Transaction {
  id: string
  type: 'Receita' | 'Despesa'
  category: string
  date: string
  amount: number
  description: string | null
  /** Pago/recebido; no banco do aparelho vem como 1/0 (vazio nos lançamentos antigos = pago) */
  paid: boolean | number | null
  animalId: string | null
  animalName: string | null
  /** Lote de recria/engorda da despesa (entra no desempenho do lote) */
  lotId?: string | null
}

export const INCOME_CATEGORIES = ['Venda de Leite', 'Venda de Animal', 'Venda de Produção', 'Serviços', 'Outros']
export const EXPENSE_CATEGORIES = ['Ração', 'Sal mineral', 'Medicamentos', 'Vacinas', 'Mão de Obra', 'Energia', 'Combustível', 'Manutenção', 'Compra de Animal', 'Veterinário', 'Impostos', 'Outros']

export function listTransactions(farmId: string, from: string, to: string): Transaction[] {
  return all<Transaction>(
    `SELECT t.*, a.name AS animalName FROM transactions t LEFT JOIN animals a ON a.id = t.animalId
     WHERE t.farmId = ? AND substr(t.date, 1, 10) >= ? AND substr(t.date, 1, 10) <= ? ORDER BY t.date DESC, t.createdAt DESC`,
    [farmId, from, to],
  )
}

/** Lançamento antigo, sem a informação, conta como pago */
export const isPaid = (t: Transaction) => !(t.paid === false || t.paid === 0)

export function totals(items: Transaction[]) {
  let income = 0, expense = 0, toReceive = 0, toPay = 0
  for (const t of items) {
    if (t.type === 'Receita') { income += t.amount; if (!isPaid(t)) toReceive += t.amount } else { expense += t.amount; if (!isPaid(t)) toPay += t.amount }
  }
  return { income, expense, balance: income - expense, toReceive, toPay }
}

export interface TransactionInput { type: 'Receita' | 'Despesa'; category: string; date: string; amount: number; description: string; animalId: string | null; paid: boolean; lotId?: string | null }

export function saveTransaction(farmId: string, input: TransactionInput): string {
  const lotId = input.type === 'Despesa' ? input.lotId || null : null
  const body = { type: input.type, category: input.category, date: input.date, amount: input.amount, description: input.description.trim() || null, animalId: input.type === 'Receita' ? input.animalId || null : null, paid: input.paid, lotId }
  const id = createLocal({ table: 'transactions', farmId, path: '/api/financeiro', body })
  // A despesa entra na cópia do lote na hora, para o desempenho do lote já contar com ela (mesmo sem internet)
  const lot = lotId ? getLot(lotId) : null
  if (lot) {
    patchRow('lots', lot.id, { transactions: [...lot.transactions, { id, category: body.category, amount: body.amount, date: body.date, description: body.description }] })
    notifyChange()
  }
  return id
}

/** Tira a despesa da cópia do lote (ao apagar o lançamento) */
function dropFromLot(id: string) {
  const row = one<{ lotId: string | null }>('SELECT lotId FROM transactions WHERE id = ?', [currentId(id)])
  const lot = row?.lotId ? getLot(row.lotId) : null
  if (!lot) return
  const ids = new Set([id, currentId(id)])
  patchRow('lots', lot.id, { transactions: lot.transactions.filter(x => !ids.has(x.id) && !ids.has(currentId(x.id))) })
}

/** Marca como pago/recebido ou em aberto (vai para o servidor pela fila, como os outros lançamentos) */
export function setPaid(farmId: string, id: string, paid: boolean) {
  updateLocal({ table: 'transactions', farmId, id, path: `/api/financeiro/${id}`, method: 'PATCH', body: { paid } })
}

export function removeTransaction(farmId: string, id: string) {
  dropFromLot(id)
  deleteLocal({ table: 'transactions', farmId, id, path: `/api/financeiro/${id}` })
}
