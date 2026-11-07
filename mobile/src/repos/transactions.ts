import { all } from '@/db'
import { createLocal, deleteLocal } from '@/sync/local'

export interface Transaction {
  id: string
  type: 'Receita' | 'Despesa'
  category: string
  date: string
  amount: number
  description: string | null
  animalId: string | null
  animalName: string | null
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

export function totals(items: Transaction[]) {
  let income = 0, expense = 0
  for (const t of items) { if (t.type === 'Receita') income += t.amount; else expense += t.amount }
  return { income, expense, balance: income - expense }
}

export interface TransactionInput { type: 'Receita' | 'Despesa'; category: string; date: string; amount: number; description: string; animalId: string | null }

export function saveTransaction(farmId: string, input: TransactionInput): string {
  const body = { type: input.type, category: input.category, date: input.date, amount: input.amount, description: input.description.trim() || null, animalId: input.type === 'Receita' ? input.animalId || null : null }
  return createLocal({ table: 'transactions', farmId, path: '/api/financeiro', body })
}

export function removeTransaction(farmId: string, id: string) {
  deleteLocal({ table: 'transactions', farmId, id, path: `/api/financeiro/${id}` })
}
