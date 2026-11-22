// Compra que liga o estoque ao financeiro (sem banco: usada pelas rotas, pela tela e pelo app).
// - Entrada no estoque com "Lançar a compra no financeiro": cria a despesa junto.
// - Despesa no financeiro com "Dar entrada no estoque": cria a entrada junto.
// As duas ficam ligadas (Transaction.supplyMovementId); apagar uma não apaga a outra.
// Cópia de src/lib/stockFinance.ts do site.

/** Categoria da despesa pela categoria do insumo (as do Financeiro) */
export function expenseCategoryFor(supplyCategory: string): string {
  if (supplyCategory === 'Ração' || supplyCategory === 'Sal mineral') return 'Ração'
  if (supplyCategory === 'Medicamento') return 'Medicamentos'
  if (supplyCategory === 'Vacina') return 'Vacinas'
  return 'Outros'
}

const toNumber = (v: unknown) => (typeof v === 'number' ? v : Number(String(v ?? '').trim().replace(/\./g, (m, i, s: string) => (s.includes(',') ? '' : m)).replace(',', '.')))

export interface PurchaseInput { amount: number; paid: boolean }
/** { amount, paid } da compra; null sem compra; 'invalid' com valor errado */
export function parsePurchase(raw: unknown): PurchaseInput | null | 'invalid' {
  if (!raw || typeof raw !== 'object') return null
  const { amount, paid } = raw as Record<string, unknown>
  const value = toNumber(amount)
  if (!Number.isFinite(value) || value <= 0 || value > 100_000_000) return 'invalid'
  return { amount: Math.round(value * 100) / 100, paid: paid === true }
}

export interface StockEntryInput { supplyId: string; quantity: number }
/** { supplyId, quantity } da entrada no estoque; null sem entrada; 'invalid' com dado errado */
export function parseStockEntry(raw: unknown): StockEntryInput | null | 'invalid' {
  if (!raw || typeof raw !== 'object') return null
  const { supplyId, quantity } = raw as Record<string, unknown>
  const qty = toNumber(quantity)
  if (typeof supplyId !== 'string' || !supplyId || !Number.isFinite(qty) || qty <= 0 || qty > 10_000_000) return 'invalid'
  return { supplyId, quantity: Math.round(qty * 100) / 100 }
}

/** Valor sugerido da compra: quantidade × preço da unidade (null sem preço) */
export const suggestedAmount = (quantity: number, unitPrice: number | null | undefined) =>
  unitPrice && quantity > 0 ? Math.round(quantity * unitPrice * 100) / 100 : null

export const purchaseDescription = (name: string, quantity: number, unit: string) =>
  `Compra de ${name} (${String(quantity).replace('.', ',')} ${unit})`
