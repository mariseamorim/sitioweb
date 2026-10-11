import { SUPPLY_CATEGORIES } from '@/lib/supplies'

// Leitura e validação dos campos de uma oferta enviada pelo fornecedor

export function parseOffer(body: Record<string, unknown>) {
  const price = body.price === '' || body.price == null ? null : parseFloat(String(body.price).replace(',', '.'))
  return {
    title: String(body.title ?? '').trim(),
    description: body.description ? String(body.description) : null,
    category: String(body.category ?? ''),
    price: price !== null && price > 0 ? price : null,
    unit: body.unit ? String(body.unit) : null,
    imageUrl: body.imageUrl ? String(body.imageUrl) : null,
    reach: body.reach === 'regiao' ? 'regiao' : 'clientes',
    validUntil: body.validUntil ? new Date(String(body.validUntil)) : null,
  }
}

export function offerError(o: ReturnType<typeof parseOffer>): string | null {
  if (!o.title) return 'Informe o produto'
  if (!(SUPPLY_CATEGORIES as readonly string[]).includes(o.category)) return 'Escolha uma categoria'
  if (!o.validUntil || Number.isNaN(o.validUntil.getTime())) return 'Informe até quando a oferta vale'
  return null
}
