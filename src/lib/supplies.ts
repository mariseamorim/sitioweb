// Categorias de insumo: as mesmas no estoque e nas ofertas dos fornecedores,
// para que "estoque baixo de Sal mineral" encontre "oferta de Sal mineral"
export const SUPPLY_CATEGORIES = ['Ração', 'Sal mineral', 'Medicamento', 'Vacina', 'Sementes', 'Adubo', 'Outro'] as const

/** Unidade como o servidor guarda: o app antigo mandava "saco", o site "sacos"; as contas de kg usam "sacos" */
export const normalizeUnit = (unit: unknown): string | undefined =>
  typeof unit === 'string' ? (unit.trim().toLowerCase() === 'saco' ? 'sacos' : unit) : undefined
