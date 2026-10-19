// Vendas por oferta do fornecedor: relatório (ranking, totais, mês a mês), rotas de confirmar/registrar/desfazer
// e o clique no WhatsApp que abre o contato. node tests/vendas-ofertas.cjs
const assert = require('node:assert/strict')
const fs = require('node:fs')
const ts = require('typescript')
const vm = require('node:vm')

const plain = (v) => JSON.parse(JSON.stringify(v))
const NextResponse = { json: (data, options) => Response.json(data, options) }

// Banco de mentira
let contacts, promotions, clientsLinks, requests, auth, producer
let seq = 0
function resetDb() {
  promotions = [
    { id: 'o1', vendorId: 'v1', title: 'Sal mineral 30 kg', category: 'Sal mineral', price: 95, unit: 'Saco' },
    { id: 'o2', vendorId: 'v1', title: 'Ração 22%', category: 'Ração', price: 80, unit: 'Saco' },
    { id: 'o3', vendorId: 'v1', title: 'Vermífugo', category: 'Medicamentos', price: null, unit: null },
    { id: 'ox', vendorId: 'v2', title: 'De outro fornecedor', category: 'Ração', price: null, unit: null },
  ]
  const d = (day, status, promotionId, extra = {}) => ({ id: 'c' + ++seq, promotionId, farmId: 'f1', buyerName: null, status, source: 'clique', saleValue: null, quantity: null, note: null, soldAt: null, createdAt: new Date(day + 'T12:00:00Z'), ...extra })
  contacts = [
    d('2026-10-02', 'venda', 'o1', { saleValue: 95, quantity: 1, soldAt: new Date('2026-10-03T00:00:00Z') }),
    d('2026-10-05', 'venda', 'o1', { saleValue: 190, quantity: 2, soldAt: new Date('2026-10-06T00:00:00Z') }),
    d('2026-10-07', 'contato', 'o1'),
    d('2026-10-08', 'perdido', 'o1'),
    d('2026-10-09', 'venda', 'o2', { saleValue: 800, quantity: 10, soldAt: new Date('2026-10-10T00:00:00Z'), source: 'manual', farmId: null, buyerName: 'Sítio Boa Vista' }),
    d('2026-09-20', 'venda', 'o2', { saleValue: 160, soldAt: new Date('2026-09-21T00:00:00Z') }),
    d('2026-09-25', 'contato', 'o3'),
    // contato de setembro que virou venda em outubro conta em outubro
    d('2026-09-28', 'venda', 'o3', { saleValue: 50, soldAt: new Date('2026-10-01T00:00:00Z') }),
  ]
  clientsLinks = [{ vendorId: 'v1', farmId: 'f1' }]
  requests = [{ status: 'fechado', replyPrice: 300, updatedAt: new Date('2026-10-04T10:00:00Z') }, { status: 'fechado', replyPrice: 100, updatedAt: new Date('2026-08-04T10:00:00Z') }, { status: 'respondido', replyPrice: 999, updatedAt: new Date('2026-10-04T10:00:00Z') }]
  auth = { vendor: { id: 'v1', status: 'aprovado' } }
  producer = { user: { id: 'u1' }, farmId: 'f1' }
}
const withIncludes = (c) => ({ ...c, promotion: { title: promotions.find((p) => p.id === c.promotionId)?.title }, farm: c.farmId ? { name: 'Fazenda Teste', owner: null, city: null, state: null, phone: null } : null })
const matches = (c, where) => {
  if (where.id !== undefined && c.id !== where.id) return false
  if (where.promotionId !== undefined && c.promotionId !== where.promotionId) return false
  if (where.farmId !== undefined && c.farmId !== where.farmId) return false
  if (where.status !== undefined && c.status !== where.status) return false
  if (where.promotion && promotions.find((p) => p.id === c.promotionId)?.vendorId !== where.promotion.vendorId) return false
  return true
}
const prisma = {
  promotion: {
    findMany: async ({ where }) => promotions.filter((p) => p.vendorId === where.vendorId),
    findFirst: async ({ where }) => promotions.find((p) => p.id === where.id && (where.vendorId === undefined || p.vendorId === where.vendorId)) ?? null,
    update: (args) => ({ _op: 'clicks', args }),
  },
  offerContact: {
    findMany: async ({ where }) => contacts.filter((c) => matches(c, where)).map(withIncludes),
    findFirst: async ({ where }) => contacts.find((c) => matches(c, where)) ?? null,
    create: (args) => {
      const row = { id: 'c' + ++seq, farmId: null, buyerName: null, status: 'contato', source: 'clique', saleValue: null, quantity: null, note: null, soldAt: null, createdAt: new Date('2026-10-18T12:00:00Z'), ...args.data }
      contacts.push(row)
      return args.include ? Promise.resolve(withIncludes(row)) : { _op: 'create', row }
    },
    update: async ({ where, data }) => { const c = contacts.find((x) => x.id === where.id); Object.assign(c, data); return withIncludes(c) },
    delete: async ({ where }) => { contacts = contacts.filter((x) => x.id !== where.id); return {} },
    count: async ({ where }) => contacts.filter((c) => matches(c, where)).length,
  },
  supplyRequest: { findMany: async () => requests },
  vendorClient: { findFirst: async ({ where }) => clientsLinks.find((l) => l.vendorId === where.vendorId && l.farmId === where.farmId) ?? null },
  $transaction: async (ops) => ops.map((op) => op._op === 'create' ? op.row : op),
}

function load(path) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  vm.runInNewContext(code, { exports, Date, console, Response, Number, Math, JSON, String, Map, Promise, require: (name) => {
    if (name === 'next/server') return { NextResponse }
    if (name === '@/lib/prisma') return { prisma }
    if (name === '@/lib/auth') return { requireVendor: async () => auth, requireProducer: async () => producer, notFound: (msg) => Response.json({ error: msg }, { status: 404 }) }
    if (name === '@/lib/vendors') return { visibleOffersWhere: async () => ({}) }
    if (name === '@/lib/utils') return { todayISO: () => '2026-10-18' }
    if (name.startsWith('@/')) return load(`src/${name.slice(2)}.ts`)
    throw new Error('módulo inesperado: ' + name)
  } })
  return exports
}
const req = (data, query = {}) => ({ json: async () => data, nextUrl: { searchParams: new Map(Object.entries(query)) } })
const params = (id) => ({ params: Promise.resolve({ id }) })

;(async () => {
  const rules = load('src/lib/offerSales.ts')
  resetDb()

  // --- regras puras ---
  assert.deepEqual(plain(rules.parseRange(undefined, undefined, new Date(2026, 9, 18))), { from: '2026-10-01', to: '2026-10-31' }, 'sem período: o mês atual inteiro')
  assert.deepEqual(plain(rules.parseRange('2026-01-01', '2026-10-18')), { from: '2026-01-01', to: '2026-10-18' })
  assert.equal(rules.parseRange('2026-10-18', '2026-10-01'), null, 'de depois do até')
  assert.equal(rules.parseRange('ontem', '2026-10-01'), null)

  const october = { from: '2026-10-01', to: '2026-10-31' }
  const report = plain(rules.buildSalesReport(promotions.filter((p) => p.vendorId === 'v1'), contacts, requests, october))
  assert.deepEqual(report.totals, { contacts: 6, sales: 4, lost: 1, rate: 67, revenue: 1135 })
  assert.deepEqual(report.byOffer.map((o) => [o.title, o.contacts, o.sales, o.rate, o.revenue]), [
    ['Sal mineral 30 kg', 4, 2, 50, 285],
    ['Ração 22%', 1, 1, 100, 800],
    ['Vermífugo', 1, 1, 100, 50],
  ], 'da que mais vendeu para a que menos; empate em vendas decide pelo valor')
  assert.equal(report.byOffer[0].lost, 1)
  assert.equal(report.byOffer[0].quantity, 3)
  assert.deepEqual(report.byMonth, [{ month: '2026-10', contacts: 6, sales: 4, revenue: 1135 }])
  assert.deepEqual(report.requestsClosed, { count: 1, value: 300 }, 'só pedidos atendidos no período')

  const year = plain(rules.buildSalesReport(promotions.filter((p) => p.vendorId === 'v1'), contacts, requests, { from: '2026-01-01', to: '2026-12-31' }))
  assert.deepEqual(year.byMonth, [{ month: '2026-09', contacts: 2, sales: 1, revenue: 160 }, { month: '2026-10', contacts: 6, sales: 4, revenue: 1135 }])
  assert.equal(year.totals.contacts, 8)
  assert.equal(plain(rules.buildSalesReport(promotions, [], [], october)).byOffer.length, 0, 'sem movimento, sem linhas')

  assert.equal(rules.parseMoney('1.250,50'), 1250.5); assert.equal(rules.parseMoney('12.5'), 12.5); assert.equal(rules.parseMoney(''), null); assert.equal(rules.parseMoney('abc'), undefined)
  assert.deepEqual(plain(rules.parseSale({ saleValue: '95,00', quantity: '1', soldAt: '2026-10-10', buyerName: ' Zé ' }, '2026-10-18')), { saleValue: 95, quantity: 1, soldAt: '2026-10-10', buyerName: 'Zé', note: null })
  assert.deepEqual(plain(rules.parseSale({}, '2026-10-18')), { saleValue: null, quantity: 1, soldAt: '2026-10-18', buyerName: null, note: null }, 'sem data: hoje; sem quantidade: 1')
  assert.equal(rules.parseSale({ quantity: '0' }, '2026-10-18'), 'A quantidade mínima é 1')
  assert.equal(rules.parseSale({ quantity: '0,5' }, '2026-10-18'), 'A quantidade mínima é 1')
  assert.equal(rules.parseSale({ saleValue: 'x' }, '2026-10-18'), 'Valor inválido')
  assert.equal(rules.parseSale({ soldAt: '2026-10-19' }, '2026-10-18'), 'A data da venda não pode ser no futuro')

  // --- rota GET: relatório + contatos a confirmar + vendas do período ---
  const api = load('src/app/api/fornecedor/vendas/route.ts')
  let res = await api.GET(req(null, { from: '2026-10-01', to: '2026-10-31' }))
  assert.equal(res.status, 200)
  let body = await res.json()
  assert.equal(body.totals.sales, 4)
  assert.equal(body.byOffer[0].title, 'Sal mineral 30 kg')
  assert.deepEqual(body.pending.map((c) => c.offerTitle), ['Sal mineral 30 kg', 'Vermífugo'], 'contatos sem resposta de qualquer data')
  assert.equal(body.pending[0].farm.name, 'Fazenda Teste')
  assert.equal(body.sales.length, 4)
  assert.ok(body.sales.every((s) => s.status === 'venda'))
  assert.equal((await api.GET(req(null, { from: 'x', to: 'y' }))).status, 400)

  // --- rota POST: venda registrada à mão ---
  res = await api.POST(req({ promotionId: 'o2', buyerName: 'Balcão', saleValue: '160,00', quantity: '2', soldAt: '2026-10-15' }))
  assert.equal(res.status, 201)
  body = await res.json()
  assert.equal(body.status, 'venda'); assert.equal(body.source, 'manual'); assert.equal(body.saleValue, 160); assert.equal(body.buyerName, 'Balcão'); assert.equal(body.offerTitle, 'Ração 22%')
  res = await api.POST(req({ promotionId: 'o1', farmId: 'f1', saleValue: '95' }))
  assert.equal(res.status, 201)
  assert.equal((await res.json()).farm.name, 'Fazenda Teste', 'cliente do app')
  assert.equal((await api.POST(req({ promotionId: 'ox', buyerName: 'x' }))).status, 400, 'oferta de outro fornecedor')
  assert.equal((await api.POST(req({ promotionId: 'o1', farmId: 'f9' }))).status, 400, 'não é cliente')
  res = await api.POST(req({ promotionId: 'o1' }))
  assert.equal(res.status, 201, 'cliente e comprador são opcionais')
  body = await res.json()
  assert.equal(body.buyerName, null); assert.equal(body.farmId, null); assert.equal(body.quantity, 1)
  assert.equal((await api.POST(req({ promotionId: 'o1', buyerName: 'x', saleValue: 'abc' }))).status, 400)

  // --- rota PATCH/DELETE: confirma, perde, desfaz ---
  const one = load('src/app/api/fornecedor/vendas/[id]/route.ts')
  resetDb()
  const pending = contacts.find((c) => c.status === 'contato')
  res = await one.PATCH(req({ status: 'venda', saleValue: '95', quantity: '1', soldAt: '2026-10-12' }), params(pending.id))
  assert.equal(res.status, 200)
  body = await res.json()
  assert.equal(body.status, 'venda'); assert.equal(body.saleValue, 95); assert.equal(body.soldAt.slice(0, 10), '2026-10-12')
  res = await one.PATCH(req({ status: 'contato' }), params(pending.id))
  assert.equal(res.status, 200)
  assert.equal(pending.status, 'contato'); assert.equal(pending.saleValue, null); assert.equal(pending.soldAt, null)
  assert.equal((await one.PATCH(req({ status: 'perdido' }), params(pending.id))).status, 200)
  assert.equal(pending.status, 'perdido')
  assert.equal((await one.PATCH(req({ status: 'venda', soldAt: '2027-01-01' }), params(pending.id))).status, 400)
  assert.equal((await one.PATCH(req({}), params(pending.id))).status, 400)
  const manual = contacts.find((c) => c.source === 'manual')
  assert.equal((await one.PATCH(req({ status: 'contato' }), params(manual.id))).status, 409, 'venda à mão não vira contato')
  assert.equal((await one.DELETE({}, params(manual.id))).status, 200)
  assert.equal(contacts.some((c) => c.id === manual.id), false)
  assert.equal((await one.DELETE({}, params('nada'))).status, 404)
  auth = { vendor: { id: 'v2' } }
  assert.equal((await one.PATCH(req({ status: 'perdido' }), params(pending.id))).status, 404, 'contato de outro fornecedor')

  // --- clique no WhatsApp abre o contato (um por propriedade e oferta) ---
  const click = load('src/app/api/ofertas/[id]/whatsapp/route.ts')
  resetDb()
  const before = contacts.length
  assert.equal((await click.POST({}, params('o2'))).status, 200)
  assert.equal(contacts.length, before + 1)
  assert.deepEqual([contacts.at(-1).promotionId, contacts.at(-1).farmId, contacts.at(-1).status], ['o2', 'f1', 'contato'])
  assert.equal((await click.POST({}, params('o2'))).status, 200)
  assert.equal(contacts.length, before + 1, 'segundo clique não abre outro contato')
  assert.equal((await click.POST({}, params('o1'))).status, 200)
  assert.equal(contacts.length, before + 1, 'já havia contato aberto para o1')
  assert.equal((await click.POST({}, params('nada'))).status, 404)
  console.log('vendas-ofertas: ok')
})().catch((e) => { console.error(e); process.exit(1) })
